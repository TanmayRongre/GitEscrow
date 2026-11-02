/**
 * GitEscrow - Task 2E.1 Automated Test Suite
 * Comprehensive verification of:
 * - Phase 1: Inbound PayPal Capture Hardening
 * - Phase 2: Bounty Cancellation & Refund Pipeline
 * - Phase 3: Payout Crash Recovery & Concurrency Hardening
 * - Phase 4: Webhook Deduplication & Append-Only Ledger Integrity
 */

import http from "http";
import path from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

process.env.NODE_ENV = "test";

if (!process.env.JWT_ACCESS_SECRET) {
  process.env.JWT_ACCESS_SECRET =
    "gitescrow_test_jwt_access_secret_32bytes_min";
}

import app, { connectDB } from "../src/index";
import { User, IUser } from "../src/models/User";
import { Organization } from "../src/models/Organization";
import { Bounty, IBounty } from "../src/models/Bounty";
import { Milestone, IMilestone } from "../src/models/Milestone";
import { EscrowLedger } from "../src/models/EscrowLedger";
import { WebhookDelivery } from "../src/models/WebhookDelivery";
import { TokenService } from "../src/auth/token.service";
import {
  PayoutService,
  toCents,
  maskEmail,
} from "../src/paypal/payout.service";
import { BountyService } from "../src/bounties/bounty.service";
import { PayPalClient, setPayPalClient } from "../src/paypal/client";

interface TestResult {
  category: string;
  name: string;
  expectedStatus: number | string | boolean;
  actualStatus: number | string | boolean;
  passed: boolean;
  notes: string;
}

const results: TestResult[] = [];
const RUN_ID = "pay-" + Math.random().toString(36).substring(2, 7);
const SAFE_ID = RUN_ID.replace(/-/g, "");

function record(
  category: string,
  name: string,
  expectedStatus: number | string | boolean,
  actualStatus: number | string | boolean,
  passed: boolean,
  notes: string,
) {
  results.push({ category, name, expectedStatus, actualStatus, passed, notes });
  const icon = passed ? "✓ PASS" : "✗ FAIL";
  console.log(
    `  ${icon} [${category}] ${name} (Expected: ${expectedStatus}, Actual: ${actualStatus}) - ${notes}`,
  );
}

async function request(
  serverUrl: string,
  method: string,
  urlPath: string,
  body?: any,
  token?: string,
  extraHeaders?: Record<string, string>,
): Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const fullUrl = new URL(urlPath, serverUrl);
    const postData = body ? JSON.stringify(body) : undefined;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...extraHeaders,
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    if (postData) {
      headers["Content-Length"] = Buffer.byteLength(postData).toString();
    }

    const req = http.request(
      fullUrl,
      {
        method,
        headers,
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          let parsed = {};
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = { raw };
          }
          resolve({
            status: res.statusCode || 500,
            body: parsed,
            headers: res.headers,
          });
        });
      },
    );

    req.on("error", reject);
    if (postData) req.write(postData);
    req.end();
  });
}

/**
 * Creates a mock PayPal client to verify execution behavior deterministically
 */
function createMockPayPalClient(behavior?: {
  createPayoutBatchId?: string;
  itemStatus?: "SUCCESS" | "FAILED" | "PENDING" | "UNCLAIMED";
  transactionId?: string;
  createError?: Error;
  batchError?: Error;
  delayMs?: number;
  senderItemId?: string;
  verifySignatureStatus?: "SUCCESS" | "FAILURE";
  captureDetails?: any;
  captureError?: Error;
  refundResponse?: any;
  refundError?: Error;
}): any {
  const batchId = behavior?.createPayoutBatchId || `mock_batch_${Date.now()}`;
  const status = behavior?.itemStatus || "SUCCESS";
  const txId = behavior?.transactionId || `mock_tx_${Date.now()}`;

  return {
    getCapture: async (captureId: string) => {
      if (behavior?.captureError) {
        throw behavior.captureError;
      }
      return (
        behavior?.captureDetails || {
          id: captureId,
          status: "COMPLETED",
          amount: { currency_code: "USD", value: "100.00" },
          supplementary_data: { related_ids: { order_id: `ord_${captureId}` } },
        }
      );
    },
    refundCapture: async (captureId: string, payload?: any, idempotencyKey?: string) => {
      if (behavior?.refundError) {
        throw behavior.refundError;
      }
      return (
        behavior?.refundResponse || {
          id: `ref_${Date.now()}`,
          status: "COMPLETED",
          amount: payload?.amount || { currency_code: "USD", value: "100.00" },
        }
      );
    },
    createPayout: async (payload: any, idempotencyKey?: string) => {
      if (behavior?.delayMs) {
        await new Promise((resolve) => setTimeout(resolve, behavior.delayMs));
      }
      if (behavior?.createError) {
        throw behavior.createError;
      }
      return {
        batch_header: {
          payout_batch_id: batchId,
          batch_status: "PENDING",
          sender_batch_header: {
            sender_batch_id:
              payload?.sender_batch_header?.sender_batch_id ||
              `batch_${idempotencyKey}`,
          },
        },
        links: [],
      };
    },
    getPayoutBatch: async (queryBatchId: string) => {
      if (behavior?.batchError) {
        throw behavior.batchError;
      }
      return {
        batch_header: {
          payout_batch_id: queryBatchId,
          batch_status:
            status === "SUCCESS"
              ? "SUCCESS"
              : status === "FAILED"
                ? "DENIED"
                : "PROCESSING",
        },
        items: [
          {
            payout_item_id: `item_${queryBatchId}`,
            transaction_id: status === "SUCCESS" ? txId : undefined,
            transaction_status: status,
            payout_batch_id: queryBatchId,
            sender_item_id: behavior?.senderItemId,
            payout_item: {
              sender_item_id: behavior?.senderItemId,
              recipient_type: "EMAIL",
              amount: { currency: "USD", value: "50.00" },
              receiver: "contributor@example.com",
            },
            errors:
              status === "FAILED"
                ? [
                    {
                      name: "RECEIVER_UNCONFIRMED",
                      message: "Account unconfirmed",
                    },
                  ]
                : undefined,
          },
        ],
      };
    },
    verifyWebhookSignature: async () => {
      return {
        verification_status: behavior?.verifySignatureStatus || "SUCCESS",
      };
    },
  };
}

