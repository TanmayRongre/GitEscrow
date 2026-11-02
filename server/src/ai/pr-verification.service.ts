import { Milestone, IMilestone } from "../models/Milestone";
import { Bounty } from "../models/Bounty";
import { Organization } from "../models/Organization";
import { IUser } from "../models/User";
import { PREvidenceService } from "../github/pr-evidence.service";
import { AIAnalysisClient } from "./client";
import {
  AcceptanceVerificationResult,
  SubmitMilestonePRRequest,
  ReviewMilestoneRequest,
} from "./pr-verification.types";
import { LedgerService } from "../bounties/ledger.service";
import { PayoutService } from "../paypal/payout.service";

export class PRVerificationError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public errorCode: string = "PR_VERIFICATION_ERROR",
  ) {
    super(message);
    this.name = "PRVerificationError";
  }
}

export class PRVerificationService {
  private static aiClient: AIAnalysisClient = new AIAnalysisClient();

  /**
   * Parse a GitHub Pull Request URL into owner, repo, and pullNumber
   */
  public static parsePRUrl(prUrl: string): {
    owner: string;
    repo: string;
    pullNumber: number;
  } {
    const match = prUrl.match(
      /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/i,
    );
    if (!match) {
      throw new PRVerificationError(
        "Invalid GitHub Pull Request URL. Expected format: https://github.com/:owner/:repo/pull/:number",
        400,
        "INVALID_PR_URL",
      );
    }
    return {
      owner: match[1],
      repo: match[2],
      pullNumber: parseInt(match[3], 10),
    };
  }

  /**
   * Contributor submits PR against a milestone and receives automated AI verification report
   */
  public static async submitPRForMilestone(
    milestoneId: string,
    payload: SubmitMilestonePRRequest,
    actor: IUser,
  ): Promise<{
    milestone: IMilestone;
    verification: AcceptanceVerificationResult;
  }> {
    const milestone = await Milestone.findById(milestoneId);
    if (!milestone) {
      throw new PRVerificationError(
        "Milestone not found.",
        404,
        "MILESTONE_NOT_FOUND",
      );
    }

    const bounty = await Bounty.findById(milestone.bountyId);
    if (!bounty) {
      throw new PRVerificationError(
        "Associated bounty not found.",
        404,
        "BOUNTY_NOT_FOUND",
      );
    }

    // Security Guard: Check contributor assignment
    const isAssigned =
      bounty.assignedContributorId &&
      bounty.assignedContributorId.toString() === actor._id.toString();
    const isGlobalAdmin = actor.role === "ADMIN";

    if (!isAssigned && !isGlobalAdmin) {
      throw new PRVerificationError(
        "Access Denied: Only the assigned contributor can submit deliverables for this milestone.",
        403,
        "FORBIDDEN_MILESTONE_SUBMIT",
      );
    }

    // Invariant: Approved milestones are permanently locked
    if (milestone.status === "APPROVED") {
      throw new PRVerificationError(
        "This milestone has already been approved and cannot accept new PR submissions.",
        400,
        "ALREADY_APPROVED",
      );
    }

    // Parse and validate PR URL
    const { owner, repo, pullNumber } = this.parsePRUrl(payload.prUrl);

    // Repository Mismatch Guard
    const repoOwnerMatch =
      owner.toLowerCase() === bounty.repositoryOwner.toLowerCase();
    const repoNameMatch =
      repo.toLowerCase() === bounty.repositoryName.toLowerCase();

    if (!repoOwnerMatch || !repoNameMatch) {
      throw new PRVerificationError(
        `Repository mismatch: Pull Request must belong to "${bounty.repositoryOwner}/${bounty.repositoryName}", but "${owner}/${repo}" was submitted.`,
        400,
        "REPOSITORY_MISMATCH",
      );
    }

    // Collect GitHub PR evidence
    let evidence;
    try {
      evidence = await PREvidenceService.collectPREvidence(
        owner,
        repo,
        pullNumber,
      );
    } catch (err: any) {
      if (err.status === 404 || err.message?.includes("Not Found")) {
        throw new PRVerificationError(
          `Pull Request #${pullNumber} not found in repository "${owner}/${repo}".`,
          404,
          "PR_NOT_FOUND",
        );
      }
      throw new PRVerificationError(
        `Failed to retrieve evidence from GitHub: ${err.message}`,
        err.status || 502,
        "GITHUB_FETCH_ERROR",
      );
    }

    // Run AI Acceptance Criteria Verification
    const milestoneInput = {
      id: milestone._id.toString(),
      bountyId: bounty._id.toString(),
      title: milestone.title,
      description: milestone.description,
      acceptanceCriteria: milestone.acceptanceCriteria,
    };

    const verification = await this.aiClient.verifyMilestonePR(
      milestoneInput,
      evidence,
    );

    // Update Milestone state & store PR submission metadata
    milestone.status = "SUBMITTED";
    milestone.submittedAt = new Date();
    milestone.submissionDetails =
      payload.notes?.trim() ||
      `Submitted PR #${pullNumber} for automated verification.`;
    milestone.prUrl = payload.prUrl.trim();
    milestone.prNumber = pullNumber;
    milestone.prTitle = evidence.pr.title;
    milestone.prState = evidence.pr.state === "closed" ? "closed" : "open";
    milestone.isMerged = Boolean(evidence.pr.merged || evidence.pr.merged_at);
    milestone.headSha = evidence.pr.head?.sha;
    milestone.baseBranch = evidence.pr.base?.ref;
    milestone.headBranch = evidence.pr.head?.ref;
    milestone.latestVerification = verification;

    if (!milestone.submissionHistory) {
      milestone.submissionHistory = [];
    }
    milestone.submissionHistory.push({
      submittedAt: new Date(),
      prUrl: payload.prUrl.trim(),
      prNumber: pullNumber,
      notes: payload.notes?.trim(),
      headSha: evidence.pr.head?.sha,
      assessment: verification.overallAssessment,
    });

    await milestone.save();

    // Progress bounty status if appropriate
    if (bounty.status === "ASSIGNED" || bounty.status === "IN_PROGRESS") {
      bounty.status = "SUBMITTED";
      bounty.statusHistory.push({
        fromStatus: "IN_PROGRESS",
        toStatus: "SUBMITTED",
        changedBy: actor._id,
        timestamp: new Date(),
        reason: `Contributor submitted PR #${pullNumber} for milestone #${milestone.order}`,
      });
      await bounty.save();
    }

    return {
      milestone,
      verification,
    };
  }

