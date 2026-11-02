import mongoose from "mongoose";
import { IBounty, BountyStatus } from "../models/Bounty";
import { IUser } from "../models/User";
import { OrganizationRole } from "../models/Organization";

export class BountyStateError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(
    message: string,
    status = 400,
    code = "INVALID_STATE_TRANSITION",
  ) {
    super(message);
    this.name = "BountyStateError";
    this.status = status;
    this.code = code;
    Object.setPrototypeOf(this, BountyStateError.prototype);
  }
}

export class BountyStateService {
  /**
   * Allowed state transition graph.
   */
  private static readonly ALLOWED_TRANSITIONS: Record<
    BountyStatus,
    BountyStatus[]
  > = {
    DRAFT: ["OPEN", "CANCELLED"],
    OPEN: ["ASSIGNED", "CANCELLED", "EXPIRED"],
    ASSIGNED: ["IN_PROGRESS", "CANCELLED"],
    IN_PROGRESS: ["SUBMITTED", "CANCELLED"],
    SUBMITTED: ["UNDER_REVIEW"],
    UNDER_REVIEW: ["IN_PROGRESS", "COMPLETED"],
    COMPLETED: [],
    CANCELLED: [],
    EXPIRED: [],
  };

  /**
   * Checks if a transition between two statuses is permitted by the state graph.
   */
  public static canTransition(from: BountyStatus, to: BountyStatus): boolean {
    const allowed = this.ALLOWED_TRANSITIONS[from];
    return Array.isArray(allowed) && allowed.includes(to);
  }

  /**
   * Validates that the actor has the required authority to trigger the status transition.
   */
  public static validateActorPermission(
    bounty: IBounty,
    toStatus: BountyStatus,
    actor: IUser,
    orgRole?: OrganizationRole,
  ): void {
    const current = bounty.status;
    const actorIdStr = actor._id.toString();
    const isGlobalAdmin = actor.role === "ADMIN";
    const isOrgSponsorOrOwner = orgRole === "OWNER" || orgRole === "SPONSOR";
    const isAssignedContributor =
      bounty.assignedContributorId &&
      bounty.assignedContributorId.toString() === actorIdStr;

    // Rule: Contributor can NEVER approve their own work to COMPLETED
    if (toStatus === "COMPLETED") {
      if (isAssignedContributor) {
        throw new BountyStateError(
          "Security Violation: Contributors cannot approve or complete their own bounties.",
          403,
          "CONTRIBUTOR_SELF_APPROVAL_PROHIBITED",
        );
      }
      if (!isOrgSponsorOrOwner && !isGlobalAdmin) {
        throw new BountyStateError(
          "Access Denied: Only organization sponsors or owners can approve bounties to COMPLETED.",
          403,
          "UNAUTHORIZED_STATUS_CHANGE",
        );
      }
      return;
    }

    // Rule: Publishing from DRAFT to OPEN
    if (current === "DRAFT" && toStatus === "OPEN") {
      if (!isOrgSponsorOrOwner && !isGlobalAdmin) {
        throw new BountyStateError(
          "Access Denied: Only organization owners or sponsors can publish a bounty.",
          403,
          "UNAUTHORIZED_PUBLISH",
        );
      }
      return;
    }

    // Rule: Cancellation
    if (toStatus === "CANCELLED") {
      if (!isOrgSponsorOrOwner && !isGlobalAdmin) {
        throw new BountyStateError(
          "Access Denied: Only organization owners or sponsors can cancel a bounty.",
          403,
          "UNAUTHORIZED_CANCEL",
        );
      }
      return;
    }

    // Rule: Accepting OPEN bounty -> ASSIGNED
    if (current === "OPEN" && toStatus === "ASSIGNED") {
      if (bounty.assignedContributorId) {
        throw new BountyStateError(
          "This bounty is already assigned to a contributor.",
          409,
          "BOUNTY_ALREADY_ASSIGNED",
        );
      }
      return;
    }

    // Rule: Starting work (ASSIGNED -> IN_PROGRESS)
    if (current === "ASSIGNED" && toStatus === "IN_PROGRESS") {
      if (!isAssignedContributor && !isOrgSponsorOrOwner && !isGlobalAdmin) {
        throw new BountyStateError(
          "Access Denied: Only the assigned contributor can start work on this bounty.",
          403,
          "UNAUTHORIZED_START",
        );
      }
      return;
    }

    // Rule: Submitting PR (IN_PROGRESS -> SUBMITTED)
    if (current === "IN_PROGRESS" && toStatus === "SUBMITTED") {
      if (!isAssignedContributor && !isGlobalAdmin) {
        throw new BountyStateError(
          "Access Denied: Only the assigned contributor can submit deliverables.",
          403,
          "UNAUTHORIZED_SUBMIT",
        );
      }
      return;
    }

    // Rule: Requesting changes (UNDER_REVIEW -> IN_PROGRESS)
    if (current === "UNDER_REVIEW" && toStatus === "IN_PROGRESS") {
      if (!isOrgSponsorOrOwner && !isGlobalAdmin) {
        throw new BountyStateError(
          "Access Denied: Only organization sponsors or owners can request changes.",
          403,
          "UNAUTHORIZED_REQUEST_CHANGES",
        );
      }
      return;
    }

    // Rule: Review initiation (SUBMITTED -> UNDER_REVIEW)
    if (current === "SUBMITTED" && toStatus === "UNDER_REVIEW") {
      if (!isOrgSponsorOrOwner && !isGlobalAdmin) {
        throw new BountyStateError(
          "Access Denied: Only organization sponsors or owners can place a submission under review.",
          403,
          "UNAUTHORIZED_REVIEW",
        );
      }
      return;
    }
  }

  /**
   * Transitions a bounty to a new status, records an immutable audit history item,
   * updates timestamps, and persists to the database.
   */
  public static async transition(
    bounty: IBounty,
    toStatus: BountyStatus,
    actor: IUser,
    orgRole?: OrganizationRole,
    reason?: string,
  ): Promise<IBounty> {
    const fromStatus = bounty.status;

    if (fromStatus === toStatus) {
      return bounty;
    }

    // 1. Validate actor authorization FIRST so unauthorized users receive 403 Forbidden
    this.validateActorPermission(bounty, toStatus, actor, orgRole);

    // 2. Validate state machine transition graph
    if (!this.canTransition(fromStatus, toStatus)) {
      throw new BountyStateError(
        `Invalid status transition from ${fromStatus} to ${toStatus}. Allowed transitions: ${
          this.ALLOWED_TRANSITIONS[fromStatus]?.join(", ") || "none"
        }`,
        400,
        "ILLEGAL_STATUS_TRANSITION",
      );
    }

    // Apply transition side-effects
    bounty.status = toStatus;
    bounty.updatedBy = actor._id;

    if (toStatus === "OPEN" && !bounty.publishedAt) {
      bounty.publishedAt = new Date();
    }
    if (toStatus === "ASSIGNED") {
      bounty.assignedContributorId = actor._id;
      bounty.assignedAt = new Date();
      bounty.acceptedAt = new Date();
    }

    // Append audit record
    bounty.statusHistory.push({
      fromStatus,
      toStatus,
      changedBy: actor._id,
      timestamp: new Date(),
      reason:
        reason?.trim() || `Status changed from ${fromStatus} to ${toStatus}`,
    });

    await bounty.save();
    return bounty;
  }
}
