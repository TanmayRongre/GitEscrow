import mongoose from "mongoose";
import { Milestone, IMilestone, MilestoneStatus } from "../models/Milestone";
import { Bounty, IBounty } from "../models/Bounty";
import { IUser } from "../models/User";
import { OrganizationRole } from "../models/Organization";
import { LedgerService } from "./ledger.service";
import { PayoutService } from "../paypal/payout.service";

export class MilestoneError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(message: string, status = 400, code = "MILESTONE_ERROR") {
    super(message);
    this.name = "MilestoneError";
    this.status = status;
    this.code = code;
    Object.setPrototypeOf(this, MilestoneError.prototype);
  }
}

export function toCents(
  val: number | string | mongoose.Types.Decimal128,
): number {
  const str =
    typeof val === "object" && val !== null && "toString" in val
      ? val.toString()
      : String(val);
  const num = parseFloat(str);
  return Math.round(num * 100);
}

export class MilestoneService {
  /**
   * Creates a new milestone for a bounty.
   * Validates positive reward, order uniqueness, and that the sum does not exceed bounty reward.
   */
  public static async createMilestone(
    bountyId: string,
    data: {
      title: string;
      description?: string;
      order: number;
      rewardAmount: number;
      currency?: "USD";
      acceptanceCriteria: string[];
      dueDate?: string;
    },
    actor: IUser,
    orgRole?: OrganizationRole,
  ): Promise<IMilestone> {
    const isGlobalAdmin = actor.role === "ADMIN";
    const isOrgSponsorOrOwner = orgRole === "OWNER" || orgRole === "SPONSOR";

    if (!isGlobalAdmin && !isOrgSponsorOrOwner) {
      throw new MilestoneError(
        "Access Denied: Only organization sponsors or owners can add milestones.",
        403,
        "FORBIDDEN_MILESTONE_CREATE",
      );
    }

    const bounty = await Bounty.findById(bountyId);
    if (!bounty) {
      throw new MilestoneError(
        "Target bounty not found.",
        404,
        "BOUNTY_NOT_FOUND",
      );
    }

    if (
      bounty.status === "COMPLETED" ||
      bounty.status === "CANCELLED" ||
      bounty.status === "EXPIRED"
    ) {
      throw new MilestoneError(
        `Cannot add milestones to a bounty with status "${bounty.status}".`,
        400,
        "BOUNTY_INACTIVE",
      );
    }

    if (data.rewardAmount <= 0) {
      throw new MilestoneError(
        "Milestone reward amount must be greater than zero.",
        400,
        "INVALID_REWARD_AMOUNT",
      );
    }

    if (data.currency && data.currency !== "USD") {
      throw new MilestoneError(
        "Milestone currency must match bounty currency (USD).",
        400,
        "INVALID_CURRENCY",
      );
    }

    // Check order uniqueness
    const existingOrder = await Milestone.findOne({
      bountyId: bounty._id,
      order: data.order,
    });
    if (existingOrder) {
      throw new MilestoneError(
        `A milestone with order ${data.order} already exists for this bounty.`,
        409,
        "DUPLICATE_MILESTONE_ORDER",
      );
    }

    // Check milestone total does not exceed bounty total reward
    const existingMilestones = await Milestone.find({ bountyId: bounty._id });
    const existingTotalCents = existingMilestones.reduce(
      (acc, m) => acc + toCents(m.rewardAmount),
      0,
    );
    const newTotalCents = existingTotalCents + toCents(data.rewardAmount);
    const bountyTotalCents = toCents(bounty.rewardAmount);

    if (newTotalCents > bountyTotalCents) {
      throw new MilestoneError(
        `Total milestone rewards ($${(newTotalCents / 100).toFixed(2)}) exceed the bounty total reward ($${(
          bountyTotalCents / 100
        ).toFixed(2)}).`,
        400,
        "MILESTONE_TOTAL_EXCEEDS_BOUNTY",
      );
    }

    const milestone = new Milestone({
      bountyId: bounty._id,
      title: data.title.trim(),
      description: data.description?.trim() || "",
      order: data.order,
      rewardAmount: mongoose.Types.Decimal128.fromString(
        data.rewardAmount.toFixed(2),
      ),
      currency: "USD",
      acceptanceCriteria: data.acceptanceCriteria
        .map((c) => c.trim())
        .filter(Boolean),
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
    });

    await milestone.save();
    return milestone;
  }

  /**
   * Lists all milestones for a bounty, sorted by order ascending.
   */
  public static async listMilestones(bountyId: string): Promise<IMilestone[]> {
    return Milestone.find({ bountyId: new mongoose.Types.ObjectId(bountyId) })
      .sort({ order: 1 })
      .exec();
  }

