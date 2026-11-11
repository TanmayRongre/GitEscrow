import { Request, Response } from "express";
import { ZodError } from "zod";
import mongoose from "mongoose";
import { AuthenticatedRequest } from "../auth/auth.middleware";
import { BountyService, BountyError } from "./bounty.service";
import { MilestoneService, MilestoneError } from "./milestone.service";
import { LedgerService, LedgerError } from "./ledger.service";
import { BountyStateError } from "./bounty-state.service";
import { Organization, OrganizationRole } from "../models/Organization";
import { Bounty } from "../models/Bounty";
import { Milestone } from "../models/Milestone";
import {
  createBountySchema,
  updateBountySchema,
  createMilestoneSchema,
  updateMilestoneSchema,
  submitBountySchema,
  submitMilestoneSchema,
  milestoneDecisionSchema,
  bountyQuerySchema,
  fundBountySchema,
  capturePayPalOrderSchema,
} from "./bounty.validation";
import {
  PayoutService,
  PayoutError,
  maskEmail,
} from "../paypal/payout.service";
import {
  PRVerificationService,
  PRVerificationError,
} from "../ai/pr-verification.service";
import {
  SubmitMilestonePRRequestSchema,
  ReviewMilestoneRequestSchema,
} from "../ai/pr-verification.types";

async function resolveOrgRole(
  orgId: string | mongoose.Types.ObjectId,
  userId: string | mongoose.Types.ObjectId,
): Promise<OrganizationRole | undefined> {
  const org = await Organization.findById(orgId);
  if (!org) return undefined;
  const userIdStr = userId.toString();
  if (org.ownerId.toString() === userIdStr) return "OWNER";
  const member = org.members.find((m) => m.userId.toString() === userIdStr);
  return member?.role;
}

