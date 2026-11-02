import mongoose from "mongoose";
import { Bounty, IBounty } from "../models/Bounty";
import {
  Milestone,
  IMilestone,
  MilestonePayoutStatus,
} from "../models/Milestone";
import { User, IUser } from "../models/User";
import { EscrowLedger } from "../models/EscrowLedger";
import { LedgerService } from "../bounties/ledger.service";
import { PayPalClient, getPayPalClient } from "./client";
import { CreatePayoutPayload, PayoutBatchResponse } from "./types";

export class PayoutError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: any;

  constructor(
    message: string,
    status = 400,
    code = "PAYOUT_ERROR",
    details?: any,
  ) {
    super(message);
    this.name = "PayoutError";
    this.status = status;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, PayoutError.prototype);
  }
}

/**
 * Exact integer-cents conversion helper
 */
export function toCents(
  amount: mongoose.Types.Decimal128 | number | string | undefined,
): number {
  if (amount === undefined || amount === null) return 0;
  if (typeof amount === "number") {
    return Math.round(amount * 100);
  }
  if (typeof amount === "string") {
    return Math.round(parseFloat(amount) * 100);
  }
  if (typeof (amount as any).toString === "function") {
    return Math.round(parseFloat((amount as any).toString()) * 100);
  }
  return 0;
}

/**
 * Masks recipient PayPal email for privacy compliance (c***r@domain.com)
 */