  /**
   * Updates an existing milestone.
   * Approved milestones cannot be edited.
   */
  public static async updateMilestone(
    milestoneId: string,
    updates: {
      title?: string;
      description?: string;
      order?: number;
      rewardAmount?: number;
      acceptanceCriteria?: string[];
      dueDate?: string;
    },
    actor: IUser,
    orgRole?: OrganizationRole,
  ): Promise<IMilestone> {
    const isGlobalAdmin = actor.role === "ADMIN";
    const isOrgSponsorOrOwner = orgRole === "OWNER" || orgRole === "SPONSOR";

    if (!isGlobalAdmin && !isOrgSponsorOrOwner) {
      throw new MilestoneError(
        "Access Denied: Only organization sponsors or owners can edit milestones.",
        403,
        "FORBIDDEN_MILESTONE_UPDATE",
      );
    }

    const milestone = await Milestone.findById(milestoneId);
    if (!milestone) {
      throw new MilestoneError(
        "Milestone not found.",
        404,
        "MILESTONE_NOT_FOUND",
      );
    }

    if (milestone.status === "APPROVED") {
      throw new MilestoneError(
        "Approved milestones are locked and cannot be edited without an audited revision mechanism.",
        400,
        "APPROVED_MILESTONE_LOCKED",
      );
    }

    const bounty = await Bounty.findById(milestone.bountyId);
    if (!bounty) {
      throw new MilestoneError(
        "Associated bounty not found.",
        404,
        "BOUNTY_NOT_FOUND",
      );
    }

    if (updates.order !== undefined && updates.order !== milestone.order) {
      const orderConflict = await Milestone.findOne({
        bountyId: bounty._id,
        order: updates.order,
        _id: { $ne: milestone._id },
      });
      if (orderConflict) {
        throw new MilestoneError(
          `A milestone with order ${updates.order} already exists for this bounty.`,
          409,
          "DUPLICATE_MILESTONE_ORDER",
        );
      }
      milestone.order = updates.order;
    }

    if (updates.rewardAmount !== undefined) {
      if (updates.rewardAmount <= 0) {
        throw new MilestoneError(
          "Milestone reward amount must be positive.",
          400,
          "INVALID_REWARD_AMOUNT",
        );
      }

      // Check sum of all milestones with this new amount
      const otherMilestones = await Milestone.find({
        bountyId: bounty._id,
        _id: { $ne: milestone._id },
      });
      const otherTotalCents = otherMilestones.reduce(
        (acc, m) => acc + toCents(m.rewardAmount),
        0,
      );
      const newTotalCents = otherTotalCents + toCents(updates.rewardAmount);
      const bountyTotalCents = toCents(bounty.rewardAmount);

      if (newTotalCents > bountyTotalCents) {
        throw new MilestoneError(
          `Total milestone rewards ($${(newTotalCents / 100).toFixed(2)}) exceed the bounty total reward ($${(
            bountyTotalCents / 100
          ).toFixed(2)}).`,
          400,
          "MILESTONE_TOTAL_EXCEEDS_BOUNTY",
        );
      }

      milestone.rewardAmount = mongoose.Types.Decimal128.fromString(
        updates.rewardAmount.toFixed(2),
      );
    }

    if (updates.title) milestone.title = updates.title.trim();
    if (updates.description !== undefined)
      milestone.description = updates.description.trim();
    if (updates.acceptanceCriteria) {
      milestone.acceptanceCriteria = updates.acceptanceCriteria
        .map((c) => c.trim())
        .filter(Boolean);
    }
    if (updates.dueDate) milestone.dueDate = new Date(updates.dueDate);

    await milestone.save();
    return milestone;
  }

  /**
   * Submits a milestone for sponsor review.
   * Assigned contributor or authorized sponsor.
   */
  public static async submitMilestone(
    milestoneId: string,
    submissionDetails: string,
    actor: IUser,
  ): Promise<IMilestone> {
    const milestone = await Milestone.findById(milestoneId);
    if (!milestone) {
      throw new MilestoneError(
        "Milestone not found.",
        404,
        "MILESTONE_NOT_FOUND",
      );
    }

    const bounty = await Bounty.findById(milestone.bountyId);
    if (!bounty) {
      throw new MilestoneError(
        "Associated bounty not found.",
        404,
        "BOUNTY_NOT_FOUND",
      );
    }

    const isAssigned =
      bounty.assignedContributorId &&
      bounty.assignedContributorId.toString() === actor._id.toString();
    const isGlobalAdmin = actor.role === "ADMIN";

    if (!isAssigned && !isGlobalAdmin) {
      throw new MilestoneError(
        "Access Denied: Only the assigned contributor can submit deliverables for this milestone.",
        403,
        "FORBIDDEN_MILESTONE_SUBMIT",
      );
    }

    if (milestone.status === "APPROVED") {
      throw new MilestoneError(
        "This milestone has already been approved.",
        400,
        "ALREADY_APPROVED",
      );
    }

    milestone.status = "SUBMITTED";
    milestone.submissionDetails = submissionDetails.trim();
    milestone.submittedAt = new Date();

    await milestone.save();
    return milestone;
  }