function handleControllerError(
  err: any,
  res: Response,
  defaultMessage: string,
) {
  if (err instanceof ZodError) {
    const issues = (err as any).issues || (err as any).errors || [];
    res.status(400).json({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: issues.map((e: any) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    });
    return;
  }
  if (
    err instanceof BountyError ||
    err instanceof MilestoneError ||
    err instanceof LedgerError ||
    err instanceof BountyStateError ||
    err instanceof PRVerificationError ||
    err instanceof PayoutError
  ) {
    const status = (err as any).statusCode || (err as any).status || 400;
    const code = (err as any).errorCode || (err as any).code || "ERROR";
    res.status(status).json({ error: err.message, code });
    return;
  }
  res.status(500).json({ error: `${defaultMessage}: ${err.message}` });
}

export class BountyController {
  public static async create(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      const validated = createBountySchema.parse(req.body);
      const orgRole = await resolveOrgRole(
        validated.organizationId,
        req.user._id,
      );

      const bounty = await BountyService.createBounty(
        validated,
        req.user,
        orgRole,
      );
      res.status(201).json({ message: "Bounty created successfully", bounty });
    } catch (err: any) {
      handleControllerError(err, res, "Failed to create bounty");
    }
  }

  public static async list(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const validated = bountyQuerySchema.parse(req.query);
      const result = await BountyService.listBounties(validated, req.user);
      res.status(200).json(result);
    } catch (err: any) {
      handleControllerError(err, res, "Failed to list bounties");
    }
  }

  public static async getSummary(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const summary = await BountyService.getSummary(req.user);
      res.status(200).json(summary);
    } catch (err: any) {
      handleControllerError(
        err,
        res,
        "Failed to retrieve dashboard summary metrics",
      );
    }
  }

  public static async getById(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const result = await BountyService.getBountyById(req.params.id);
      const orgRole =
        result.bounty && req.user
          ? await resolveOrgRole(
              (result.bounty.organizationId as any)._id ||
                result.bounty.organizationId,
              req.user._id,
            )
          : undefined;
      const contributorId =
        (result.bounty?.assignedContributorId as any)?._id ||
        result.bounty?.assignedContributorId;
      const isPrivileged =
        req.user?.role === "ADMIN" ||
        orgRole === "OWNER" ||
        orgRole === "SPONSOR" ||
        (contributorId &&
          req.user &&
          contributorId.toString() === req.user._id.toString());

      if (!isPrivileged) {
        result.milestones = result.milestones.map((m: any) => {
          const obj = typeof m.toJSON === "function" ? m.toJSON() : m;
          if (obj.payoutReceiverEmail) {
            obj.payoutReceiverEmail = maskEmail(obj.payoutReceiverEmail);
          }
          return obj;
        });
      }

      res.status(200).json(result);
    } catch (err: any) {
      handleControllerError(err, res, "Failed to get bounty");
    }
  }

  public static async update(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      const validated = updateBountySchema.parse(req.body);
      const bounty = await Bounty.findById(req.params.id);
      if (!bounty) {
        res
          .status(404)
          .json({ error: "Bounty not found", code: "BOUNTY_NOT_FOUND" });
        return;
      }

      const orgRole = await resolveOrgRole(bounty.organizationId, req.user._id);
      const updated = await BountyService.updateBounty(
        req.params.id,
        validated,
        req.user,
        orgRole,
      );
      res
        .status(200)
        .json({ message: "Bounty updated successfully", bounty: updated });
    } catch (err: any) {
      handleControllerError(err, res, "Failed to update bounty");
    }
  }

  public static async publish(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      const bounty = await Bounty.findById(req.params.id);
      if (!bounty) {
        res
          .status(404)
          .json({ error: "Bounty not found", code: "BOUNTY_NOT_FOUND" });
        return;
      }

      const orgRole = await resolveOrgRole(bounty.organizationId, req.user._id);
      const published = await BountyService.publishBounty(
        req.params.id,
        req.user,
        orgRole,
      );
      res
        .status(200)
        .json({ message: "Bounty published successfully", bounty: published });
    } catch (err: any) {
      handleControllerError(err, res, "Failed to publish bounty");
    }
  }

  public static async getPayPalConfig(
    _req: Request,
    res: Response,
  ): Promise<void> {
    const clientId = process.env.PAYPAL_CLIENT_ID || "";
    res.status(200).json({
      clientId: clientId.trim(),
      environment: "sandbox",
      currency: "USD",
    });
  }

  public static async createPayPalOrder(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      const bounty = await Bounty.findById(req.params.id);
      if (!bounty) {
        res
          .status(404)
          .json({ error: "Bounty not found", code: "BOUNTY_NOT_FOUND" });
        return;
      }

      const orgRole = await resolveOrgRole(bounty.organizationId, req.user._id);
      const order = await BountyService.createPayPalOrder(
        req.params.id,
        req.user,
        orgRole,
      );
      res.status(201).json(order);
    } catch (err: any) {
      handleControllerError(err, res, "Failed to create PayPal order");
    }
  }

  public static async capturePayPalOrder(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      const validated = capturePayPalOrderSchema.parse(req.body);
      const bounty = await Bounty.findById(req.params.id);
      if (!bounty) {
        res
          .status(404)
          .json({ error: "Bounty not found", code: "BOUNTY_NOT_FOUND" });
        return;
      }

      const orgRole = await resolveOrgRole(bounty.organizationId, req.user._id);
      const funded = await BountyService.capturePayPalOrder(
        req.params.id,
        validated.orderId,
        req.user,
        orgRole,
      );
      res.status(200).json({
        message: "Bounty funded successfully via PayPal Sandbox",
        bounty: funded,
        captureId: funded.inboundCaptureId,
        orderId: funded.inboundOrderId,
      });
    } catch (err: any) {
      handleControllerError(err, res, "Failed to capture PayPal order");
    }
  }

  public static async fundBounty(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      const validated = fundBountySchema.parse(req.body);
      const bounty = await Bounty.findById(req.params.id);
      if (!bounty) {
        res
          .status(404)
          .json({ error: "Bounty not found", code: "BOUNTY_NOT_FOUND" });
        return;
      }

      const orgRole = await resolveOrgRole(bounty.organizationId, req.user._id);
      const funded = await BountyService.fundBounty(
        req.params.id,
        validated,
        req.user,
        orgRole,
      );
      res
        .status(200)
        .json({ message: "Bounty funded successfully", bounty: funded });
    } catch (err: any) {
      handleControllerError(err, res, "Failed to fund bounty");
    }
  }

  public static async cancel(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      const bounty = await Bounty.findById(req.params.id);
      if (!bounty) {
        res
          .status(404)
          .json({ error: "Bounty not found", code: "BOUNTY_NOT_FOUND" });
        return;
      }

      const orgRole = await resolveOrgRole(bounty.organizationId, req.user._id);
      const cancelled = await BountyService.cancelBounty(
        req.params.id,
        req.body?.reason,
        req.user,
        orgRole,
      );
      res
        .status(200)
        .json({ message: "Bounty cancelled successfully", bounty: cancelled });
    } catch (err: any) {
      handleControllerError(err, res, "Failed to cancel bounty");
    }
  }

  public static async accept(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      const accepted = await BountyService.acceptBounty(
        req.params.id,
        req.user,
      );
      res
        .status(200)
        .json({ message: "Bounty accepted successfully", bounty: accepted });
    } catch (err: any) {
      handleControllerError(err, res, "Failed to accept bounty");
    }
  }

  public static async start(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      const started = await BountyService.startBounty(req.params.id, req.user);
      res
        .status(200)
        .json({ message: "Work on bounty started", bounty: started });
    } catch (err: any) {
      handleControllerError(err, res, "Failed to start bounty");
    }
  }

  public static async submit(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      const validated = submitBountySchema.parse(req.body);
      const submitted = await BountyService.submitBounty(
        req.params.id,
        validated,
        req.user,
      );
      res
        .status(200)
        .json({ message: "Bounty submission recorded", bounty: submitted });
    } catch (err: any) {
      handleControllerError(err, res, "Failed to submit bounty");
    }
  }

  // --- Milestone Endpoints ---

  public static async createMilestone(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      const validated = createMilestoneSchema.parse(req.body);
      const bounty = await Bounty.findById(req.params.id);
      if (!bounty) {
        res
          .status(404)
          .json({ error: "Bounty not found", code: "BOUNTY_NOT_FOUND" });
        return;
      }

      const orgRole = await resolveOrgRole(bounty.organizationId, req.user._id);
      const milestone = await MilestoneService.createMilestone(
        req.params.id,
        validated,
        req.user,
        orgRole,
      );
      res
        .status(201)
        .json({ message: "Milestone created successfully", milestone });
    } catch (err: any) {
      handleControllerError(err, res, "Failed to create milestone");
    }
  }

  public static async listMilestones(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const milestones = await MilestoneService.listMilestones(req.params.id);
      const bounty = await Bounty.findById(req.params.id);
      const orgRole =
        bounty && req.user
          ? await resolveOrgRole(bounty.organizationId, req.user._id)
          : undefined;
      const isPrivileged =
        req.user?.role === "ADMIN" ||
        orgRole === "OWNER" ||
        orgRole === "SPONSOR" ||
        (bounty?.assignedContributorId &&
          req.user &&
          bounty.assignedContributorId.toString() === req.user._id.toString());

      const sanitized = milestones.map((m) => {
        const obj = typeof m.toJSON === "function" ? m.toJSON() : m;
        if (!isPrivileged && obj.payoutReceiverEmail) {
          obj.payoutReceiverEmail = maskEmail(obj.payoutReceiverEmail);
        }
        return obj;
      });

      res.status(200).json({ milestones: sanitized });
    } catch (err: any) {
      handleControllerError(err, res, "Failed to list milestones");
    }
  }

  public static async updateMilestone(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      const validated = updateMilestoneSchema.parse(req.body);
      const milestone = await Milestone.findById(req.params.id);
      if (!milestone) {
        res
          .status(404)
          .json({ error: "Milestone not found", code: "MILESTONE_NOT_FOUND" });
        return;
      }

      const bounty = await Bounty.findById(milestone.bountyId);
      if (!bounty) {
        res
          .status(404)
          .json({ error: "Bounty not found", code: "BOUNTY_NOT_FOUND" });
        return;
      }

      const orgRole = await resolveOrgRole(bounty.organizationId, req.user._id);
      const updated = await MilestoneService.updateMilestone(
        req.params.id,
        validated,
        req.user,
        orgRole,
      );
      res.status(200).json({
        message: "Milestone updated successfully",
        milestone: updated,
      });
    } catch (err: any) {
      handleControllerError(err, res, "Failed to update milestone");
    }
  }

  public static async submitMilestone(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      const validated = submitMilestoneSchema.parse(req.body);
      const submitted = await MilestoneService.submitMilestone(
        req.params.id,
        validated.submissionDetails,
        req.user,
      );
      res.status(200).json({
        message: "Milestone submitted for review",
        milestone: submitted,
      });
    } catch (err: any) {
      handleControllerError(err, res, "Failed to submit milestone");
    }
  }

  public static async approveMilestone(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      const validated = milestoneDecisionSchema.parse(req.body || {});
      const milestone = await Milestone.findById(req.params.id);
      if (!milestone) {
        res
          .status(404)
          .json({ error: "Milestone not found", code: "MILESTONE_NOT_FOUND" });
        return;
      }

      const bounty = await Bounty.findById(milestone.bountyId);
      if (!bounty) {
        res
          .status(404)
          .json({ error: "Bounty not found", code: "BOUNTY_NOT_FOUND" });
        return;
      }

      const orgRole = await resolveOrgRole(bounty.organizationId, req.user._id);
      const approved = await MilestoneService.approveMilestone(
        req.params.id,
        validated.decisionNotes,
        req.user,
        orgRole,
      );
      res.status(200).json({
        message: "Milestone approved successfully",
        milestone: approved,
      });
    } catch (err: any) {
      handleControllerError(err, res, "Failed to approve milestone");
    }
  }

  public static async requestChangesMilestone(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      const validated = milestoneDecisionSchema.parse(req.body || {});
      const milestone = await Milestone.findById(req.params.id);
      if (!milestone) {
        res
          .status(404)
          .json({ error: "Milestone not found", code: "MILESTONE_NOT_FOUND" });
        return;
      }

      const bounty = await Bounty.findById(milestone.bountyId);
      if (!bounty) {
        res
          .status(404)
          .json({ error: "Bounty not found", code: "BOUNTY_NOT_FOUND" });
        return;
      }

      const orgRole = await resolveOrgRole(bounty.organizationId, req.user._id);
      const updated = await MilestoneService.requestChanges(
        req.params.id,
        validated.decisionNotes || "Changes requested by sponsor",
        req.user,
        orgRole,
      );
      res.status(200).json({
        message: "Changes requested on milestone",
        milestone: updated,
      });
    } catch (err: any) {
      handleControllerError(err, res, "Failed to request changes on milestone");
    }
  }

  // --- Ledger Endpoints ---

  public static async getBountyLedger(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      const bounty = await Bounty.findById(req.params.id);
      if (!bounty) {
        res
          .status(404)
          .json({ error: "Bounty not found", code: "BOUNTY_NOT_FOUND" });
        return;
      }

      const orgRole = await resolveOrgRole(bounty.organizationId, req.user._id);
      const ledger = await LedgerService.getByBounty(
        req.params.id,
        req.user,
        orgRole,
      );
      res.status(200).json({ ledger });
    } catch (err: any) {
      handleControllerError(err, res, "Failed to get bounty ledger");
    }
  }

  public static async getOrgLedger(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      const orgRole = await resolveOrgRole(req.params.id, req.user._id);
      const ledger = await LedgerService.getByOrganization(
        req.params.id,
        req.user,
        orgRole,
      );
      res.status(200).json({ ledger });
    } catch (err: any) {
      handleControllerError(err, res, "Failed to get organization ledger");
    }
  }

  // --- Task 2C: PR Submission & Verification Endpoints ---

  public static async submitMilestonePR(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ error: "Authentication required", code: "UNAUTHORIZED" });
        return;
      }
      const milestoneId = req.params.milestoneId || req.params.id;
      const validated = SubmitMilestonePRRequestSchema.parse(req.body);
      const result = await PRVerificationService.submitPRForMilestone(
        milestoneId,
        validated,
        req.user,
      );
      res.status(200).json({
        message: "Pull request submitted and verified successfully.",
        milestone: result.milestone,
        verification: result.verification,
      });
    } catch (err: any) {
      handleControllerError(err, res, "Failed to submit PR for milestone");
    }
  }

  public static async reviewMilestonePR(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ error: "Authentication required", code: "UNAUTHORIZED" });
        return;
      }
      const milestoneId = req.params.milestoneId || req.params.id;
      const validated = ReviewMilestoneRequestSchema.parse(req.body);
      const milestone = await PRVerificationService.reviewMilestone(
        milestoneId,
        validated,
        req.user,
      );
      res.status(200).json({
        message: `Milestone decision "${validated.action}" recorded successfully.`,
        milestone,
      });
    } catch (err: any) {
      handleControllerError(
        err,
        res,
        "Failed to process milestone review decision",
      );
    }
  }

  public static async getMilestoneVerification(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ error: "Authentication required", code: "UNAUTHORIZED" });
        return;
      }
      const milestoneId = req.params.milestoneId || req.params.id;
      const milestone = await Milestone.findById(milestoneId);
      if (!milestone) {
        res
          .status(404)
          .json({ error: "Milestone not found", code: "MILESTONE_NOT_FOUND" });
        return;
      }
      if (!milestone.latestVerification) {
        res.status(404).json({
          error: "No verification report available for this milestone yet.",
          code: "VERIFICATION_NOT_FOUND",
        });
        return;
      }
      res.status(200).json({ verification: milestone.latestVerification });
    } catch (err: any) {
      handleControllerError(err, res, "Failed to get milestone verification");
    }
  }

  // --- Task 2D: Milestone Payout Endpoints ---

  public static async retryMilestonePayout(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ error: "Authentication required", code: "UNAUTHORIZED" });
        return;
      }
      const milestoneId = req.params.milestoneId || req.params.id;
      const milestone = await Milestone.findById(milestoneId);
      if (!milestone) {
        res
          .status(404)
          .json({ error: "Milestone not found", code: "MILESTONE_NOT_FOUND" });
        return;
      }
      const bounty = await Bounty.findById(milestone.bountyId);
      if (!bounty) {
        res
          .status(404)
          .json({ error: "Bounty not found", code: "BOUNTY_NOT_FOUND" });
        return;
      }

      const orgRole = await resolveOrgRole(bounty.organizationId, req.user._id);
      const isGlobalAdmin = req.user.role === "ADMIN";
      const isSponsorOrOwner = orgRole === "OWNER" || orgRole === "SPONSOR";

      if (!isGlobalAdmin && !isSponsorOrOwner) {
        res.status(403).json({
          error:
            "Access Denied: Only organization sponsors or admins can retry payouts.",
          code: "FORBIDDEN",
        });
        return;
      }

      const result = await PayoutService.retryMilestonePayout(
        milestoneId,
        req.user,
      );
      res.status(200).json({
        message: "Payout retry processed",
        status: result.status,
        milestone: result.milestone,
      });
    } catch (err: any) {
      handleControllerError(err, res, "Failed to retry payout");
    }
  }

  public static async getMilestonePayoutStatus(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      if (!req.user) {
        res
          .status(401)
          .json({ error: "Authentication required", code: "UNAUTHORIZED" });
        return;
      }
      const milestoneId = req.params.milestoneId || req.params.id;
      const reconciled =
        await PayoutService.reconcileUncertainPayout(milestoneId);

      const bounty = await Bounty.findById(reconciled.bountyId);
      const orgRole = bounty
        ? await resolveOrgRole(bounty.organizationId, req.user._id)
        : undefined;
      const isPrivileged =
        req.user.role === "ADMIN" ||
        orgRole === "OWNER" ||
        orgRole === "SPONSOR" ||
        (bounty?.assignedContributorId &&
          bounty.assignedContributorId.toString() === req.user._id.toString());

      res.status(200).json({
        milestoneId: reconciled._id,
        payoutStatus: reconciled.payoutStatus,
        payoutBatchId: reconciled.payoutBatchId,
        payoutItemId: reconciled.payoutItemId,
        payoutTransactionId: reconciled.payoutTransactionId,
        payoutReceiverEmail: isPrivileged
          ? reconciled.payoutReceiverEmail
          : maskEmail(reconciled.payoutReceiverEmail),
        payoutDisbursedAt: reconciled.payoutDisbursedAt,
        payoutAttempts: reconciled.payoutAttempts,
        payoutError: reconciled.payoutError,
      });
    } catch (err: any) {
      handleControllerError(err, res, "Failed to get payout status");
    }
  }
}