  /**
   * Authorized sponsor reviews milestone and makes official approval, change request, or rejection
   */
  public static async reviewMilestone(
    milestoneId: string,
    payload: ReviewMilestoneRequest,
    actor: IUser,
  ): Promise<IMilestone> {
    const milestone = await Milestone.findById(milestoneId);
    if (!milestone) {
      throw new PRVerificationError(
        "Milestone not found.",
        404,
        "MILESTONE_NOT_FOUND",
      );
    }

    const bounty = await Bounty.findById(milestone.bountyId);
    if (!bounty) {
      throw new PRVerificationError(
        "Associated bounty not found.",
        404,
        "BOUNTY_NOT_FOUND",
      );
    }

    // Security Guard: Contributor CANNOT review their own milestone!
    if (
      bounty.assignedContributorId &&
      bounty.assignedContributorId.toString() === actor._id.toString()
    ) {
      throw new PRVerificationError(
        "Security Violation: Contributors cannot review or approve their own milestones.",
        403,
        "CONTRIBUTOR_SELF_REVIEW_PROHIBITED",
      );
    }

    // RBAC: Verify sponsor, owner, or admin privileges
    let isAuthorized = actor.role === "ADMIN";
    if (!isAuthorized) {
      const org = await Organization.findOne({
        _id: bounty.organizationId,
        "members.userId": actor._id,
      });
      if (org) {
        const membership = org.members.find(
          (m) => m.userId.toString() === actor._id.toString(),
        );
        if (membership && ["OWNER", "SPONSOR"].includes(membership.role)) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      throw new PRVerificationError(
        "Access Denied: Only organization sponsors or owners can review milestone submissions.",
        403,
        "FORBIDDEN_MILESTONE_REVIEW",
      );
    }

    if (milestone.status === "APPROVED") {
      throw new PRVerificationError(
        "Milestone is already approved and locked.",
        400,
        "ALREADY_APPROVED",
      );
    }

    if (payload.action === "APPROVE") {
      milestone.status = "APPROVED";
      milestone.approvedBy = actor._id;
      milestone.approvedAt = new Date();
      milestone.decisionNotes = payload.decisionNotes.trim();
      await milestone.save();

      // Record immutable audit ledger event
      await LedgerService.recordEvent({
        bountyId: bounty._id,
        organizationId: bounty.organizationId,
        eventType: "MILESTONE_APPROVED",
        amount: parseFloat(milestone.rewardAmount.toString()),
        currency: "USD",
        direction: "INTERNAL",
        status: "COMPLETED",
        relatedMilestoneId: milestone._id,
        idempotencyKey: `milestone_approval_${milestone._id}_${milestone.approvedAt.getTime()}`,
        description: `Milestone #${milestone.order} "${milestone.title}" approved by @${actor.username}`,
        metadata: {
          approvedBy: actor.username,
          rewardAmount: parseFloat(milestone.rewardAmount.toString()),
          prNumber: milestone.prNumber,
          prUrl: milestone.prUrl,
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
        console.warn(`[PRVerificationService] Milestone payout deferred/queued: ${payoutErr.message}`);
      }

      // Check if all milestones for this bounty are approved
      const allMilestones = await Milestone.find({ bountyId: bounty._id });
      const allApproved = allMilestones.every((m) => m.status === "APPROVED");
      if (allApproved) {
        const oldBountyStatus = bounty.status;
        bounty.status = "COMPLETED";
        bounty.statusHistory.push({
          fromStatus: oldBountyStatus,
          toStatus: "COMPLETED",
          changedBy: actor._id,
          timestamp: new Date(),
          reason: "All milestone deliverables approved by sponsor.",
        });
        await bounty.save();
      }
    } else if (payload.action === "REQUEST_CHANGES") {
      milestone.status = "IN_PROGRESS";
      milestone.decisionNotes = payload.decisionNotes.trim();
      await milestone.save();

      bounty.statusHistory.push({
        fromStatus: bounty.status,
        toStatus: "IN_PROGRESS",
        changedBy: actor._id,
        timestamp: new Date(),
        reason: `Changes requested on milestone #${milestone.order}: ${payload.decisionNotes.trim()}`,
      });
      await bounty.save();
    } else if (payload.action === "REJECT") {
      milestone.status = "REJECTED";
      milestone.decisionNotes = payload.decisionNotes.trim();
      milestone.rejectionReason = payload.decisionNotes.trim();
      await milestone.save();
    }

    return milestone;
  }
}
