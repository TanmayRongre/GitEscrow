import { Request } from "express";
import { WebhookDelivery } from "../models/WebhookDelivery";
import { Milestone } from "../models/Milestone";
import { Bounty } from "../models/Bounty";
import { PayoutService } from "./payout.service";
import { PayPalClient, getPayPalClient } from "./client";
import { VerifyWebhookSignaturePayload } from "./types";

export class PayPalWebhookError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(message: string, status = 400, code = "WEBHOOK_ERROR") {
    super(message);
    this.name = "PayPalWebhookError";
    this.status = status;
    this.code = code;
    Object.setPrototypeOf(this, PayPalWebhookError.prototype);
  }
}

export class PayPalWebhookService {
  /**
   * Verifies the PayPal webhook signature against PayPal's authoritative endpoint.
   * Strictly enforces:
   * 1. All 5 required PayPal signature headers are present and non-empty.
   * 2. The certificate URL uses secure HTTPS on a valid paypal.com host.
   * 3. PAYPAL_WEBHOOK_ID is configured (fails closed if missing outside test environments).
   * 4. Cryptographic validation via PayPal REST API (/v1/notifications/verify-webhook-signature)
   *    or an injected client test double.
   * 5. Absolutely NO request-controlled bypass headers (e.g. x-mock-test-signature) are accepted.
   */
  public static async verifySignature(
    req: Request,
    customClient?: PayPalClient,
  ): Promise<boolean> {
    const authAlgo = req.headers["paypal-auth-algo"];
    const certUrl = req.headers["paypal-cert-url"];
    const transmissionId = req.headers["paypal-transmission-id"];
    const transmissionSig = req.headers["paypal-transmission-sig"];
    const transmissionTime = req.headers["paypal-transmission-time"];

    // 1. Strict presence and string type validation for all required headers
    if (
      typeof authAlgo !== "string" ||
      !authAlgo.trim() ||
      typeof certUrl !== "string" ||
      !certUrl.trim() ||
      typeof transmissionId !== "string" ||
      !transmissionId.trim() ||
      typeof transmissionSig !== "string" ||
      !transmissionSig.trim() ||
      typeof transmissionTime !== "string" ||
      !transmissionTime.trim()
    ) {
      return false;
    }

    // 2. Validate cert_url protocol and hostname to prevent SSRF or rogue cert spoofing
    try {
      const parsedCertUrl = new URL(certUrl.trim());
      if (
        parsedCertUrl.protocol !== "https:" ||
        !parsedCertUrl.hostname.endsWith(".paypal.com")
      ) {
        console.warn(
          `[PayPalWebhookService] Rejected invalid or insecure cert_url: ${certUrl}`,
        );
        return false;
      }
    } catch {
      return false;
    }

    // 3. Resolve configured Webhook ID (fail closed if missing in non-test runtime)
    const webhookId = (
      process.env.PAYPAL_WEBHOOK_ID ||
      (process.env.NODE_ENV === "test" ? "TEST_MOCK_WEBHOOK_ID" : "")
    ).trim();

    if (!webhookId) {
      console.error(
        "[PayPalWebhookService] Server misconfiguration: PAYPAL_WEBHOOK_ID is not configured. Failing closed.",
      );
      return false;
    }

    // 4. Ensure request body exists and is a valid JSON object
    if (
      !req.body ||
      typeof req.body !== "object" ||
      Object.keys(req.body).length === 0
    ) {
      return false;
    }

    const payload: VerifyWebhookSignaturePayload = {
      auth_algo: authAlgo.trim(),
      cert_url: certUrl.trim(),
      transmission_id: transmissionId.trim(),
      transmission_sig: transmissionSig.trim(),
      transmission_time: transmissionTime.trim(),
      webhook_id: webhookId,
      webhook_event: req.body,
    };

    try {
      const client = customClient || getPayPalClient();
      const res = await client.verifyWebhookSignature(payload);
      return res?.verification_status === "SUCCESS";
    } catch (err: any) {
      console.error(
        "[PayPalWebhookService] Signature verification failed:",
        err.message,
      );
      return false;
    }
  }