  /**
   * Approves a milestone.
   * Actor must be organization OWNER, SPONSOR, or global ADMIN.
   * Contributor CANNOT approve their own milestone!
   * Automatically records a MILESTONE_APPROVED event in the Escrow Ledger.
   */
  public static async approveMilestone(
    milestoneId: string,
    decisionNotes: string | undefined,
    actor: IUser,
    orgRole?: OrganizationRole,
  ): Promise<IMilestone> {
    const milestone = await Milestone.findById(milestoneId);
    if (!milestone) {
      throw new MilestoneError(
        "Milestone not found.",
        404,
        "MILESTONE_NOT_FOUND",
      );
    }

    const bounty = await Bounty.findById(milestone.bountyId);
    if (!bounty) {
      throw new MilestoneError(
        "Associated bounty not found.",
        404,
        "BOUNTY_NOT_FOUND",
      );
    }

    // Security check: Contributor cannot approve their own milestone
    if (
      bounty.assignedContributorId &&
      bounty.assignedContributorId.toString() === actor._id.toString()
    ) {
      throw new MilestoneError(
        "Security Violation: Contributors cannot self-approve their own milestones.",
        403,
        "CONTRIBUTOR_SELF_APPROVAL_PROHIBITED",
      );
    }

    const isGlobalAdmin = actor.role === "ADMIN";
    const isOrgSponsorOrOwner = orgRole === "OWNER" || orgRole === "SPONSOR";

    if (!isGlobalAdmin && !isOrgSponsorOrOwner) {
      throw new MilestoneError(
        "Access Denied: Only organization sponsors or owners can approve milestones.",
        403,
        "FORBIDDEN_MILESTONE_APPROVE",
      );
    }

    if (milestone.status === "APPROVED") {
      throw new MilestoneError(
        "Milestone is already approved.",
        400,
        "ALREADY_APPROVED",
      );
    }

    milestone.status = "APPROVED";
    milestone.approvedBy = actor._id;
    milestone.approvedAt = new Date();
    milestone.completedAt = new Date();
    milestone.decisionNotes = decisionNotes?.trim() || "Approved by sponsor";

    await milestone.save();

    // Append-only ledger record for milestone approval
    const milestoneRewardFloat = parseFloat(milestone.rewardAmount.toString());
    await LedgerService.recordEvent({
      bountyId: bounty._id,
      organizationId: bounty.organizationId,
      eventType: "MILESTONE_APPROVED",
      amount: milestoneRewardFloat,
      currency: "USD",
      direction: "INTERNAL",
      status: "COMPLETED",
      relatedMilestoneId: milestone._id,
      idempotencyKey: `milestone_approval_${milestone._id}_${milestone.approvedAt.getTime()}`,
      description: `Milestone #${milestone.order} "${milestone.title}" approved by @${actor.username}`,
      metadata: {
        milestoneOrder: milestone.order,
        milestoneTitle: milestone.title,
        approvedBy: actor.username,
        decisionNotes: milestone.decisionNotes,
      },
      createdBy: actor._id,
    });

    // Trigger safe PayPal milestone payout lifecycle (Task 2D)
    try {
      if (bounty.fundingStatus === "FUNDED" || bounty.fundingStatus === "PARTIALLY_DISBURSED") {
        await PayoutService.executeMilestonePayout(milestone._id, actor);
      } else {
        milestone.payoutStatus = "UNPAID";
        await milestone.save();
      }
    } catch (payoutErr: any) {
      console.warn(`[MilestoneService] Milestone payout deferred/queued: ${payoutErr.message}`);
    }

    return milestone;
  }

  /**
   * Requests changes on a submitted milestone.
   * Actor must be organization OWNER, SPONSOR, or global ADMIN.
   */
  public static async requestChanges(
    milestoneId: string,
    decisionNotes: string,
    actor: IUser,
    orgRole?: OrganizationRole,
  ): Promise<IMilestone> {
    const milestone = await Milestone.findById(milestoneId);
    if (!milestone) {
      throw new MilestoneError(
        "Milestone not found.",
        404,
        "MILESTONE_NOT_FOUND",
      );
    }

    const bounty = await Bounty.findById(milestone.bountyId);
    if (!bounty) {
      throw new MilestoneError(
        "Associated bounty not found.",
        404,
        "BOUNTY_NOT_FOUND",
      );
    }

    // Security check: Contributor cannot request changes on their own milestone
    if (
      bounty.assignedContributorId &&
      bounty.assignedContributorId.toString() === actor._id.toString()
    ) {
      throw new MilestoneError(
        "Security Violation: Contributors cannot review their own milestones.",
        403,
        "CONTRIBUTOR_SELF_REVIEW_PROHIBITED",
      );
    }

    const isGlobalAdmin = actor.role === "ADMIN";
    const isOrgSponsorOrOwner = orgRole === "OWNER" || orgRole === "SPONSOR";

    if (!isGlobalAdmin && !isOrgSponsorOrOwner) {
      throw new MilestoneError(
        "Access Denied: Only organization sponsors or owners can request changes on milestones.",
        403,
        "FORBIDDEN_MILESTONE_REVIEW",
      );
    }

    if (milestone.status === "APPROVED") {
      throw new MilestoneError(
        "Cannot request changes on an already approved milestone.",
        400,
        "ALREADY_APPROVED",
      );
    }

    milestone.status = "IN_PROGRESS";
    milestone.decisionNotes = decisionNotes.trim();

    await milestone.save();
    return milestone;
  }
}