export function maskEmail(email?: string): string {
  if (!email || typeof email !== "string") return "";
  const trimmed = email.trim().toLowerCase();
  const atIdx = trimmed.indexOf("@");
  if (atIdx === -1) return "***";
  const local = trimmed.substring(0, atIdx);
  const domain = trimmed.substring(atIdx + 1);
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

export class PayoutService {
  /**
   * Calculates available funded allocation in integer cents:
   * available = fundedAmountCents - disbursedAmountCents - reservedAmountCents
   */
  public static getAvailableAllocationCents(bounty: IBounty): number {
    const funded =
      bounty.fundedAmountCents || toCents(bounty.fundedAmount) || 0;
    const disbursed =
      bounty.disbursedAmountCents || toCents(bounty.disbursedAmount) || 0;
    const reserved =
      bounty.reservedAmountCents || toCents(bounty.reservedAmount) || 0;
    return Math.max(0, funded - disbursed - reserved);
  }

  /**
   * Atomically reserves funding allocation on the bounty document.
   * Prevents two concurrent milestones from over-allocating funds.
   */
  public static async reserveAllocation(
    bountyId: string | mongoose.Types.ObjectId,
    amountCents: number,
  ): Promise<boolean> {
    if (amountCents <= 0) return true;

    const updated = await Bounty.findOneAndUpdate(
      {
        _id: bountyId,
        fundingStatus: { $in: ["FUNDED", "PARTIALLY_DISBURSED"] },
        $expr: {
          $gte: [
            {
              $subtract: [
                {
                  $subtract: [
                    { $ifNull: ["$fundedAmountCents", 0] },
                    { $ifNull: ["$disbursedAmountCents", 0] },
                  ],
                },
                { $ifNull: ["$reservedAmountCents", 0] },
              ],
            },
            amountCents,
          ],
        },
      },
      {
        $inc: { reservedAmountCents: amountCents },
      },
      { new: true },
    );

    if (updated) {
      updated.reservedAmount = mongoose.Types.Decimal128.fromString(
        (updated.reservedAmountCents / 100).toFixed(2),
      );
      await updated.save();
      return true;
    }

    return false;
  }

  /**
   * Releases an allocation reservation if a payout fails or cannot be queued.
   */
  public static async releaseAllocation(
    bountyId: string | mongoose.Types.ObjectId,
    amountCents: number,
  ): Promise<void> {
    if (amountCents <= 0) return;

    const updated = await Bounty.findOneAndUpdate(
      { _id: bountyId },
      {
        $inc: { reservedAmountCents: -amountCents },
      },
      { new: true },
    );

    if (updated) {
      const clamped = Math.max(0, updated.reservedAmountCents || 0);
      updated.reservedAmountCents = clamped;
      updated.reservedAmount = mongoose.Types.Decimal128.fromString(
        (clamped / 100).toFixed(2),
      );
      await updated.save();
    }
  }

  /**
   * Finalizes disbursement when individual payout item reaches authoritatively confirmed SUCCESS.
   */
  public static async finalizeDisbursement(
    bountyId: string | mongoose.Types.ObjectId,
    amountCents: number,
  ): Promise<void> {
    const bounty = await Bounty.findById(bountyId);
    if (!bounty) return;

    const newDisbursedCents = (bounty.disbursedAmountCents || 0) + amountCents;
    const newReservedCents = Math.max(
      0,
      (bounty.reservedAmountCents || 0) - amountCents,
    );
    const fundedCents = bounty.fundedAmountCents || 0;
    const newFundingStatus =
      newDisbursedCents >= fundedCents
        ? "FULLY_DISBURSED"
        : "PARTIALLY_DISBURSED";

    await Bounty.findOneAndUpdate(
      { _id: bountyId },
      {
        $set: {
          disbursedAmountCents: newDisbursedCents,
          disbursedAmount: mongoose.Types.Decimal128.fromString(
            (newDisbursedCents / 100).toFixed(2),
          ),
          reservedAmountCents: newReservedCents,
          reservedAmount: mongoose.Types.Decimal128.fromString(
            (newReservedCents / 100).toFixed(2),
          ),
          fundingStatus: newFundingStatus,
        },
      },
    );
  }

  /**
   * Executes milestone payout with durable attempt creation, persisted idempotency,
   * atomic reservation, append-only ledger tracking, and authoritative status reconciliation.
   */
  public static async executeMilestonePayout(
    milestoneId: string | mongoose.Types.ObjectId,
    actor: IUser,
    options?: { paypalClient?: PayPalClient },
  ): Promise<{
    milestone: IMilestone;
    status: MilestonePayoutStatus;
    transactionId?: string;
  }> {
    const milestone = await Milestone.findById(milestoneId);
    if (!milestone) {
      throw new PayoutError("Milestone not found.", 404, "MILESTONE_NOT_FOUND");
    }

    const bounty = await Bounty.findById(milestone.bountyId);
    if (!bounty) {
      throw new PayoutError(
        "Associated bounty not found.",
        404,
        "BOUNTY_NOT_FOUND",
      );
    }

    // Deliverable Guard: Payout requires sponsor-approved milestone
    if (milestone.status !== "APPROVED") {
      throw new PayoutError(
        `Cannot execute payout: Milestone deliverable status is "${milestone.status}", must be "APPROVED".`,
        400,
        "MILESTONE_NOT_APPROVED",
      );
    }

    // Completion Guard: Already paid
    if (milestone.payoutStatus === "SUCCESS") {
      return {
        milestone,
        status: "SUCCESS",
        transactionId: milestone.payoutTransactionId,
      };
    }

    // Uncertain State Guard: If currently PROCESSING or UNCERTAIN, reconcile with PayPal authoritative API first
    if (
      milestone.payoutStatus === "PROCESSING" ||
      milestone.payoutStatus === "UNCERTAIN"
    ) {
      const reconciled = await this.reconcileUncertainPayout(
        milestone._id,
        options,
      );
      if (reconciled.payoutStatus === "SUCCESS") {
        return {
          milestone: reconciled,
          status: "SUCCESS",
          transactionId: reconciled.payoutTransactionId,
        };
      }
      if (
        reconciled.payoutStatus === "PROCESSING" ||
        reconciled.payoutStatus === "UNCERTAIN"
      ) {
        throw new PayoutError(
          `Milestone payout is currently ${reconciled.payoutStatus.toLowerCase()} with PayPal. Please wait for completion or authoritative reconciliation.`,
          409,
          "PAYOUT_IN_PROGRESS",
        );
      }
      // If reconciled to FAILED, proceed to allow retry
    }

    // Funding Guard: Bounty must be funded by sponsor
    if (
      bounty.fundingStatus !== "FUNDED" &&
      bounty.fundingStatus !== "PARTIALLY_DISBURSED"
    ) {
      milestone.payoutStatus = "UNPAID";
      await milestone.save();
      throw new PayoutError(
        `Cannot disburse payout: Bounty is not funded by sponsor. Current funding status: ${bounty.fundingStatus}.`,
        400,
        "UNFUNDED_BOUNTY",
      );
    }

    // Recipient Resolution & Privacy Guard
    if (!bounty.assignedContributorId) {
      throw new PayoutError(
        "Cannot disburse payout: No contributor assigned to this bounty.",
        400,
        "NO_ASSIGNED_CONTRIBUTOR",
      );
    }

    const contributor = await User.findById(bounty.assignedContributorId);
    if (
      !contributor ||
      !contributor.paypalEmail ||
      !contributor.paypalEmail.trim()
    ) {
      milestone.payoutStatus = "AWAITING_PAYOUT_INFO";
      await milestone.save();
      throw new PayoutError(
        "Contributor has not configured a payout PayPal email address. Payout queued awaiting payout info.",
        400,
        "AWAITING_PAYOUT_INFO",
      );
    }

    const milestoneAmountCents = toCents(milestone.rewardAmount);
    if (milestoneAmountCents <= 0) {
      throw new PayoutError(
        "Milestone reward amount must be greater than zero.",
        400,
        "INVALID_REWARD_AMOUNT",
      );
    }

    // Atomic Allocation Reservation Guard
    const reserved = await this.reserveAllocation(
      bounty._id,
      milestoneAmountCents,
    );
    if (!reserved) {
      const availableCents = this.getAvailableAllocationCents(bounty);
      throw new PayoutError(
        `Insufficient available funded allocation ($${(availableCents / 100).toFixed(2)}) for milestone payout ($${(
          milestoneAmountCents / 100
        ).toFixed(2)}).`,
        400,
        "INSUFFICIENT_FUNDED_ALLOCATION",
      );
    }

    // Atomic Milestone Lock: Transition milestone into PROCESSING state atomically
    // to prevent two concurrent executions from both entering payout dispatch
    const lockedMilestone = await Milestone.findOneAndUpdate(
      {
        _id: milestone._id,
        status: "APPROVED",
        payoutStatus: {
          $in: ["UNPAID", "FAILED", "AWAITING_PAYOUT_INFO", "UNCERTAIN"],
        },
      },
      {
        $set: { payoutStatus: "PROCESSING" },
      },
      { new: true },
    );

    if (!lockedMilestone) {
      await this.releaseAllocation(bounty._id, milestoneAmountCents);
      const current = await Milestone.findById(milestoneId);
      if (current?.payoutStatus === "SUCCESS") {
        return {
          milestone: current,
          status: "SUCCESS",
          transactionId: current.payoutTransactionId,
        };
      }
      throw new PayoutError(
        `Milestone payout is locked in "${current?.payoutStatus || "UNKNOWN"}" state by another concurrent request.`,
        409,
        "PAYOUT_LOCKED",
      );
    }

    // Durable Attempt & Idempotency Setup (Persisted BEFORE contacting PayPal)
    const currentAttempt = (lockedMilestone.payoutAttempts || 0) + 1;
    const senderBatchId = `gitescrow_batch_${lockedMilestone._id}_att${currentAttempt}`;
    const idempotencyKey =
      lockedMilestone.idempotencyKey &&
      (lockedMilestone.payoutStatus === "PROCESSING" ||
        lockedMilestone.payoutStatus === "UNCERTAIN")
        ? lockedMilestone.idempotencyKey
        : `gitescrow_payout_${lockedMilestone._id}_att${currentAttempt}_${Date.now()}`;

    lockedMilestone.payoutStatus = "PROCESSING";
    lockedMilestone.idempotencyKey = idempotencyKey;
    lockedMilestone.payoutSenderBatchId = senderBatchId;
    lockedMilestone.payoutAttempts = currentAttempt;
    lockedMilestone.payoutReceiverEmail = contributor.paypalEmail
      .toLowerCase()
      .trim();
    lockedMilestone.payoutError = undefined;
    await lockedMilestone.save();

    // Record Append-Only Ledger Event: PAYOUT_INITIATED (DEBIT, PENDING)
    await LedgerService.recordEvent({
      bountyId: bounty._id,
      organizationId: bounty.organizationId,
      eventType: "PAYOUT_INITIATED",
      amount: parseFloat(lockedMilestone.rewardAmount.toString()),
      currency: "USD",
      direction: "DEBIT",
      status: "PENDING",
      relatedMilestoneId: lockedMilestone._id,
      idempotencyKey: `payout_init_${idempotencyKey}`,
      description: `Payout attempt #${currentAttempt} initiated for milestone #${lockedMilestone.order} to ${maskEmail(
        contributor.paypalEmail,
      )}`,
      metadata: {
        milestoneId: lockedMilestone._id.toString(),
        milestoneOrder: lockedMilestone.order,
        attempt: currentAttempt,
        idempotencyKey,
        senderBatchId,
        receiverEmailMasked: maskEmail(contributor.paypalEmail),
      },
      createdBy: actor._id,
    });

    const client = options?.paypalClient || getPayPalClient();

    // Dispatch to PayPal Payouts v1 REST API
    const payoutPayload: CreatePayoutPayload = {
      sender_batch_header: {
        sender_batch_id: senderBatchId,
        email_subject: `GitEscrow: Payout for Milestone #${lockedMilestone.order} "${lockedMilestone.title}"`,
        email_message: `You have received a bounty milestone payout from GitEscrow for completing: ${lockedMilestone.title}.`,
      },
      items: [
        {
          recipient_type: "EMAIL",
          amount: {
            currency: "USD",
            value: (milestoneAmountCents / 100).toFixed(2),
          },
          receiver: contributor.paypalEmail.toLowerCase().trim(),
          note: `GitEscrow Milestone #${lockedMilestone.order} payout: ${lockedMilestone.title}`,
          sender_item_id: lockedMilestone._id.toString(),
        },
      ],
    };

    let createResponse: any;
    try {
      createResponse = await client.createPayout(payoutPayload, idempotencyKey);
    } catch (err: any) {
      console.error(`[PayoutService] PayPal createPayout failed:`, err.message);

      // Save durable failure state without wiping attempt keys
      lockedMilestone.payoutError = {
        name: err.name || "PayPalRequestError",
        message: err.message,
        debugId: err.debugId,
        timestamp: new Date(),
        details: err.details || err.rawBody,
      };

      // If uncertain network timeout or reset, DO NOT release allocation; transition to UNCERTAIN for authoritative reconciliation
      if (
        err.message &&
        (err.message.includes("timeout") ||
          err.message.includes("ETIMEDOUT") ||
          err.message.includes("ECONNRESET") ||
          err.name === "AbortError")
      ) {
        lockedMilestone.payoutStatus = "UNCERTAIN";
        await lockedMilestone.save();
        throw new PayoutError(
          `Payout request timed out. Status is uncertain and preserved for authoritative reconciliation.`,
          504,
          "PAYOUT_NETWORK_TIMEOUT",
          { debugId: err.debugId },
        );
      }

      // Authoritative synchronous rejection (e.g. 400 Bad Request, invalid account)
      lockedMilestone.payoutStatus = "FAILED";
      await lockedMilestone.save();
      await this.releaseAllocation(bounty._id, milestoneAmountCents);

      await LedgerService.recordEvent({
        bountyId: bounty._id,
        organizationId: bounty.organizationId,
        eventType: "PAYMENT_FAILED",
        amount: parseFloat(lockedMilestone.rewardAmount.toString()),
        currency: "USD",
        direction: "INTERNAL",
        status: "FAILED",
        relatedMilestoneId: lockedMilestone._id,
        idempotencyKey: `payout_fail_${idempotencyKey}`,
        description: `Payout attempt #${currentAttempt} rejected by PayPal: ${err.message}`,
        metadata: {
          error: err.message,
          debugId: err.debugId,
          details: err.details,
        },
        createdBy: actor._id,
      });

      throw new PayoutError(
        `PayPal payout request failed: ${err.message}`,
        err.status || 500,
        "PAYOUT_DISPATCH_FAILED",
        { debugId: err.debugId },
      );
    }

    const batchId = createResponse.batch_header.payout_batch_id;
    lockedMilestone.payoutBatchId = batchId;
    await lockedMilestone.save();

    // Authoritative Item Verification:
    // HTTP 201 indicates the batch was queued; query getPayoutBatch to check authoritative item status
    let batchDetails: PayoutBatchResponse;
    try {
      batchDetails = await client.getPayoutBatch(batchId);
    } catch (fetchErr: any) {
      console.warn(
        `[PayoutService] Batch created (${batchId}) but initial getPayoutBatch query failed: ${fetchErr.message}`,
      );
      return {
        milestone: lockedMilestone,
        status: "PROCESSING",
      };
    }

    const item =
      batchDetails.items?.find(
        (i: any) => i.sender_item_id === lockedMilestone._id.toString(),
      ) || (batchDetails.items && batchDetails.items[0]);
    const itemStatus = item?.transaction_status;

    if (itemStatus === "SUCCESS" && item?.transaction_id) {
      // Payment authoritatively completed!
      lockedMilestone.payoutStatus = "SUCCESS";
      lockedMilestone.payoutItemId = item.payout_item_id;
      lockedMilestone.payoutTransactionId = item.transaction_id;
      lockedMilestone.payoutDisbursedAt = new Date();
      await lockedMilestone.save();

      await this.finalizeDisbursement(bounty._id, milestoneAmountCents);

      await LedgerService.recordEvent({
        bountyId: bounty._id,
        organizationId: bounty.organizationId,
        eventType: "PAYOUT_COMPLETED",
        amount: parseFloat(lockedMilestone.rewardAmount.toString()),
        currency: "USD",
        direction: "DEBIT",
        status: "COMPLETED",
        relatedMilestoneId: lockedMilestone._id,
        idempotencyKey: `payout_comp_${lockedMilestone._id}_${item.transaction_id}`,
        description: `Payout completed for milestone #${lockedMilestone.order} ($${(
          milestoneAmountCents / 100
        ).toFixed(2)}) via PayPal transaction ${item.transaction_id}`,
        metadata: {
          payoutBatchId: batchId,
          payoutItemId: item.payout_item_id,
          payoutTransactionId: item.transaction_id,
          fee: item.payout_item_fee,
          receiver: maskEmail(contributor.paypalEmail),
        },
        createdBy: actor._id,
      });

      return {
        milestone: lockedMilestone,
        status: "SUCCESS",
        transactionId: item.transaction_id,
      };
    }

    if (
      itemStatus === "FAILED" ||
      itemStatus === "BLOCKED" ||
      batchDetails.batch_header.batch_status === "DENIED"
    ) {
      lockedMilestone.payoutStatus = "FAILED";
      lockedMilestone.payoutError = {
        name: "PayPalItemStatusDenied",
        message: `PayPal item status: ${itemStatus || batchDetails.batch_header.batch_status}`,
        timestamp: new Date(),
        details: item?.errors,
      };
      await lockedMilestone.save();
      await this.releaseAllocation(bounty._id, milestoneAmountCents);

      await LedgerService.recordEvent({
        bountyId: bounty._id,
        organizationId: bounty.organizationId,
        eventType: "PAYMENT_FAILED",
        amount: parseFloat(lockedMilestone.rewardAmount.toString()),
        currency: "USD",
        direction: "INTERNAL",
        status: "FAILED",
        relatedMilestoneId: lockedMilestone._id,
        idempotencyKey: `payout_fail_${idempotencyKey}`,
        description: `Payout attempt #${currentAttempt} rejected by PayPal: ${itemStatus || "DENIED"}`,
        metadata: {
          batchId,
          itemId: item?.payout_item_id,
          itemErrors: item?.errors,
        },
        createdBy: actor._id,
      });

      throw new PayoutError(
        `PayPal denied or failed payout item: ${itemStatus || "DENIED"}`,
        400,
        "PAYOUT_ITEM_DENIED",
        item?.errors,
      );
    }

    if (itemStatus === "UNCLAIMED") {
      lockedMilestone.payoutStatus = "UNCLAIMED";
      lockedMilestone.payoutItemId = item?.payout_item_id;
      await lockedMilestone.save();
      return { milestone: lockedMilestone, status: "UNCLAIMED" };
    }

    // Default: PENDING / PROCESSING (will be reconciled via webhook or authoritative query)
    return {
      milestone: lockedMilestone,
      status: "PROCESSING",
    };
  }

  /**
   * Authoritatively reconciles an uncertain or processing payout against PayPal REST API.
   * If batch ID is missing (e.g. crash or timeout before persistence), replays with the
   * exact same idempotencyKey and senderBatchId to retrieve the authoritative batch without duplicate charges.
   * Never marks an uncertain payout FAILED merely to retry.
   */
  public static async reconcileUncertainPayout(
    milestoneId: string | mongoose.Types.ObjectId,
    options?: { paypalClient?: PayPalClient },
  ): Promise<IMilestone> {
    const milestone = await Milestone.findById(milestoneId);
    if (!milestone) {
      throw new PayoutError("Milestone not found.", 404, "MILESTONE_NOT_FOUND");
    }

    if (milestone.payoutStatus === "SUCCESS") {
      return milestone;
    }

    const client = options?.paypalClient || getPayPalClient();
    let batchDetails: PayoutBatchResponse | null = null;

    // 1. Direct query if batch ID is known
    if (milestone.payoutBatchId) {
      try {
        batchDetails = await client.getPayoutBatch(milestone.payoutBatchId);
      } catch (err: any) {
        console.warn(
          `[PayoutService] reconcileUncertainPayout query failed for batch ${milestone.payoutBatchId}: ${err.message}`,
        );
        // Provider unavailable: RETAIN explicit UNCERTAIN state, DO NOT mark FAILED!
        if (milestone.payoutStatus === "PROCESSING") {
          milestone.payoutStatus = "UNCERTAIN";
          await milestone.save();
        }
        return milestone;
      }
    } else if (
      milestone.idempotencyKey &&
      (milestone.payoutStatus === "PROCESSING" ||
        milestone.payoutStatus === "UNCERTAIN")
    ) {
      // 2. Missing batchId (crash or timeout before batch ID could be saved):
      // Replay createPayout using the EXACT SAME idempotencyKey and sender_batch_id.
      // PayPal returns HTTP 200/201 with the original batch details.
      const milestoneAmountCents = toCents(milestone.rewardAmount);
      const replayPayload: CreatePayoutPayload = {
        sender_batch_header: {
          sender_batch_id:
            milestone.payoutSenderBatchId ||
            `gitescrow_batch_${milestone._id}_att${milestone.payoutAttempts || 1}`,
          email_subject: `GitEscrow: Payout for Milestone #${milestone.order}`,
          email_message: `Payout reconciliation replay.`,
        },
        items: [
          {
            recipient_type: "EMAIL",
            amount: {
              currency: "USD",
              value: (milestoneAmountCents / 100).toFixed(2),
            },
            receiver: milestone.payoutReceiverEmail || "unknown@domain.com",
            sender_item_id: milestone._id.toString(),
          },
        ],
      };

      try {
        const replayRes = await client.createPayout(
          replayPayload,
          milestone.idempotencyKey,
        );
        if (replayRes?.batch_header?.payout_batch_id) {
          milestone.payoutBatchId = replayRes.batch_header.payout_batch_id;
          await milestone.save();
          batchDetails = await client.getPayoutBatch(milestone.payoutBatchId);
        }
      } catch (replayErr: any) {
        console.warn(
          `[PayoutService] Replay createPayout failed during reconciliation: ${replayErr.message}`,
        );
        // Provider is ambiguous: RETAIN explicit UNCERTAIN state. NEVER mark FAILED!
        milestone.payoutStatus = "UNCERTAIN";
        milestone.payoutError = {
          name: "ReconciliationAmbiguous",
          message: `Provider status could not be established: ${replayErr.message}`,
          timestamp: new Date(),
        };
        await milestone.save();
        return milestone;
      }
    }

    if (!batchDetails) {
      return milestone;
    }

    const bounty = await Bounty.findById(milestone.bountyId);
    if (!bounty) return milestone;

    const milestoneAmountCents = toCents(milestone.rewardAmount);
    const item =
      batchDetails.items?.find(
        (i: any) => i.sender_item_id === milestone._id.toString(),
      ) || (batchDetails.items && batchDetails.items[0]);
    const itemStatus = item?.transaction_status;

    if (itemStatus === "SUCCESS" && item?.transaction_id) {
      milestone.payoutStatus = "SUCCESS";
      milestone.payoutItemId = item.payout_item_id;
      milestone.payoutTransactionId = item.transaction_id;
      milestone.payoutDisbursedAt = new Date();
      milestone.payoutError = undefined;
      await milestone.save();

      await this.finalizeDisbursement(bounty._id, milestoneAmountCents);

      await LedgerService.recordEvent({
        bountyId: bounty._id,
        organizationId: bounty.organizationId,
        eventType: "PAYOUT_COMPLETED",
        amount: parseFloat(milestone.rewardAmount.toString()),
        currency: "USD",
        direction: "DEBIT",
        status: "COMPLETED",
        relatedMilestoneId: milestone._id,
        idempotencyKey: `payout_comp_${milestone._id}_${item.transaction_id}`,
        description: `Authoritative reconciliation confirmed payout for milestone #${milestone.order} ($${(
          milestoneAmountCents / 100
        ).toFixed(2)}) via transaction ${item.transaction_id}`,
        metadata: {
          payoutBatchId: milestone.payoutBatchId,
          payoutItemId: item.payout_item_id,
          payoutTransactionId: item.transaction_id,
          reconciledAuthoritatively: true,
        },
      });
      return milestone;
    }

    if (
      itemStatus === "FAILED" ||
      itemStatus === "BLOCKED" ||
      batchDetails.batch_header.batch_status === "DENIED"
    ) {
      if (milestone.payoutStatus !== "FAILED") {
        milestone.payoutStatus = "FAILED";
        milestone.payoutError = {
          name: "ReconciliationFailed",
          message: `Authoritative status confirmed failed: ${itemStatus || batchDetails.batch_header.batch_status}`,
          timestamp: new Date(),
          details: item?.errors,
        };
        await milestone.save();
        await this.releaseAllocation(bounty._id, milestoneAmountCents);

        await LedgerService.recordEvent({
          bountyId: bounty._id,
          organizationId: bounty.organizationId,
          eventType: "PAYMENT_FAILED",
          amount: parseFloat(milestone.rewardAmount.toString()),
          currency: "USD",
          direction: "INTERNAL",
          status: "FAILED",
          relatedMilestoneId: milestone._id,
          idempotencyKey: `payout_fail_${milestone._id}_reconciled_${Date.now()}`,
          description: `Authoritative reconciliation confirmed failed payout for milestone #${milestone.order}`,
          metadata: {
            batchId: milestone.payoutBatchId,
            reconciledAuthoritatively: true,
          },
        });
      }
      return milestone;
    }

    if (itemStatus === "UNCLAIMED") {
      milestone.payoutStatus = "UNCLAIMED";
      milestone.payoutItemId = item?.payout_item_id;
      await milestone.save();
      return milestone;
    }

    if (
      itemStatus === "PENDING" ||
      batchDetails.batch_header.batch_status === "PENDING" ||
      batchDetails.batch_header.batch_status === "PROCESSING"
    ) {
      milestone.payoutStatus = "PROCESSING";
      await milestone.save();
      return milestone;
    }

    return milestone;
  }

  /**
   * Retries a failed or unclaimed payout with a fresh idempotency attempt.
   * Enforces that the prior attempt has authoritatively been confirmed FAILED before generating a new attempt.
   */
  public static async retryMilestonePayout(
    milestoneId: string | mongoose.Types.ObjectId,
    actor: IUser,
    options?: { paypalClient?: PayPalClient },
  ): Promise<{ milestone: IMilestone; status: MilestonePayoutStatus }> {
    const milestone = await Milestone.findById(milestoneId);
    if (!milestone) {
      throw new PayoutError("Milestone not found.", 404, "MILESTONE_NOT_FOUND");
    }

    if (milestone.payoutStatus === "SUCCESS") {
      throw new PayoutError(
        "Milestone payout has already completed successfully.",
        400,
        "ALREADY_PAID",
      );
    }

    if (
      milestone.payoutStatus === "PROCESSING" ||
      milestone.payoutStatus === "UNCERTAIN"
    ) {
      const reconciled = await this.reconcileUncertainPayout(
        milestone._id,
        options,
      );
      if (reconciled.payoutStatus === "SUCCESS") {
        return { milestone: reconciled, status: "SUCCESS" };
      }
      if (
        reconciled.payoutStatus === "PROCESSING" ||
        reconciled.payoutStatus === "UNCERTAIN"
      ) {
        throw new PayoutError(
          "Payout attempt is currently unresolved. Reconcile with provider before retrying.",
          409,
          "PAYOUT_UNRESOLVED",
        );
      }
    }

    if (milestone.payoutStatus !== "FAILED") {
      throw new PayoutError(
        `Only FAILED payouts can be retried. Current status is "${milestone.payoutStatus}".`,
        400,
        "CANNOT_RETRY_PAYOUT",
      );
    }

    // Reset attempt fields only after authoritative confirmation that prior attempt failed
    milestone.idempotencyKey = undefined;
    milestone.payoutBatchId = undefined;
    milestone.payoutSenderBatchId = undefined;
    milestone.payoutStatus = "UNPAID";
    await milestone.save();

    return this.executeMilestonePayout(milestone._id, actor, options);
  }
}