  /**
   * Processes an incoming PayPal webhook event with signature verification,
   * deduplication, and authoritative reconciliation.
   */
  public static async processWebhook(
    req: Request,
    options?: { paypalClient?: PayPalClient },
  ): Promise<{
    status: "PROCESSED" | "DUPLICATE" | "IGNORED";
    eventType: string;
  }> {
    const event = req.body;
    if (!event || !event.event_type) {
      throw new PayPalWebhookError(
        "Invalid webhook body: event_type missing.",
        400,
        "INVALID_PAYLOAD",
      );
    }

    const eventType = event.event_type;
    const transmissionId =
      (req.headers["paypal-transmission-id"] as string) || event.id;

    // 1. Signature Verification
    const isValidSignature = await this.verifySignature(
      req,
      options?.paypalClient,
    );
    if (!isValidSignature) {
      throw new PayPalWebhookError(
        "PayPal webhook signature verification failed.",
        400,
        "INVALID_WEBHOOK_SIGNATURE",
      );
    }

    // 2. Atomic Delivery Claiming
    // Atomically claim the delivery ID using MongoDB unique constraint before executing any side effects
    const resource = event.resource || {};
    const claimDoc = {
      deliveryId: transmissionId,
      event: eventType,
      action:
        resource.transaction_status || resource.batch_status || "PROCESSING",
      sender: resource.payout_item?.receiver || "PAYPAL",
      receivedAt: new Date(),
      processed: false,
      status: "PROCESSING" as const,
      processingStartedAt: new Date(),
      attempts: 1,
      sideEffectInitiated: false,
      sideEffectCompleted: false,
      payloadSummary: {
        eventType,
        id: event.id,
        resourceId:
          resource.payout_item_id || resource.payout_batch_id || resource.id,
      },
    };

    let claimedDelivery: any = null;

    try {
      claimedDelivery = await WebhookDelivery.create(claimDoc);
    } catch (createErr: any) {
      const isDuplicateKey =
        createErr.code === 11000 ||
        (createErr.name === "MongoServerError" && createErr.code === 11000);

      if (!isDuplicateKey) {
        // Database connectivity/write error: fail closed so PayPal retries later
        throw createErr;
      }

      // Delivery already exists in DB. Check existing state.
      const existing = await WebhookDelivery.findOne({
        deliveryId: transmissionId,
      });
      if (!existing) {
        throw createErr;
      }

      // If already successfully processed, safely deduplicate
      if (existing.status === "PROCESSED" || existing.processed === true) {
        return { status: "DUPLICATE", eventType };
      }

      // If in PROCESSING state, evaluate whether it is actively in-flight or crashed/stale
      const staleTimeoutMs =
        Number(process.env.WEBHOOK_CLAIM_TIMEOUT_MS) || 15000;
      const startedAt =
        existing.processingStartedAt?.getTime() ||
        existing.receivedAt?.getTime() ||
        0;
      const isStale = Date.now() - startedAt >= staleTimeoutMs;

      // Fail closed if maximum retry attempts exceeded to avoid infinite crash loops
      if (existing.attempts && existing.attempts >= 5) {
        await WebhookDelivery.updateOne(
          { _id: existing._id },
          {
            $set: {
              status: "FAILED",
              error: "MAX_RETRY_ATTEMPTS_EXCEEDED",
            },
          },
        );
        throw new PayPalWebhookError(
          "Maximum retry attempts exceeded for webhook delivery.",
          500,
          "MAX_RETRIES_EXCEEDED",
        );
      }

      // Safe recovery check: If side effect ALREADY completed before crash, do NOT re-run!
      if (existing.sideEffectCompleted === true) {
        await WebhookDelivery.updateOne(
          { _id: existing._id },
          {
            $set: {
              processed: true,
              status: "PROCESSED",
              completedAt: new Date(),
            },
          },
        );
        return { status: "PROCESSED", eventType };
      }

      // If an external side effect might already have occurred, check entity state before blindly reclaiming
      if (existing.sideEffectInitiated === true) {
        const batchId =
          resource.payout_batch_id || resource.batch_header?.payout_batch_id;
        const senderItemId = resource.payout_item?.sender_item_id;

        let milestone = null;
        if (senderItemId) {
          milestone = await Milestone.findById(senderItemId);
        }
        if (!milestone && batchId) {
          milestone = await Milestone.findOne({ payoutBatchId: batchId });
        }

        // If the milestone is ALREADY confirmed SUCCESS, the external PayPal disbursement occurred!
        if (milestone && milestone.payoutStatus === "SUCCESS") {
          await WebhookDelivery.updateOne(
            { _id: existing._id },
            {
              $set: {
                processed: true,
                status: "PROCESSED",
                sideEffectCompleted: true,
                action: "RECOVERED_ALREADY_SUCCESS",
                completedAt: new Date(),
              },
            },
          );
          return { status: "PROCESSED", eventType };
        }
      }

      // Reclaim if FAILED or crashed/stale PROCESSING
      if (
        existing.status === "FAILED" ||
        (existing.status === "PROCESSING" && isStale)
      ) {
        const reclaimed = await WebhookDelivery.findOneAndUpdate(
          {
            deliveryId: transmissionId,
            status: { $in: ["PROCESSING", "FAILED"] },
            $or: [
              { status: "FAILED" },
              {
                processingStartedAt: {
                  $lt: new Date(Date.now() - staleTimeoutMs),
                },
              },
            ],
          },
          {
            $set: {
              status: "PROCESSING",
              processingStartedAt: new Date(),
              error: undefined,
            },
            $inc: { attempts: 1 },
          },
          { new: true },
        );

        if (reclaimed) {
          claimedDelivery = reclaimed;
        } else {
          // Another concurrent request claimed the recovery
          return { status: "DUPLICATE", eventType };
        }
      } else {
        // Actively in-flight by concurrent request: safely ignore duplicate
        return { status: "DUPLICATE", eventType };
      }
    }

    // 3. Process Authoritative Event Actions (executed ONLY by the winning claim)
    let handled = false;

    try {
      if (
        eventType.startsWith("PAYMENT.PAYOUTS-ITEM.") ||
        eventType.startsWith("PAYMENT.PAYOUTSBATCH.")
      ) {
        handled = true;
        const batchId =
          resource.payout_batch_id || resource.batch_header?.payout_batch_id;
        const senderItemId = resource.payout_item?.sender_item_id;

        let milestone = null;
        if (senderItemId) {
          milestone = await Milestone.findById(senderItemId);
        }
        if (!milestone && batchId) {
          milestone = await Milestone.findOne({ payoutBatchId: batchId });
        }

        if (milestone) {
          // If milestone is already SUCCESS, no external mutation is needed
          if (milestone.payoutStatus === "SUCCESS") {
            await WebhookDelivery.updateOne(
              { _id: claimedDelivery._id },
              { $set: { sideEffectCompleted: true } },
            );
          } else {
            // Durably record that external side effect is being initiated
            await WebhookDelivery.updateOne(
              { _id: claimedDelivery._id },
              { $set: { sideEffectInitiated: true } },
            );

            // Run authoritative status check via PayPal REST API
            await PayoutService.reconcileUncertainPayout(
              milestone._id,
              options,
            );

            // Durably record that external side effect completed
            await WebhookDelivery.updateOne(
              { _id: claimedDelivery._id },
              { $set: { sideEffectCompleted: true } },
            );
          }
        }
      }

      // 4. Mark Delivery as PROCESSED after successful side effects
      await WebhookDelivery.updateOne(
        { _id: claimedDelivery._id },
        {
          $set: {
            processed: true,
            status: "PROCESSED",
            sideEffectCompleted: true,
            action:
              resource.transaction_status ||
              resource.batch_status ||
              (handled ? "PROCESSED" : "IGNORED"),
            completedAt: new Date(),
          },
        },
      );

      return {
        status: handled ? "PROCESSED" : "IGNORED",
        eventType,
      };
    } catch (procErr: any) {
      // Mark delivery as FAILED so PayPal retries can reclaim it safely
      try {
        await WebhookDelivery.updateOne(
          { _id: claimedDelivery._id },
          {
            $set: {
              status: "FAILED",
              error: procErr.message || String(procErr),
            },
          },
        );
      } catch (markErr: any) {
        console.error(
          `[PayPalWebhookService] Failed to mark delivery as FAILED: ${markErr.message}`,
        );
      }

      // Re-throw so controller returns HTTP 500 signaling PayPal to retry
      throw procErr;
    }
  }
}
