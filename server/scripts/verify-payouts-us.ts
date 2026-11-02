import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { PayPalClient } from "../src/paypal/client";
import { PayPalError } from "../src/paypal/types";

// Load environment configuration from root .env and server/.env
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID?.trim();
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET?.trim();
const PAYPAL_BASE_URL = (
  process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com"
).trim();
const PAYPAL_SANDBOX_CONTRIBUTOR_EMAIL =
  process.env.PAYPAL_SANDBOX_CONTRIBUTOR_EMAIL?.trim() ||
  "sb-contributor@personal.example.com";

const OUTPUT_STATE_FILE = path.resolve(__dirname, ".verify-payout-state.json");

function mask(str?: string): string {
  if (!str) return "NOT_CONFIGURED";
  if (str.length <= 8) return "***";
  return `${str.substring(0, 4)}...${str.substring(str.length - 4)} (length: ${str.length})`;
}

export interface PayoutVerificationResult {
  timestamp: string;
  environment: string;
  baseUrl: string;
  clientIdMasked: string;
  recipientEmailMasked: string;
  oauth: {
    success: boolean;
    appId?: string;
    expiresIn?: number;
    scopes?: string[];
    hasPayoutsScope?: boolean;
    error?: string;
  };
  payoutEndpointProbe: {
    success: boolean;
    httpStatus?: number;
    debugId?: string;
    message?: string;
    errorName?: string;
  };
  payoutSubmission: {
    attempted: boolean;
    success: boolean;
    httpStatus?: number;
    debugId?: string;
    batchId?: string;
    batchStatus?: string;
    senderBatchId?: string;
    errorName?: string;
    errorMessage?: string;
  };
  payoutBatchDetails: {
    retrieved: boolean;
    batchStatus?: string;
    timeCreated?: string;
    timeCompleted?: string;
    totalItems?: number;
    items?: Array<{
      payoutItemId?: string;
      transactionId?: string;
      transactionStatus?: string;
      amount?: string;
      currency?: string;
      receiver?: string;
    }>;
    error?: string;
  };
  verdict: "SUCCESS" | "RESTRICTED" | "FAILED" | "CONFIG_REQUIRED";
}