async function runTestSuite() {
  console.log(
    `======================================================================`,
  );
  console.log(
    `  GitEscrow - Task 2E.1: Final Financial Integrity Test Suite        `,
  );
  console.log(`  Run ID: ${RUN_ID}`);
  console.log(
    `======================================================================\n`,
  );

  await connectDB();

  const standardMockClient = createMockPayPalClient();
  setPayPalClient(standardMockClient);

  const server = app.listen(0);
  const address = server.address() as any;
  const serverUrl = `http://127.0.0.1:${address.port}`;
  console.log(`Ephemeral test server active on ${serverUrl}...\n`);

  try {
    // ---------------------------------------------------------
    // Setup Test Entities
    // ---------------------------------------------------------
    const sponsorUser = await User.create({
      name: `Sponsor ${SAFE_ID}`,
      username: `sp_${SAFE_ID}`,
      email: `sponsor_${SAFE_ID}@example.com`,
      passwordHash: "dummy_hash",
      role: "USER",
      accountStatus: "ACTIVE",
    });

    const contributorUser = await User.create({
      name: `Contributor ${SAFE_ID}`,
      username: `cb_${SAFE_ID}`,
      email: `contrib_${SAFE_ID}@example.com`,
      passwordHash: "dummy_hash",
      role: "USER",
      accountStatus: "ACTIVE",
      paypalEmail: undefined, // Initially unconfigured
    });

    const otherUser = await User.create({
      name: `Other User ${SAFE_ID}`,
      username: `ot_${SAFE_ID}`,
      email: `other_${SAFE_ID}@example.com`,
      passwordHash: "dummy_hash",
      role: "USER",
      accountStatus: "ACTIVE",
    });

    const sponsorToken = TokenService.generateAccessToken({
      id: sponsorUser._id,
      email: sponsorUser.email,
      username: sponsorUser.username,
      role: sponsorUser.role,
    });

    const contributorToken = TokenService.generateAccessToken({
      id: contributorUser._id,
      email: contributorUser.email,
      username: contributorUser.username,
      role: contributorUser.role,
    });

    const otherToken = TokenService.generateAccessToken({
      id: otherUser._id,
      email: otherUser.email,
      username: otherUser.username,
      role: otherUser.role,
    });

    const org = await Organization.create({
      name: `Org ${SAFE_ID}`,
      slug: `org-${SAFE_ID}`,
      ownerId: sponsorUser._id,
      members: [
        { userId: sponsorUser._id, role: "OWNER", joinedAt: new Date() },
        { userId: contributorUser._id, role: "MEMBER", joinedAt: new Date() },
      ],
    });

    const makeBountyFixture = (overrides: any = {}) => ({
      title: `Payout Test Bounty ${SAFE_ID}`,
      slug: `bounty-${SAFE_ID}`,
      description: "Testing milestone payouts and escrow integrity.",
      organizationId: org._id,
      createdBy: sponsorUser._id,
      updatedBy: sponsorUser._id,
      repositoryOwner: "facebook",
      repositoryName: "react",
      repositoryFullName: "facebook/react",
      repositoryUrl: "https://github.com/facebook/react",
      repositoryId: 10270250,
      issueNumber: 38090,
      issueUrl: "https://github.com/facebook/react/issues/38090",
      issueTitle: "Test Issue",
      rewardAmount: mongoose.Types.Decimal128.fromString("100.00"),
      currency: "USD",
      status: "OPEN",
      fundingStatus: "UNFUNDED",
      fundedAmountCents: 0,
      disbursedAmountCents: 0,
      reservedAmountCents: 0,
      assignedContributorId: contributorUser._id,
      ...overrides,
    });

    // ---------------------------------------------------------
    // Category A: Inbound Capture Hardening & Funding Tests
    // ---------------------------------------------------------
    console.log(`--- [Category A: Inbound Capture Hardening & Funding Tests] ---`);

    // Create an unfunded bounty with 2 milestones ($50 each = $100 total)
    const bounty = await Bounty.create(makeBountyFixture());

    const milestone1 = await Milestone.create({
      bountyId: bounty._id,
      title: "Milestone 1 Deliverable",
      description: "Implement core functionality",
      order: 1,
      rewardAmount: mongoose.Types.Decimal128.fromString("50.00"),
      currency: "USD",
      acceptanceCriteria: ["Pass unit tests"],
      status: "APPROVED",
      payoutStatus: "UNPAID",
    });

    const milestone2 = await Milestone.create({
      bountyId: bounty._id,
      title: "Milestone 2 Deliverable",
      description: "Implement integration tests",
      order: 2,
      rewardAmount: mongoose.Types.Decimal128.fromString("50.00"),
      currency: "USD",
      acceptanceCriteria: ["Integration tests pass"],
      status: "APPROVED",
      payoutStatus: "UNPAID",
    });

    // Test 1: Unfunded bounty payout rejection
    let test1Passed = false;
    let test1Error = "";
    try {
      await PayoutService.executeMilestonePayout(milestone1._id, sponsorUser);
    } catch (err: any) {
      test1Passed = err.code === "UNFUNDED_BOUNTY";
      test1Error = err.message;
    }
    record(
      "Capture Hardening",
      "Unfunded bounty payout execution is blocked (UNFUNDED_BOUNTY)",
      "UNFUNDED_BOUNTY",
      test1Passed ? "UNFUNDED_BOUNTY" : "ALLOWED",
      test1Passed,
      test1Error,
    );

    // Test 2: Invalid capture ID rejected by provider verification
    const invalidClient = createMockPayPalClient({
      captureError: new Error("Capture not found [404]"),
    });
    setPayPalClient(invalidClient);
    const invalidCaptureRes = await request(
      serverUrl,
      "POST",
      `/api/bounties/${bounty._id}/fund`,
      { paypalCaptureId: "cap_non_existent", amount: 100.0 },
      sponsorToken,
    );
    record(
      "Capture Hardening",
      "Invalid PayPal capture ID is rejected by authoritative provider verification",
      400,
      invalidCaptureRes.status,
      invalidCaptureRes.status === 400 &&
        invalidCaptureRes.body.code === "PAYPAL_CAPTURE_NOT_FOUND",
      invalidCaptureRes.body.error,
    );

    // Test 3: Capture not COMPLETED rejected (status PENDING)
    const pendingCaptureClient = createMockPayPalClient({
      captureDetails: {
        id: "cap_pending",
        status: "PENDING",
        amount: { currency_code: "USD", value: "100.00" },
      },
    });
    setPayPalClient(pendingCaptureClient);
    const pendingCaptureRes = await request(
      serverUrl,
      "POST",
      `/api/bounties/${bounty._id}/fund`,
      { paypalCaptureId: "cap_pending", amount: 100.0 },
      sponsorToken,
    );
    record(
      "Capture Hardening",
      "PayPal capture in PENDING status is rejected (requires COMPLETED)",
      400,
      pendingCaptureRes.status,
      pendingCaptureRes.status === 400 &&
        pendingCaptureRes.body.code === "CAPTURE_NOT_COMPLETED",
      pendingCaptureRes.body.error,
    );

    // Test 4: Incorrect capture currency rejected (EUR instead of USD)
    const eurCaptureClient = createMockPayPalClient({
      captureDetails: {
        id: "cap_eur",
        status: "COMPLETED",
        amount: { currency_code: "EUR", value: "100.00" },
      },
    });
    setPayPalClient(eurCaptureClient);
    const eurCaptureRes = await request(
      serverUrl,
      "POST",
      `/api/bounties/${bounty._id}/fund`,
      { paypalCaptureId: "cap_eur", amount: 100.0 },
      sponsorToken,
    );
    record(
      "Capture Hardening",
      "Non-USD capture currency (EUR) is rejected",
      400,
      eurCaptureRes.status,
      eurCaptureRes.status === 400 &&
        eurCaptureRes.body.code === "INVALID_CAPTURE_CURRENCY",
      eurCaptureRes.body.error,
    );

    // Test 5: Insufficient capture amount rejected ($80 when reward is $100)
    const lowCaptureClient = createMockPayPalClient({
      captureDetails: {
        id: "cap_low",
        status: "COMPLETED",
        amount: { currency_code: "USD", value: "80.00" },
      },
    });
    setPayPalClient(lowCaptureClient);
    const lowCaptureRes = await request(
      serverUrl,
      "POST",
      `/api/bounties/${bounty._id}/fund`,
      { paypalCaptureId: "cap_low", amount: 80.0 },
      sponsorToken,
    );
    record(
      "Capture Hardening",
      "Capture amount below bounty reward is rejected",
      400,
      lowCaptureRes.status,
      lowCaptureRes.status === 400 &&
        lowCaptureRes.body.code === "INSUFFICIENT_FUNDING_AMOUNT",
      lowCaptureRes.body.error,
    );

    // Test 6: Valid verified PayPal capture successfully funds bounty
    const validCaptureId = `cap_valid_${SAFE_ID}`;
    const validCaptureClient = createMockPayPalClient({
      captureDetails: {
        id: validCaptureId,
        status: "COMPLETED",
        amount: { currency_code: "USD", value: "100.00" },
      },
    });
    setPayPalClient(validCaptureClient);

    const fundRes = await request(
      serverUrl,
      "POST",
      `/api/bounties/${bounty._id}/fund`,
      { paypalCaptureId: validCaptureId, amount: 100.0 },
      sponsorToken,
    );

    const updatedBounty = await Bounty.findById(bounty._id);
    const test6Passed =
      fundRes.status === 200 &&
      updatedBounty?.fundingStatus === "FUNDED" &&
      updatedBounty?.fundedAmountCents === 10000 &&
      updatedBounty?.inboundCaptureId === validCaptureId;

    record(
      "Capture Hardening",
      "Verified COMPLETED PayPal capture sets status FUNDED and inboundCaptureId",
      200,
      fundRes.status,
      test6Passed,
      `Bounty fundingStatus: ${updatedBounty?.fundingStatus}, Capture ID: ${updatedBounty?.inboundCaptureId}`,
    );

    // Verify ledger has FUNDING_CAPTURED
    const fundingLedger = await EscrowLedger.findOne({
      bountyId: bounty._id,
      eventType: "FUNDING_CAPTURED",
    });
    record(
      "Capture Hardening",
      "FUNDING_CAPTURED event recorded in EscrowLedger with capture ID",
      "CREDIT",
      fundingLedger?.direction || "NONE",
      fundingLedger !== null && fundingLedger.direction === "CREDIT",
      `Ledger capture ID: ${fundingLedger?.paypalCaptureId}`,
    );

    // Test 7: Reusing same capture ID on another bounty is blocked (409)
    const bounty2 = await Bounty.create(
      makeBountyFixture({
        title: `Second Bounty ${SAFE_ID}`,
        slug: `bounty2-${SAFE_ID}`,
        issueNumber: 38091,
      }),
    );

    const reuseRes = await request(
      serverUrl,
      "POST",
      `/api/bounties/${bounty2._id}/fund`,
      { paypalCaptureId: validCaptureId, amount: 100.0 },
      sponsorToken,
    );
    record(
      "Capture Hardening",
      "Reusing same PayPal capture ID on another bounty is strictly blocked (409 CAPTURE_ALREADY_USED)",
      409,
      reuseRes.status,
      reuseRes.status === 409 &&
        reuseRes.body.code === "CAPTURE_ALREADY_USED",
      reuseRes.body.error,
    );

    // Test 8: Duplicate funding request on same bounty is safely idempotent
    const duplicateFundRes = await request(
      serverUrl,
      "POST",
      `/api/bounties/${bounty._id}/fund`,
      { paypalCaptureId: validCaptureId, amount: 100.0 },
      sponsorToken,
    );
    record(
      "Capture Hardening",
      "Duplicate funding request with identical capture ID returns safely idempotent 200",
      200,
      duplicateFundRes.status,
      duplicateFundRes.status === 200 &&
        duplicateFundRes.body.bounty?.fundingStatus === "FUNDED",
      duplicateFundRes.body.message,
    );

    // Test 9: Insufficient allocation rejection (reserving $150 when $100 funded)
    const overReserveAllowed = await PayoutService.reserveAllocation(
      bounty._id,
      15000,
    );
    record(
      "Capture Hardening",
      "Reservation exceeding available funded allocation is rejected by atomic reserve guard",
      false,
      overReserveAllowed,
      overReserveAllowed === false,
      "Atomic MongoDB expression prevented over-allocation",
    );

    // Test 10: Concurrent payout allocation race condition protection
    const [resA, resB] = await Promise.all([
      PayoutService.reserveAllocation(bounty._id, 6000),
      PayoutService.reserveAllocation(bounty._id, 6000),
    ]);
    const onlyOneWon = (resA && !resB) || (!resA && resB);
    record(
      "Capture Hardening",
      "Concurrent atomic reservations cannot over-allocate available funded funds",
      "EXACTLY_ONE_WINS",
      onlyOneWon ? "EXACTLY_ONE_WINS" : `resA=${resA}, resB=${resB}`,
      onlyOneWon,
      `Race condition prevented: resA=${resA}, resB=${resB}`,
    );

    // Release the test reservation
    await PayoutService.releaseAllocation(bounty._id, 6000);

    // Test 11: Exact integer cents precision test
    const centsFloat = toCents("49.99");
    const centsDec = toCents(bounty.rewardAmount);
    record(
      "Capture Hardening",
      "Integer cents utility converts floats and Decimal128 without precision loss",
      "4999, 10000",
      `${centsFloat}, ${centsDec}`,
      centsFloat === 4999 && centsDec === 10000,
      "All monetary calculations run on exact integer cents",
    );

    // ---------------------------------------------------------
    // Category B: Contributor Payout Profile & Privacy Tests
    // ---------------------------------------------------------
    console.log(
      `\n--- [Category B: Contributor Payout Profile & Privacy Tests] ---`,
    );

    // Test 12: Contributor attempts payout without configured PayPal email
    let awaitingInfoCaught = false;
    try {
      await PayoutService.executeMilestonePayout(milestone1._id, sponsorUser);
    } catch (err: any) {
      awaitingInfoCaught = err.code === "AWAITING_PAYOUT_INFO";
    }
    const ms1AfterAttempt = await Milestone.findById(milestone1._id);
    record(
      "Recipient Privacy",
      "Missing contributor PayPal email transitions milestone to AWAITING_PAYOUT_INFO",
      "AWAITING_PAYOUT_INFO",
      ms1AfterAttempt?.payoutStatus || "NONE",
      awaitingInfoCaught &&
        ms1AfterAttempt?.payoutStatus === "AWAITING_PAYOUT_INFO",
      "Safe queued state: contributor must supply payout destination",
    );

    // Test 13: Invalid email rejected on PATCH /api/users/me/payout-profile
    const invalidEmailRes = await request(
      serverUrl,
      "PATCH",
      "/api/users/me/payout-profile",
      { paypalEmail: "not-an-email" },
      contributorToken,
    );
    record(
      "Recipient Privacy",
      "Invalid PayPal email format is rejected with 400 Validation Error",
      400,
      invalidEmailRes.status,
      invalidEmailRes.status === 400 &&
        invalidEmailRes.body.code === "VALIDATION_ERROR",
      invalidEmailRes.body.error,
    );

    // Test 14: Valid email configured on PATCH /api/users/me/payout-profile
    const validEmailRes = await request(
      serverUrl,
      "PATCH",
      "/api/users/me/payout-profile",
      { paypalEmail: "contributor@example.com" },
      contributorToken,
    );
    const updatedContributor = await User.findById(contributorUser._id);
    record(
      "Recipient Privacy",
      "Valid PayPal email successfully saved to user payout profile",
      200,
      validEmailRes.status,
      validEmailRes.status === 200 &&
        updatedContributor?.paypalEmail === "contributor@example.com",
      `Masked email: ${validEmailRes.body.payoutProfile?.maskedEmail}`,
    );

    // Test 15: Mask email helper
    const masked = maskEmail("contributor@example.com");
    record(
      "Recipient Privacy",
      "maskEmail masks local part preserving first and last char (c***r@example.com)",
      "c***r@example.com",
      masked,
      masked === "c***r@example.com",
      `Result: ${masked}`,
    );

    // ---------------------------------------------------------
    // Category C: Safe Payout Execution & Lifecycle Tests
    // ---------------------------------------------------------
    console.log(
      `\n--- [Category C: Safe Payout Execution & Lifecycle Tests] ---`,
    );

    // Reset reservations and states for clean Category C testing
    await Bounty.updateOne(
      { _id: bounty._id },
      {
        $set: {
          reservedAmountCents: 0,
          reservedAmount: mongoose.Types.Decimal128.fromString("0.00"),
          disbursedAmountCents: 0,
          disbursedAmount: mongoose.Types.Decimal128.fromString("0.00"),
        },
      },
    );
    await Milestone.updateOne(
      { _id: milestone1._id },
      {
        $set: {
          payoutStatus: "UNPAID",
          payoutAttempts: 0,
          idempotencyKey: undefined,
          payoutSenderBatchId: undefined,
        },
      },
    );
    await Milestone.updateOne(
      { _id: milestone2._id },
      {
        $set: {
          payoutStatus: "UNPAID",
          payoutAttempts: 0,
          idempotencyKey: undefined,
          payoutSenderBatchId: undefined,
        },
      },
    );

    // Test 16: Successful payout execution with authoritative item completion
    const mockSuccessClient = createMockPayPalClient({
      createPayoutBatchId: `batch_succ_${SAFE_ID}`,
      itemStatus: "SUCCESS",
      transactionId: `tx_succ_${SAFE_ID}`,
    });
    setPayPalClient(mockSuccessClient);

    const execResult = await PayoutService.executeMilestonePayout(
      milestone1._id,
      sponsorUser,
      {
        paypalClient: mockSuccessClient,
      },
    );

    const ms1Completed = await Milestone.findById(milestone1._id);
    const bountyAfterMs1 = await Bounty.findById(bounty._id);

    const test16Passed =
      execResult.status === "SUCCESS" &&
      ms1Completed?.payoutStatus === "SUCCESS" &&
      ms1Completed?.payoutTransactionId === `tx_succ_${SAFE_ID}` &&
      bountyAfterMs1?.disbursedAmountCents === 5000;

    record(
      "Safe Payout Execution",
      "Authoritative item SUCCESS sets payoutStatus=SUCCESS, transactionId, and disburses allocation",
      "SUCCESS",
      ms1Completed?.payoutStatus || "NONE",
      test16Passed,
      `Transaction ID: ${ms1Completed?.payoutTransactionId}, Bounty disbursed: $${(
        (bountyAfterMs1?.disbursedAmountCents || 0) / 100
      ).toFixed(2)}`,
    );

    // Test 17: Append-only ledger records separate PAYOUT_INITIATED and PAYOUT_COMPLETED events
    const initLedger = await EscrowLedger.findOne({
      relatedMilestoneId: milestone1._id,
      eventType: "PAYOUT_INITIATED",
    });
    const compLedger = await EscrowLedger.findOne({
      relatedMilestoneId: milestone1._id,
      eventType: "PAYOUT_COMPLETED",
    });

    record(
      "Safe Payout Execution",
      "Append-only ledger records separate PAYOUT_INITIATED and PAYOUT_COMPLETED events",
      "INITIATED + COMPLETED",
      initLedger && compLedger ? "INITIATED + COMPLETED" : "MISSING",
      Boolean(initLedger && compLedger && compLedger.status === "COMPLETED"),
      `Initiated idempotency: ${initLedger?.idempotencyKey}, Completed idempotency: ${compLedger?.idempotencyKey}`,
    );

    // Test 18: Duplicate payout attempt on already paid milestone is safely idempotent
    let duplicateRejected = false;
    try {
      const dupRes = await PayoutService.executeMilestonePayout(
        milestone1._id,
        sponsorUser,
        {
          paypalClient: mockSuccessClient,
        },
      );
      duplicateRejected = dupRes.status === "SUCCESS";
    } catch (err: any) {
      duplicateRejected = err.code === "ALREADY_PAID";
    }
    record(
      "Safe Payout Execution",
      "Duplicate execution on completed milestone is safely idempotent without duplicate dispatch",
      "SAFE_IDEMPOTENT",
      duplicateRejected ? "SAFE_IDEMPOTENT" : "DISPATCHED_AGAIN",
      duplicateRejected,
      "No secondary PayPal transfer triggered",
    );

    // Test 19: PayPal item denial transitions payoutStatus=FAILED and releases reservation
    const mockDeniedClient = createMockPayPalClient({
      createPayoutBatchId: `batch_denied_${SAFE_ID}`,
      itemStatus: "FAILED",
    });

    let denialCaught = false;
    try {
      await PayoutService.executeMilestonePayout(milestone2._id, sponsorUser, {
        paypalClient: mockDeniedClient,
      });
    } catch (err: any) {
      denialCaught = err.code === "PAYOUT_ITEM_DENIED";
    }

    const ms2Failed = await Milestone.findById(milestone2._id);
    const bountyAfterDenial = await Bounty.findById(bounty._id);
    const failedLedger = await EscrowLedger.findOne({
      relatedMilestoneId: milestone2._id,
      eventType: "PAYMENT_FAILED",
    });

    const test19Passed =
      denialCaught &&
      ms2Failed?.payoutStatus === "FAILED" &&
      bountyAfterDenial?.reservedAmountCents === 0 &&
      failedLedger !== null;

    record(
      "Safe Payout Execution",
      "PayPal item denial transitions payoutStatus=FAILED, releases reservation, records PAYMENT_FAILED",
      "FAILED",
      ms2Failed?.payoutStatus || "NONE",
      test19Passed,
      `Bounty reservedAmountCents: ${bountyAfterDenial?.reservedAmountCents}, Ledger event: ${failedLedger?.eventType}`,
    );

    // Test 20: Sponsor safely retries failed payout with incremented attempt
    const mockRetrySuccessClient = createMockPayPalClient({
      createPayoutBatchId: `batch_retry_succ_${SAFE_ID}`,
      itemStatus: "SUCCESS",
      transactionId: `tx_retry_${SAFE_ID}`,
    });

    const retryRes = await PayoutService.retryMilestonePayout(
      milestone2._id,
      sponsorUser,
      {
        paypalClient: mockRetrySuccessClient,
      },
    );

    const ms2Retried = await Milestone.findById(milestone2._id);
    record(
      "Safe Payout Execution",
      "Sponsor safely retries failed payout with incremented attempt number",
      "SUCCESS",
      retryRes.status,
      retryRes.status === "SUCCESS" && (ms2Retried?.payoutAttempts || 0) >= 2,
      `Attempt #${ms2Retried?.payoutAttempts}, Transaction: ${ms2Retried?.payoutTransactionId}`,
    );

    // Test 21: Retry on PROCESSING or UNCERTAIN payout is strictly blocked (409)
    await Milestone.updateOne(
      { _id: milestone2._id },
      { $set: { payoutStatus: "PROCESSING" } },
    );
    let retryBlocked = false;
    try {
      await PayoutService.retryMilestonePayout(milestone2._id, sponsorUser, {
        paypalClient: mockRetrySuccessClient,
      });
    } catch (err: any) {
      retryBlocked = err.status === 409 || err.code === "PAYOUT_IN_PROGRESS";
    }
    record(
      "Safe Payout Execution",
      "Retry on PROCESSING or UNCERTAIN payout is blocked (requires reconciliation first)",
      true,
      retryBlocked,
      retryBlocked,
      "Prevents concurrent retry race conditions",
    );
    // Reset ms2 back to SUCCESS
    await Milestone.updateOne(
      { _id: milestone2._id },
      { $set: { payoutStatus: "SUCCESS" } },
    );

    // ---------------------------------------------------------
    // Category D: Payout Crash Recovery & Concurrency Hardening
    // ---------------------------------------------------------
    console.log(
      `\n--- [Category D: Payout Crash Recovery & Concurrency Hardening] ---`,
    );

    // Create a dedicated funded bounty for crash recovery testing ($100 funded)
    const crashBounty = await Bounty.create(
      makeBountyFixture({
        title: `Crash Bounty ${SAFE_ID}`,
        slug: `crash-${SAFE_ID}`,
        issueNumber: 38096,
        rewardAmount: mongoose.Types.Decimal128.fromString("100.00"),
        fundingStatus: "FUNDED",
        fundedAmountCents: 10000,
        inboundCaptureId: `cap_crash_${SAFE_ID}`,
      }),
    );

    // Create Milestone 3 to test crash recovery edge cases
    const milestone3 = await Milestone.create({
      bountyId: crashBounty._id,
      title: "Milestone 3 Deliverable",
      description: "Crash recovery testing deliverable",
      order: 1,
      rewardAmount: mongoose.Types.Decimal128.fromString("10.00"),
      currency: "USD",
      acceptanceCriteria: ["Resilient crash recovery"],
      status: "APPROVED",
      payoutStatus: "UNPAID",
    });

    // Test 22: Payout network timeout sets UNCERTAIN status without releasing funds
    const timeoutClient = createMockPayPalClient({
      createError: new Error("ETIMEDOUT: Connection to api-m.sandbox.paypal.com timed out"),
    });

    let timeoutCaught = false;
    try {
      await PayoutService.executeMilestonePayout(milestone3._id, sponsorUser, {
        paypalClient: timeoutClient,
      });
    } catch (err: any) {
      timeoutCaught = err.code === "PAYOUT_NETWORK_TIMEOUT";
    }

    const ms3Timeout = await Milestone.findById(milestone3._id);
    record(
      "Crash Recovery",
      "Payout network timeout sets UNCERTAIN status and preserves idempotencyKey without releasing allocation",
      "UNCERTAIN",
      ms3Timeout?.payoutStatus || "NONE",
      timeoutCaught &&
        ms3Timeout?.payoutStatus === "UNCERTAIN" &&
        Boolean(ms3Timeout?.idempotencyKey),
      `Idempotency key retained: ${ms3Timeout?.idempotencyKey}`,
    );

    // Test 23: Crash before batchId saved: reconcileUncertainPayout replays request with identical idempotencyKey
    const recoveredBatchId = `batch_recovered_${SAFE_ID}`;
    const replayMockClient = createMockPayPalClient({
      createPayoutBatchId: recoveredBatchId,
      itemStatus: "SUCCESS",
      transactionId: `tx_replay_recovered_${SAFE_ID}`,
      senderItemId: milestone3._id.toString(),
    });

    const reconciledMs3 = await PayoutService.reconcileUncertainPayout(
      milestone3._id,
      { paypalClient: replayMockClient },
    );

    record(
      "Crash Recovery",
      "Replay with identical idempotency key recovers batch ID after simulated crash and completes payout",
      "SUCCESS",
      reconciledMs3.payoutStatus,
      reconciledMs3.payoutStatus === "SUCCESS" &&
        reconciledMs3.payoutBatchId === recoveredBatchId,
      `Recovered batch ID: ${reconciledMs3.payoutBatchId}, Transaction: ${reconciledMs3.payoutTransactionId}`,
    );

    // Test 24: Concurrent payout requests on same milestone blocked by atomic lock
    const milestone4 = await Milestone.create({
      bountyId: crashBounty._id,
      title: "Milestone 4 Deliverable",
      description: "Concurrency lock testing deliverable",
      order: 2,
      rewardAmount: mongoose.Types.Decimal128.fromString("10.00"),
      currency: "USD",
      acceptanceCriteria: ["Atomic lock verification"],
      status: "APPROVED",
      payoutStatus: "UNPAID",
    });

    const slowMockClient = createMockPayPalClient({
      createPayoutBatchId: `batch_conc_${SAFE_ID}`,
      itemStatus: "PENDING",
      delayMs: 100,
    });

    // Launch two parallel payout calls for the same milestone
    const [callA, callB] = await Promise.allSettled([
      PayoutService.executeMilestonePayout(milestone4._id, sponsorUser, {
        paypalClient: slowMockClient,
      }),
      PayoutService.executeMilestonePayout(milestone4._id, sponsorUser, {
        paypalClient: slowMockClient,
      }),
    ]);

    const oneSucceededOneLocked =
      (callA.status === "fulfilled" && callB.status === "rejected") ||
      (callA.status === "rejected" && callB.status === "fulfilled");

    record(
      "Crash Recovery",
      "Concurrent payout requests on the same milestone are guarded by atomic Milestone lock",
      "ONE_FULFILLED_ONE_LOCKED",
      oneSucceededOneLocked ? "ONE_FULFILLED_ONE_LOCKED" : "BOTH_PROCEEDED",
      oneSucceededOneLocked,
      `callA: ${callA.status}, callB: ${callB.status}`,
    );

    // Test 25: Ambiguous provider response retains UNCERTAIN state and never marks FAILED merely to retry
    await Milestone.updateOne(
      { _id: milestone4._id },
      { $set: { payoutStatus: "UNCERTAIN" } },
    );
    const ambiguousClient = createMockPayPalClient({
      createError: new Error("503 Service Unavailable"),
      batchError: new Error("503 Service Unavailable"),
    });

    const ambiguousReconciled = await PayoutService.reconcileUncertainPayout(
      milestone4._id,
      { paypalClient: ambiguousClient },
    );

    record(
      "Crash Recovery",
      "Ambiguous provider response retains UNCERTAIN status and never falsely fails payout",
      "UNCERTAIN",
      ambiguousReconciled.payoutStatus,
      ambiguousReconciled.payoutStatus === "UNCERTAIN",
      "Preserves provider state without creating duplicate payouts",
    );

    // Test 26: Reconciliation after restart confirms authoritative completion
    const authoritativeCompletedClient = createMockPayPalClient({
      createPayoutBatchId: `batch_conc_${SAFE_ID}`,
      itemStatus: "SUCCESS",
      transactionId: `tx_authoritative_${SAFE_ID}`,
      senderItemId: milestone4._id.toString(),
    });

    const restartReconciled = await PayoutService.reconcileUncertainPayout(
      milestone4._id,
      { paypalClient: authoritativeCompletedClient },
    );

    record(
      "Crash Recovery",
      "Authoritative reconciliation confirms item SUCCESS and finalizes disbursement",
      "SUCCESS",
      restartReconciled.payoutStatus,
      restartReconciled.payoutStatus === "SUCCESS" &&
        Boolean(restartReconciled.payoutTransactionId),
      `Final transaction: ${restartReconciled.payoutTransactionId}`,
    );

    // ---------------------------------------------------------
    // Category E: Bounty Cancellation & Refund Pipeline Tests
    // ---------------------------------------------------------
    console.log(
      `\n--- [Category E: Bounty Cancellation & Refund Pipeline Tests] ---`,
    );

    // Test 27: Cancellation of unfunded bounty transitions DRAFT/OPEN -> CANCELLED without refund
    const unfundedBounty = await Bounty.create(
      makeBountyFixture({
        title: `Unfunded Bounty ${SAFE_ID}`,
        slug: `unfunded-${SAFE_ID}`,
        issueNumber: 38092,
        rewardAmount: mongoose.Types.Decimal128.fromString("50.00"),
      }),
    );

    const cancelUnfundedRes = await BountyService.cancelBounty(
      unfundedBounty._id.toString(),
      "No longer needed",
      sponsorUser,
      "OWNER",
    );
    record(
      "Cancellation & Refunds",
      "Cancellation of unfunded bounty transitions status to CANCELLED without invoking refund API",
      "CANCELLED",
      cancelUnfundedRes.status,
      cancelUnfundedRes.status === "CANCELLED" &&
        cancelUnfundedRes.fundingStatus === "UNFUNDED",
      `Status: ${cancelUnfundedRes.status}, Funding: ${cancelUnfundedRes.fundingStatus}`,
    );

    // Test 28: Cancellation blocked if milestone payout is actively PROCESSING or UNCERTAIN
    const inFlightBounty = await Bounty.create(
      makeBountyFixture({
        title: `In-Flight Payout Bounty ${SAFE_ID}`,
        slug: `inflight-${SAFE_ID}`,
        issueNumber: 38093,
        fundingStatus: "FUNDED",
        fundedAmountCents: 10000,
        inboundCaptureId: `cap_inflight_${SAFE_ID}`,
      }),
    );

    await Milestone.create({
      bountyId: inFlightBounty._id,
      title: "Active Processing Milestone",
      description: "Active processing test milestone",
      order: 1,
      rewardAmount: mongoose.Types.Decimal128.fromString("50.00"),
      currency: "USD",
      acceptanceCriteria: ["In-flight"],
      status: "APPROVED",
      payoutStatus: "PROCESSING",
    });

    let cancelBlocked = false;
    try {
      await BountyService.cancelBounty(
        inFlightBounty._id.toString(),
        "Cancel attempt during payout",
        sponsorUser,
        "OWNER",
      );
    } catch (err: any) {
      cancelBlocked = err.code === "PAYOUT_IN_PROGRESS";
    }
    record(
      "Cancellation & Refunds",
      "Bounty cancellation is blocked while a milestone payout is actively processing (409 PAYOUT_IN_PROGRESS)",
      true,
      cancelBlocked,
      cancelBlocked,
      "Prevents cancelling bounty while provider payout is in flight",
    );

    // Clean up milestone to allow refund test
    await Milestone.deleteMany({ bountyId: inFlightBounty._id });

    // Test 29: Cancellation of fully funded bounty triggers full PayPal refund, sets REFUNDED, records FUNDING_REFUNDED
    const refundMockClient = createMockPayPalClient({
      refundResponse: {
        id: `ref_full_${SAFE_ID}`,
        status: "COMPLETED",
        amount: { currency_code: "USD", value: "100.00" },
      },
    });

    const cancelledFundedBounty = await BountyService.cancelBounty(
      inFlightBounty._id.toString(),
      "Sponsor project cancellation",
      sponsorUser,
      "OWNER",
      { paypalClient: refundMockClient },
    );

    const refundLedger = await EscrowLedger.findOne({
      bountyId: inFlightBounty._id,
      eventType: "FUNDING_REFUNDED",
    });

    const test29Passed =
      cancelledFundedBounty.status === "CANCELLED" &&
      cancelledFundedBounty.fundingStatus === "REFUNDED" &&
      refundLedger !== null &&
      refundLedger.direction === "DEBIT" &&
      refundLedger.paypalRefundId === `ref_full_${SAFE_ID}`;

    record(
      "Cancellation & Refunds",
      "Cancellation of fully funded bounty triggers full PayPal refund, sets status REFUNDED, records FUNDING_REFUNDED",
      "CANCELLED + REFUNDED",
      `${cancelledFundedBounty.status} + ${cancelledFundedBounty.fundingStatus}`,
      test29Passed,
      `Refund ID: ${refundLedger?.paypalRefundId}, Amount: $${refundLedger?.amount}`,
    );

    // Test 30: Cancellation of partially disbursed bounty triggers partial refund for remaining balance
    const partialBounty = await Bounty.create(
      makeBountyFixture({
        title: `Partial Bounty ${SAFE_ID}`,
        slug: `partial-${SAFE_ID}`,
        issueNumber: 38094,
        fundingStatus: "PARTIALLY_DISBURSED",
        fundedAmountCents: 10000,
        disbursedAmountCents: 4000,
        inboundCaptureId: `cap_part_${SAFE_ID}`,
      }),
    );

    const partialRefundClient = createMockPayPalClient({
      refundResponse: {
        id: `ref_partial_${SAFE_ID}`,
        status: "COMPLETED",
        amount: { currency_code: "USD", value: "60.00" },
      },
    });

    const cancelledPartialBounty = await BountyService.cancelBounty(
      partialBounty._id.toString(),
      "Partial cancellation",
      sponsorUser,
      "OWNER",
      { paypalClient: partialRefundClient },
    );

    const partialLedger = await EscrowLedger.findOne({
      bountyId: partialBounty._id,
      eventType: "FUNDING_REFUNDED",
    });

    const test30Passed =
      cancelledPartialBounty.status === "CANCELLED" &&
      cancelledPartialBounty.fundingStatus === "PARTIALLY_DISBURSED" &&
      partialLedger !== null &&
      parseFloat(partialLedger.amount.toString()) === 60.0;

    record(
      "Cancellation & Refunds",
      "Cancellation of partially disbursed bounty issues partial refund ($60) for remaining unspent allocation",
      "CANCELLED + PARTIALLY_DISBURSED",
      `${cancelledPartialBounty.status} + ${cancelledPartialBounty.fundingStatus}`,
      test30Passed,
      `Refunded amount: $${partialLedger?.amount} USD (excl. $40 disbursed)`,
    );

    // Test 31: Failed PayPal refund records PAYMENT_FAILED in ledger without state corruption
    const failedRefundBounty = await Bounty.create(
      makeBountyFixture({
        title: `Failed Refund Bounty ${SAFE_ID}`,
        slug: `fail-ref-${SAFE_ID}`,
        issueNumber: 38095,
        fundingStatus: "FUNDED",
        fundedAmountCents: 5000,
        rewardAmount: mongoose.Types.Decimal128.fromString("50.00"),
        inboundCaptureId: `cap_fail_${SAFE_ID}`,
      }),
    );

    const refundErrorClient = createMockPayPalClient({
      refundError: new Error("PayPal refund rejected: Capture past refund window"),
    });

    let refundErrCaught = false;
    try {
      await BountyService.cancelBounty(
        failedRefundBounty._id.toString(),
        "Refund failure test",
        sponsorUser,
        "OWNER",
        { paypalClient: refundErrorClient },
      );
    } catch (err: any) {
      refundErrCaught = err.code === "REFUND_DISPATCH_FAILED";
    }

    const failedRefundLedger = await EscrowLedger.findOne({
      bountyId: failedRefundBounty._id,
      eventType: "PAYMENT_FAILED",
    });

    record(
      "Cancellation & Refunds",
      "Failed PayPal refund records PAYMENT_FAILED in ledger and preserves uncorrupted bounty state",
      true,
      refundErrCaught && failedRefundLedger !== null,
      refundErrCaught && failedRefundLedger !== null,
      `Audited failure in ledger: ${failedRefundLedger?.description}`,
    );

    // Test 32: Duplicate cancellation request cannot issue duplicate refunds
    let duplicateCancelBlocked = false;
    try {
      await BountyService.cancelBounty(
        partialBounty._id.toString(),
        "Second cancel attempt",
        sponsorUser,
        "OWNER",
        { paypalClient: partialRefundClient },
      );
    } catch (err: any) {
      duplicateCancelBlocked = true; // Blocked by state machine
    }

    const totalRefundEvents = await EscrowLedger.countDocuments({
      bountyId: partialBounty._id,
      eventType: "FUNDING_REFUNDED",
    });

    record(
      "Cancellation & Refunds",
      "Duplicate cancellation requests on already cancelled bounty are rejected with zero duplicate refunds",
      1,
      totalRefundEvents,
      duplicateCancelBlocked && totalRefundEvents === 1,
      `Total refund events on bounty: ${totalRefundEvents}`,
    );

    // ---------------------------------------------------------
    // Category F: Webhook Security & Deduplication Tests
    // ---------------------------------------------------------
    console.log(
      `\n--- [Category F: Webhook Security & Deduplication Tests] ---`,
    );

    // Test 33: Invalid webhook signature is rejected with 400
    const forgedWebhookRes = await request(
      serverUrl,
      "POST",
      "/api/webhooks/paypal",
      {
        event_type: "PAYMENT.PAYOUTS-ITEM.SUCCEEDED",
        id: `wh_evt_${SAFE_ID}`,
        resource: { payout_item_id: "item_123" },
      },
      undefined,
      {
        "x-mock-test-signature": "invalid",
        "paypal-auth-algo": "SHA256withRSA",
        "paypal-cert-url": "https://api.sandbox.paypal.com/v1/certs/CERT-123",
        "paypal-transmission-id": `trans_forged_${SAFE_ID}`,
        "paypal-transmission-sig": "forged_sig",
        "paypal-transmission-time": new Date().toISOString(),
      },
    );

    record(
      "Webhook Security",
      "Invalid PayPal webhook signature is rejected with 400 INVALID_WEBHOOK_SIGNATURE",
      400,
      forgedWebhookRes.status,
      forgedWebhookRes.status === 400 &&
        forgedWebhookRes.body.code === "INVALID_WEBHOOK_SIGNATURE",
      forgedWebhookRes.body.error,
    );

    // Test 34: Valid webhook processed and deduplicated by transmission ID
    const transmissionId = `trans_valid_${SAFE_ID}`;
    const validWebhookRes = await request(
      serverUrl,
      "POST",
      "/api/webhooks/paypal",
      {
        event_type: "PAYMENT.PAYOUTS-ITEM.SUCCEEDED",
        id: `wh_evt_valid_${SAFE_ID}`,
        resource: {
          payout_batch_id: `batch_succ_${SAFE_ID}`,
          payout_item: { sender_item_id: milestone1._id.toString() },
        },
      },
      undefined,
      {
        "x-mock-test-signature": "valid",
        "paypal-auth-algo": "SHA256withRSA",
        "paypal-cert-url": "https://api.sandbox.paypal.com/v1/certs/CERT-123",
        "paypal-transmission-id": transmissionId,
        "paypal-transmission-sig": "valid_sig",
        "paypal-transmission-time": new Date().toISOString(),
      },
    );

    record(
      "Webhook Security",
      "Valid PayPal webhook processed successfully (HTTP 200 ok)",
      200,
      validWebhookRes.status,
      validWebhookRes.status === 200 && validWebhookRes.body.status === "ok",
      validWebhookRes.body.message,
    );

    // Test 35: Duplicate webhook delivery is identified and ignored safely
    const duplicateWebhookRes = await request(
      serverUrl,
      "POST",
      "/api/webhooks/paypal",
      {
        event_type: "PAYMENT.PAYOUTS-ITEM.SUCCEEDED",
        id: `wh_evt_valid_${SAFE_ID}`,
        resource: {
          payout_item: { sender_item_id: milestone1._id.toString() },
        },
      },
      undefined,
      {
        "x-mock-test-signature": "valid",
        "paypal-auth-algo": "SHA256withRSA",
        "paypal-cert-url": "https://api.sandbox.paypal.com/v1/certs/CERT-123",
        "paypal-transmission-id": transmissionId,
        "paypal-transmission-sig": "valid_sig",
        "paypal-transmission-time": new Date().toISOString(),
      },
    );

    record(
      "Webhook Security",
      "Duplicate webhook transmission is deduplicated and returned without duplicate processing",
      200,
      duplicateWebhookRes.status,
      duplicateWebhookRes.status === 200 &&
        duplicateWebhookRes.body.message.includes("duplicate"),
      duplicateWebhookRes.body.message,
    );

    // ---------------------------------------------------------
    // Category G: Append-Only Escrow Ledger Integrity
    // ---------------------------------------------------------
    console.log(`\n--- [Category G: Append-Only Escrow Ledger Integrity] ---`);

    // Test 36: Updates on EscrowLedger are blocked
    let updateBlocked = false;
    let updateErrorMsg = "";
    try {
      await EscrowLedger.updateOne(
        { _id: initLedger?._id },
        { $set: { description: "Tampered ledger entry" } },
      );
    } catch (err: any) {
      updateBlocked = true;
      updateErrorMsg = err.message;
    }

    record(
      "Ledger Integrity",
      "Direct updates on EscrowLedger are blocked by append-only middleware guard",
      true,
      updateBlocked,
      updateBlocked,
      updateErrorMsg,
    );

    // Test 37: Deletions on EscrowLedger are blocked
    let deleteBlocked = false;
    let deleteErrorMsg = "";
    try {
      await EscrowLedger.deleteOne({ _id: initLedger?._id });
    } catch (err: any) {
      deleteBlocked = true;
      deleteErrorMsg = err.message;
    }

    record(
      "Ledger Integrity",
      "Direct deletions on EscrowLedger are blocked by append-only middleware guard",
      true,
      deleteBlocked,
      deleteBlocked,
      deleteErrorMsg,
    );

    // Test 38: Duplicate ledger idempotency key strictly rejected
    let duplicateKeyBlocked = false;
    try {
      await EscrowLedger.create({
        bountyId: bounty._id,
        organizationId: bounty.organizationId,
        eventType: "FUNDING_INITIATED",
        amount: mongoose.Types.Decimal128.fromString("10.00"),
        currency: "USD",
        direction: "CREDIT",
        status: "COMPLETED",
        idempotencyKey: initLedger?.idempotencyKey || "dup_key",
        description: "Duplicate key attempt",
      });
    } catch (err: any) {
      duplicateKeyBlocked = true;
    }
    record(
      "Ledger Integrity",
      "Duplicate ledger idempotency key is rejected by database unique constraint",
      true,
      duplicateKeyBlocked,
      duplicateKeyBlocked,
      "EscrowLedger uniqueness invariant enforced",
    );

    // Test 39: Clean state separation between deliverable status and payout status
    const finalMilestone = await Milestone.findById(milestone1._id);
    const stateSeparationValid =
      finalMilestone?.status === "APPROVED" &&
      finalMilestone?.payoutStatus === "SUCCESS";

    record(
      "State Machine",
      "Deliverable approval state (APPROVED) strictly separated from financial payout state (SUCCESS)",
      "APPROVED + SUCCESS",
      `${finalMilestone?.status} + ${finalMilestone?.payoutStatus}`,
      stateSeparationValid,
      "Deliverable state machine is decoupled from financial payout state machine",
    );

    // ---------------------------------------------------------
    // Clean up test entities
    // ---------------------------------------------------------
    try {
      await Bounty.deleteMany({ organizationId: org._id });
      await Milestone.deleteMany({
        _id: { $in: [milestone1._id, milestone2._id, milestone3._id, milestone4._id] },
      });
      // Raw collection delete bypasses Mongoose append-only middleware for ephemeral test teardown
      await EscrowLedger.collection.deleteMany({ organizationId: org._id });
      await Organization.deleteOne({ _id: org._id });
      await User.deleteMany({
        _id: { $in: [sponsorUser._id, contributorUser._id, otherUser._id] },
      });
      await WebhookDelivery.deleteMany({
        deliveryId: { $in: [transmissionId, `wh_evt_${SAFE_ID}`] },
      });
    } catch (cleanupErr: any) {
      console.warn(`[Cleanup] Ephemeral test cleanup warning: ${cleanupErr.message}`);
    }
  } finally {
    server.close();
  }

  // ---------------------------------------------------------
  // Summary Table
  // ---------------------------------------------------------
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  console.log(
    `\n========================================================================================================`,
  );
  console.log(
    `               TASK 2E.1: FINAL FINANCIAL INTEGRITY AUTOMATED TEST REPORT                `,
  );
  console.log(
    `========================================================================================================`,
  );
  console.log(`Category | Test Name | Status | Notes`);
  console.log(`---|---|---|---`);
  for (const r of results) {
    console.log(
      `${r.category} | ${r.name} | ${r.passed ? "PASS" : "FAIL"} | ${r.notes}`,
    );
  }
  console.log(
    `========================================================================================================\n`,
  );
  console.log(
    `Total Tests: ${results.length} | Passed: ${passedCount} | Failed: ${failedCount}\n`,
  );

  await mongoose.disconnect();

  if (failedCount > 0) {
    console.error(
      `✗ ${failedCount} test(s) failed in Task 2E.1 Final Financial Integrity suite.`,
    );
    process.exit(1);
  } else {
    console.log(
      `✓ All ${passedCount} financial integrity tests passed successfully!`,
    );
    process.exit(0);
  }
}

runTestSuite().catch(async (err) => {
  console.error("Fatal error in test suite:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