async function run() {
  console.log(
    "======================================================================",
  );
  console.log("  GitEscrow - PayPal Payouts Verification (US Sandbox Testing)");
  console.log(
    "======================================================================\n",
  );

  console.log(`[Config Check]`);
  console.log(`  Target Base URL:       ${PAYPAL_BASE_URL}`);
  console.log(`  Client ID:             ${mask(PAYPAL_CLIENT_ID)}`);
  console.log(
    `  Client Secret:         ${PAYPAL_CLIENT_SECRET ? "[CONFIGURED - HIDDEN]" : "[MISSING]"}`,
  );
  console.log(
    `  Sandbox Recipient:     ${mask(PAYPAL_SANDBOX_CONTRIBUTOR_EMAIL)}\n`,
  );

  const result: PayoutVerificationResult = {
    timestamp: new Date().toISOString(),
    environment: "sandbox",
    baseUrl: PAYPAL_BASE_URL,
    clientIdMasked: mask(PAYPAL_CLIENT_ID),
    recipientEmailMasked: mask(PAYPAL_SANDBOX_CONTRIBUTOR_EMAIL),
    oauth: { success: false },
    payoutEndpointProbe: { success: false },
    payoutSubmission: { attempted: false, success: false },
    payoutBatchDetails: { retrieved: false },
    verdict: "CONFIG_REQUIRED",
  };

  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    console.error(
      "✗ ERROR: PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is missing from .env",
    );
    result.oauth.error = "Missing credentials in .env";
    fs.writeFileSync(OUTPUT_STATE_FILE, JSON.stringify(result, null, 2));
    process.exit(1);
  }

  const client = new PayPalClient({
    clientId: PAYPAL_CLIENT_ID,
    clientSecret: PAYPAL_CLIENT_SECRET,
    baseUrl: PAYPAL_BASE_URL,
    enableLogging: false,
  });

  // 1. OAuth Authentication
  console.log("[Step 1: OAuth Authentication]");
  try {
    const token = await client.getAccessToken();
    result.oauth.success = Boolean(token);
    console.log("  ✓ OAuth2 bearer token acquired successfully.");

    // Decode token scope if available via direct endpoint inspect
    const authHeader = `Basic ${Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64")}`;
    const tokenRes = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: "grant_type=client_credentials",
    });
    const tokenJson = await tokenRes.json();
    result.oauth.appId = tokenJson.app_id;
    result.oauth.expiresIn = tokenJson.expires_in;
    if (tokenJson.scope) {
      const scopes =
        typeof tokenJson.scope === "string" ? tokenJson.scope.split(" ") : [];
      result.oauth.scopes = scopes;
      result.oauth.hasPayoutsScope = scopes.some((s: string) =>
        s.includes("payouts"),
      );
      console.log(
        `  ✓ App ID: ${tokenJson.app_id} (Expires in: ${tokenJson.expires_in}s)`,
      );
      console.log(`  ✓ Scopes discovered: ${scopes.length} scope(s)`);
      console.log(
        `    - Has Payouts Scope: ${result.oauth.hasPayoutsScope ? "YES" : "NO"}`,
      );
    }
  } catch (authErr: any) {
    result.oauth.success = false;
    result.oauth.error = authErr.message;
    result.verdict = "FAILED";
    console.error(`  ✗ OAuth token request failed: ${authErr.message}`);
    fs.writeFileSync(OUTPUT_STATE_FILE, JSON.stringify(result, null, 2));
    process.exit(1);
  }

  // 2. Payouts Endpoint & Permission Probe
  console.log("\n[Step 2: Payouts Endpoint & Permission Probe]");
  try {
    // Probe via non-existent batch lookup (GET /v1/payments/payouts/PROBE_BATCH_ID)
    await client.getPayoutBatch("PROBE_VERIFICATION_BATCH_001");
    result.payoutEndpointProbe.success = true;
    console.log("  ✓ Payouts endpoint reachable and authorized.");
  } catch (probeErr: any) {
    const status = probeErr.status || 0;
    const debugId = probeErr.debugId;
    const message = probeErr.message || "";
    result.payoutEndpointProbe.httpStatus = status;
    result.payoutEndpointProbe.debugId = debugId;
    result.payoutEndpointProbe.message = message;

    if (status === 404) {
      // 404 indicates the endpoint is accessible, authenticated, and authorized (batch merely does not exist)
      result.payoutEndpointProbe.success = true;
      console.log(
        `  ✓ Payouts endpoint probe returned HTTP 404 (Expected for probe ID; endpoint is authorized).`,
      );
    } else if (
      status === 403 ||
      message.includes("NOT_AUTHORIZED") ||
      message.includes("FEATURE_NOT_AVAILABLE")
    ) {
      result.payoutEndpointProbe.success = false;
      result.payoutEndpointProbe.errorName = "NOT_AUTHORIZED";
      console.warn(
        `  ⚠ Payouts endpoint probe returned HTTP ${status}: Feature not enabled or account restricted.`,
      );
    } else {
      result.payoutEndpointProbe.success = false;
      console.log(
        `  ℹ Probe response: HTTP ${status} [debug_id: ${debugId}] - ${message}`,
      );
    }
  }

  // 3. Test Payout Submission (Single Item, $1.00 USD, Idempotent)
  console.log("\n[Step 3: Test Payout Submission]");
  const timestamp = Date.now();
  const senderBatchId = `GitEscrow_US_Test_${timestamp}`;
  const idempotencyKey = `payout-idem-${timestamp}`;

  const payoutPayload = {
    sender_batch_header: {
      sender_batch_id: senderBatchId,
      email_subject: "GitEscrow Sandbox US Test Payout",
      email_message:
        "Verification payout test for GitEscrow US Sandbox Business account.",
    },
    items: [
      {
        recipient_type: "EMAIL" as const,
        receiver: PAYPAL_SANDBOX_CONTRIBUTOR_EMAIL,
        amount: {
          currency: "USD",
          value: "1.00",
        },
        note: "GitEscrow US Sandbox payout verification ($1.00 USD)",
        sender_item_id: `us-test-item-${timestamp}`,
      },
    ],
  };

  result.payoutSubmission.attempted = true;
  result.payoutSubmission.senderBatchId = senderBatchId;

  try {
    console.log(
      `  Dispatching POST /v1/payments/payouts with batch ID: ${senderBatchId}...`,
    );
    console.log(
      `  Recipient: ${PAYPAL_SANDBOX_CONTRIBUTOR_EMAIL} | Amount: $1.00 USD`,
    );
    console.log(`  Idempotency Key: ${idempotencyKey}`);

    const createRes = await client.createPayout(payoutPayload, idempotencyKey);
    const batchId = createRes.batch_header?.payout_batch_id;
    const batchStatus = createRes.batch_header?.batch_status;

    result.payoutSubmission.success = true;
    result.payoutSubmission.batchId = batchId;
    result.payoutSubmission.batchStatus = batchStatus;
    result.payoutSubmission.httpStatus = 201;

    console.log(`  ✓ Payout Submission SUCCESS!`);
    console.log(`    - Payout Batch ID: ${batchId}`);
    console.log(`    - Batch Status:    ${batchStatus}`);

    // 4. Retrieve Payout Batch & Item Details
    console.log("\n[Step 4: Payout Batch & Item Retrieval]");
    let batchDetails: any = null;
    const maxPolls = 4;

    for (let poll = 1; poll <= maxPolls; poll++) {
      console.log(`  Checking batch status (attempt ${poll}/${maxPolls})...`);
      await new Promise((r) => setTimeout(r, 3000));

      try {
        batchDetails = await client.getPayoutBatch(batchId);
        const currentBatchStatus = batchDetails.batch_header?.batch_status;
        console.log(`  Current Batch Status: ${currentBatchStatus}`);

        if (currentBatchStatus !== "PENDING" && currentBatchStatus !== "PROCESSING") {
          break;
        }
      } catch (fetchErr: any) {
        console.warn(`  Attempt ${poll} lookup warning: ${fetchErr.message}`);
      }
    }

    if (batchDetails) {
      result.payoutBatchDetails.retrieved = true;
      result.payoutBatchDetails.batchStatus = batchDetails.batch_header?.batch_status;
      result.payoutBatchDetails.timeCreated = batchDetails.batch_header?.time_created;
      result.payoutBatchDetails.timeCompleted = batchDetails.batch_header?.time_completed;
      result.payoutBatchDetails.totalItems = batchDetails.items?.length || 0;

      if (batchDetails.items && batchDetails.items.length > 0) {
        result.payoutBatchDetails.items = batchDetails.items.map((item: any) => ({
          payoutItemId: item.payout_item_id,
          transactionId: item.transaction_id,
          transactionStatus: item.transaction_status,
          amount: item.payout_item?.amount?.value,
          currency: item.payout_item?.amount?.currency,
          receiver: item.payout_item?.receiver,
        }));

        const firstItem = batchDetails.items[0];
        console.log(`\n  ✓ Final Batch & Item Details:`);
        console.log(`    - Payout Batch ID:     ${batchDetails.batch_header?.payout_batch_id}`);
        console.log(`    - Final Batch Status:  ${batchDetails.batch_header?.batch_status}`);
        console.log(`    - Item ID:             ${firstItem.payout_item_id}`);
        console.log(`    - Transaction ID:      ${firstItem.transaction_id || "NOT_ASSIGNED_YET"}`);
        console.log(`    - Item Status:         ${firstItem.transaction_status || "UNKNOWN"}`);
        console.log(`    - Receiver:            ${firstItem.payout_item?.receiver}`);
        console.log(`    - Amount:              $${firstItem.payout_item?.amount?.value} ${firstItem.payout_item?.amount?.currency}`);
        console.log(`    - Time Created:        ${batchDetails.batch_header?.time_created}`);
        console.log(`    - Time Completed:      ${batchDetails.batch_header?.time_completed || "PENDING_COMPLETION"}`);
      }

      result.verdict = "SUCCESS";
    } else {
      result.payoutBatchDetails.error = "Failed to retrieve batch details after creation.";
      result.verdict = "SUCCESS"; // The submission itself succeeded (HTTP 201)
    }
  } catch (payoutErr: any) {
    result.payoutSubmission.success = false;
    result.payoutSubmission.httpStatus = payoutErr.status || 0;
    result.payoutSubmission.debugId = payoutErr.debugId;
    result.payoutSubmission.errorMessage = payoutErr.message;

    const rawResponse = payoutErr.responseBody || {};
    const errorName = rawResponse.name || payoutErr.name || "UNKNOWN_ERROR";
    result.payoutSubmission.errorName = errorName;

    console.error(`\n  ✗ Payout Submission REJECTED by PayPal:`);
    console.error(`    - HTTP Status:   ${payoutErr.status}`);
    console.error(`    - Debug ID:      ${payoutErr.debugId}`);
    console.error(`    - Error Name:    ${errorName}`);
    console.error(`    - Message:       ${payoutErr.message}`);

    if (errorName === "USER_COUNTRY_NOT_SUPPORTED") {
      result.verdict = "RESTRICTED";
      console.error(
        `    - Root Cause:    The sender PayPal account country does not support automated Payouts API.`,
      );
    } else if (payoutErr.status === 403) {
      result.verdict = "RESTRICTED";
      console.error(
        `    - Root Cause:    Payouts permission is not enabled on this Sandbox REST App.`,
      );
    } else {
      result.verdict = "FAILED";
    }
  }

  // Save isolated verification evidence
  fs.writeFileSync(OUTPUT_STATE_FILE, JSON.stringify(result, null, 2));
  console.log(`\nEvidence written to: ${OUTPUT_STATE_FILE}`);

  console.log(
    "\n======================================================================",
  );
  console.log(`  VERIFICATION VERDICT: ${result.verdict}`);
  console.log(
    "======================================================================\n",
  );
}

run().catch((e) => {
  console.error("Fatal execution error:", e);
  process.exit(1);
});
