/**
 * GitEscrow - GitHub Webhook Endpoint Automated Test Suite
 * Task 1B: Webhook Signature & Duplicate Delivery Verification
 *
 * Tests:
 *   1. Valid signature -> HTTP 200
 *   2. Invalid signature -> HTTP 401
 *   3. Missing signature -> HTTP 401
 *   4. Modified payload -> HTTP 401
 *   5. Duplicate delivery ID -> HTTP 200 (status: "ignored")
 *
 * Runs locally against in-memory Express server without needing ngrok.
 */

import http from "http";
import path from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { computeGitHubWebhookSignature } from "../src/github/webhook";
import { setPayPalClient } from "../src/paypal/client";
import { PayoutService } from "../src/paypal/payout.service";
import { WebhookDelivery } from "../src/models/WebhookDelivery";
import { Milestone } from "../src/models/Milestone";

// Ensure test environment
process.env.NODE_ENV = "test";
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const TEST_SECRET =
  process.env.GITHUB_WEBHOOK_SECRET || "gitescrow_test_webhook_secret_key_2026";
process.env.GITHUB_WEBHOOK_SECRET = TEST_SECRET;

import app, { connectDB } from "../src/index";

interface TestResult {
  name: string;
  expectedStatus: number;
  actualStatus: number;
  passed: boolean;
  notes: string;
}

const results: TestResult[] = [];

async function run() {
  console.log(
    `\n======================================================================`,
  );
  console.log(`  GitEscrow - GitHub Webhook Local Automated Test Suite`);
  console.log(`  Webhook Route: POST /api/webhooks/github`);
  console.log(`  Test Secret: ${TEST_SECRET.substring(0, 4)}***`);
  console.log(
    `======================================================================\n`,
  );

  // Connect to database for durable webhook delivery and deduplication tests
  await connectDB();

  // Start in-process server on random available port
  let server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start ephemeral test server");
  }
  const port = address.port;
  const webhookUrl = `http://localhost:${port}/api/webhooks/github`;
  console.log(`Ephemeral test server running on port ${port}...\n`);

  const samplePayload = {
    action: "closed",
    pull_request: {
      number: 42,
      merged: true,
      title: "Fix issue #10: Implement escrow bounty payouts",
      user: { login: "contributor-alex" },
    },
    repository: {
      id: 998877,
      name: "escrow-repo",
      full_name: "sponsor-org/escrow-repo",
    },
    sender: { login: "maintainer-sam" },
  };

  const rawJson = JSON.stringify(samplePayload);
  const validSignature = computeGitHubWebhookSignature(rawJson, TEST_SECRET);
  const fixedDeliveryId = `delivery-test-${Date.now()}`;

  try {
    // -------------------------------------------------------------
    // Test 1: Valid Signature
    // -------------------------------------------------------------
    console.log(
      `[Test 1] Dispatching webhook with valid HMAC SHA-256 signature...`,
    );
    const res1 = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GitHub-Event": "pull_request",
        "X-GitHub-Delivery": fixedDeliveryId,
        "X-Hub-Signature-256": validSignature,
      },
      body: rawJson,
    });
    const body1 = (await res1.json()) as any;
    const pass1 = res1.status === 200 && body1.status === "received";
    results.push({
      name: "Valid webhook signature",
      expectedStatus: 200,
      actualStatus: res1.status,
      passed: pass1,
      notes: `Response: ${JSON.stringify(body1)}`,
    });
    console.log(
      `  ${pass1 ? "✓ PASS" : "✗ FAIL"} Status: ${res1.status} (Body: ${body1.status})\n`,
    );

    // -------------------------------------------------------------
    // Test 2: Invalid Signature
    // -------------------------------------------------------------
    console.log(
      `[Test 2] Dispatching webhook with forged/invalid signature...`,
    );
    const res2 = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GitHub-Event": "pull_request",
        "X-GitHub-Delivery": `delivery-test-2-${Date.now()}`,
        "X-Hub-Signature-256":
          "sha256=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      },
      body: rawJson,
    });
    const body2 = (await res2.json()) as any;
    const pass2 = res2.status === 401;
    results.push({
      name: "Invalid signature rejection",
      expectedStatus: 401,
      actualStatus: res2.status,
      passed: pass2,
      notes: `Rejected with 401 Unauthorized (${body2.error})`,
    });
    console.log(
      `  ${pass2 ? "✓ PASS" : "✗ FAIL"} Status: ${res2.status} (Expected 401 Unauthorized)\n`,
    );

    // -------------------------------------------------------------
    // Test 3: Missing Signature
    // -------------------------------------------------------------
    console.log(
      `[Test 3] Dispatching webhook with missing X-Hub-Signature-256 header...`,
    );
    const res3 = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GitHub-Event": "pull_request",
        "X-GitHub-Delivery": `delivery-test-3-${Date.now()}`,
      },
      body: rawJson,
    });
    const body3 = (await res3.json()) as any;
    const pass3 = res3.status === 401;
    results.push({
      name: "Missing signature rejection",
      expectedStatus: 401,
      actualStatus: res3.status,
      passed: pass3,
      notes: `Rejected with 401 Unauthorized (${body3.error})`,
    });
    console.log(
      `  ${pass3 ? "✓ PASS" : "✗ FAIL"} Status: ${res3.status} (Expected 401 Unauthorized)\n`,
    );

    // -------------------------------------------------------------
    // Test 4: Modified Payload (Tampering attack)
    // -------------------------------------------------------------
    console.log(
      `[Test 4] Dispatching tampered payload with original signature...`,
    );
    const tamperedJson = rawJson.replace('"merged":true', '"merged":false');
    const res4 = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GitHub-Event": "pull_request",
        "X-GitHub-Delivery": `delivery-test-4-${Date.now()}`,
        "X-Hub-Signature-256": validSignature, // Original signature does not match tampered payload
      },
      body: tamperedJson,
    });
    const body4 = (await res4.json()) as any;
    const pass4 = res4.status === 401;
    results.push({
      name: "Modified payload rejection",
      expectedStatus: 401,
      actualStatus: res4.status,
      passed: pass4,
      notes: `Rejected tampered payload with 401 (${body4.error})`,
    });
    console.log(
      `  ${pass4 ? "✓ PASS" : "✗ FAIL"} Status: ${res4.status} (Expected 401 Unauthorized)\n`,
    );

    // -------------------------------------------------------------
    // Test 5: Duplicate Delivery ID (Replay / duplicate delivery)
    // -------------------------------------------------------------
    console.log(
      `[Test 5] Re-sending previously processed delivery ID (${fixedDeliveryId})...`,
    );
    const res5 = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GitHub-Event": "pull_request",
        "X-GitHub-Delivery": fixedDeliveryId, // Same ID as Test 1
        "X-Hub-Signature-256": validSignature,
      },
      body: rawJson,
    });
    const body5 = (await res5.json()) as any;
    const pass5 =
      res5.status === 200 &&
      body5.status === "ignored" &&
      body5.reason === "duplicate delivery ID";
    results.push({
      name: "Duplicate delivery protection",
      expectedStatus: 200,
      actualStatus: res5.status,
      passed: pass5,
      notes: `Duplicate detected and safely ignored (reason: ${body5.reason})`,
    });
    console.log(
      `  ${pass5 ? "✓ PASS" : "✗ FAIL"} Status: ${res5.status} (Body: ${body5.status}, reason: ${body5.reason})\n`,
    );

    // =============================================================
    // Part 2: PayPal Webhook Security & Signature Verification Tests
    // =============================================================
    console.log(
      `\n----------------------------------------------------------------------`,
    );
    console.log(`  GitEscrow - PayPal Webhook Security Verification Tests`);
    console.log(`  Webhook Route: POST /api/webhooks/paypal`);
    console.log(
      `----------------------------------------------------------------------\n`,
    );

    let paypalWebhookUrl = `http://localhost:${port}/api/webhooks/paypal`;
    const paypalFixedDeliveryId = `trans-sec-${Date.now()}`;
    const validPayPalPayload = {
      id: `wh_evt_sec_${Date.now()}`,
      event_type: "PAYMENT.PAYOUTS-ITEM.SUCCEEDED",
      resource: {
        payout_item_id: "test_item_999",
        transaction_status: "SUCCESS",
      },
    };

    const makePayPalHeaders = (overrides?: Record<string, string>) => ({
      "Content-Type": "application/json",
      "paypal-auth-algo": "SHA256withRSA",
      "paypal-cert-url": "https://api.sandbox.paypal.com/v1/certs/CERT-12345",
      "paypal-transmission-id": paypalFixedDeliveryId,
      "paypal-transmission-sig": "test_valid_signature_hash",
      "paypal-transmission-time": new Date().toISOString(),
      ...overrides,
    });

    const mockSuccessClient = {
      verifyWebhookSignature: async () => ({
        verification_status: "SUCCESS" as const,
      }),
    } as any;

    const mockFailureClient = {
      verifyWebhookSignature: async () => ({
        verification_status: "FAILURE" as const,
      }),
    } as any;

    const mockExceptionClient = {
      verifyWebhookSignature: async () => {
        throw new Error("PayPal API 503 Service Unavailable / Network Timeout");
      },
    } as any;

    // -------------------------------------------------------------
    // Test 6: Mock signature header rejected in production simulation
    // -------------------------------------------------------------
    console.log(
      `[Test 6] Dispatching mock header (x-mock-test-signature: valid) under NODE_ENV=production...`,
    );
    const savedEnv6 = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    setPayPalClient(mockFailureClient);

    const res6 = await fetch(paypalWebhookUrl, {
      method: "POST",
      headers: makePayPalHeaders({
        "x-mock-test-signature": "valid",
        "paypal-transmission-sig": "forged_signature_attempt",
      }),
      body: JSON.stringify(validPayPalPayload),
    });
    const body6 = (await res6.json()) as any;
    process.env.NODE_ENV = savedEnv6;

    const pass6 =
      res6.status === 400 && body6.code === "INVALID_WEBHOOK_SIGNATURE";
    results.push({
      name: "Mock header rejected in production",
      expectedStatus: 400,
      actualStatus: res6.status,
      passed: pass6,
      notes: `Rejected with 400 (${body6.error || body6.code}) under NODE_ENV=production`,
    });
    console.log(
      `  ${pass6 ? "✓ PASS" : "✗ FAIL"} Status: ${res6.status} (Expected 400 INVALID_WEBHOOK_SIGNATURE)\n`,
    );

    // -------------------------------------------------------------
    // Test 7: Mock signature header rejected in development simulation
    // -------------------------------------------------------------
    console.log(
      `[Test 7] Dispatching mock header (x-mock-test-signature: valid) under NODE_ENV=development...`,
    );
    const savedEnv7 = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    setPayPalClient(mockFailureClient);

    const res7 = await fetch(paypalWebhookUrl, {
      method: "POST",
      headers: makePayPalHeaders({
        "x-mock-test-signature": "valid",
        "paypal-transmission-sig": "forged_signature_attempt",
      }),
      body: JSON.stringify(validPayPalPayload),
    });
    const body7 = (await res7.json()) as any;
    process.env.NODE_ENV = savedEnv7;

    const pass7 =
      res7.status === 400 && body7.code === "INVALID_WEBHOOK_SIGNATURE";
    results.push({
      name: "Mock header rejected in development",
      expectedStatus: 400,
      actualStatus: res7.status,
      passed: pass7,
      notes: `Rejected with 400 (${body7.error || body7.code}) under NODE_ENV=development`,
    });
    console.log(
      `  ${pass7 ? "✓ PASS" : "✗ FAIL"} Status: ${res7.status} (Expected 400 INVALID_WEBHOOK_SIGNATURE)\n`,
    );

    // -------------------------------------------------------------
    // Test 8: Missing PayPal signature headers rejected
    // -------------------------------------------------------------
    console.log(
      `[Test 8] Dispatching PayPal webhook with missing signature headers...`,
    );
    setPayPalClient(mockSuccessClient);

    const res8 = await fetch(paypalWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Omitting paypal-auth-algo, paypal-cert-url, paypal-transmission-sig
      },
      body: JSON.stringify(validPayPalPayload),
    });
    const body8 = (await res8.json()) as any;
    const pass8 =
      res8.status === 400 && body8.code === "INVALID_WEBHOOK_SIGNATURE";
    results.push({
      name: "Missing PayPal signature headers rejected",
      expectedStatus: 400,
      actualStatus: res8.status,
      passed: pass8,
      notes: `Rejected missing headers with 400 (${body8.error || body8.code})`,
    });
    console.log(
      `  ${pass8 ? "✓ PASS" : "✗ FAIL"} Status: ${res8.status} (Expected 400 INVALID_WEBHOOK_SIGNATURE)\n`,
    );

    // -------------------------------------------------------------
    // Test 9: Insecure / rogue cert_url rejected (SSRF & cert spoofing defense)
    // -------------------------------------------------------------
    console.log(
      `[Test 9] Dispatching rogue cert_url (http://evil-attacker.com/cert.pem)...`,
    );
    setPayPalClient(mockSuccessClient);

    const res9 = await fetch(paypalWebhookUrl, {
      method: "POST",
      headers: makePayPalHeaders({
        "paypal-cert-url": "http://evil-attacker.com/cert.pem",
      }),
      body: JSON.stringify(validPayPalPayload),
    });
    const body9 = (await res9.json()) as any;
    const pass9 =
      res9.status === 400 && body9.code === "INVALID_WEBHOOK_SIGNATURE";
    results.push({
      name: "Insecure/rogue cert_url rejected",
      expectedStatus: 400,
      actualStatus: res9.status,
      passed: pass9,
      notes: `Rejected non-paypal / non-https cert_url with 400 (${body9.error || body9.code})`,
    });
    console.log(
      `  ${pass9 ? "✓ PASS" : "✗ FAIL"} Status: ${res9.status} (Expected 400 INVALID_WEBHOOK_SIGNATURE)\n`,
    );

    // -------------------------------------------------------------
    // Test 10: Invalid PayPal signature rejected by verifier
    // -------------------------------------------------------------
    console.log(
      `[Test 10] Dispatching forged signature evaluated by provider verifier...`,
    );
    setPayPalClient(mockFailureClient);

    const res10 = await fetch(paypalWebhookUrl, {
      method: "POST",
      headers: makePayPalHeaders({
        "paypal-transmission-sig": "invalid_forged_hash",
      }),
      body: JSON.stringify(validPayPalPayload),
    });
    const body10 = (await res10.json()) as any;
    const pass10 =
      res10.status === 400 && body10.code === "INVALID_WEBHOOK_SIGNATURE";
    results.push({
      name: "Invalid PayPal signature rejected",
      expectedStatus: 400,
      actualStatus: res10.status,
      passed: pass10,
      notes: `Rejected by verifier with 400 (${body10.error || body10.code})`,
    });
    console.log(
      `  ${pass10 ? "✓ PASS" : "✗ FAIL"} Status: ${res10.status} (Expected 400 INVALID_WEBHOOK_SIGNATURE)\n`,
    );

    // -------------------------------------------------------------
    // Test 11: PayPal verification API failures fail closed safely
    // -------------------------------------------------------------
    console.log(
      `[Test 11] Dispatching webhook when PayPal API fails/times out...`,
    );
    setPayPalClient(mockExceptionClient);

    const res11 = await fetch(paypalWebhookUrl, {
      method: "POST",
      headers: makePayPalHeaders(),
      body: JSON.stringify(validPayPalPayload),
    });
    const body11 = (await res11.json()) as any;
    const pass11 =
      res11.status === 400 && body11.code === "INVALID_WEBHOOK_SIGNATURE";
    results.push({
      name: "PayPal API error fails closed",
      expectedStatus: 400,
      actualStatus: res11.status,
      passed: pass11,
      notes: `Failed closed with 400 (${body11.error || body11.code}) on provider exception`,
    });
    console.log(
      `  ${pass11 ? "✓ PASS" : "✗ FAIL"} Status: ${res11.status} (Expected 400 INVALID_WEBHOOK_SIGNATURE)\n`,
    );

    // -------------------------------------------------------------
    // Test 12: Missing PAYPAL_WEBHOOK_ID in production fails closed safely
    // -------------------------------------------------------------
    console.log(
      `[Test 12] Missing PAYPAL_WEBHOOK_ID in production fails closed safely...`,
    );
    const savedEnv12 = process.env.NODE_ENV;
    const savedWhId12 = process.env.PAYPAL_WEBHOOK_ID;
    process.env.NODE_ENV = "production";
    delete process.env.PAYPAL_WEBHOOK_ID;
    setPayPalClient(mockSuccessClient);

    const res12 = await fetch(paypalWebhookUrl, {
      method: "POST",
      headers: makePayPalHeaders(),
      body: JSON.stringify(validPayPalPayload),
    });
    const body12 = (await res12.json()) as any;
    process.env.NODE_ENV = savedEnv12;
    if (savedWhId12 !== undefined) {
      process.env.PAYPAL_WEBHOOK_ID = savedWhId12;
    }

    const pass12 =
      res12.status === 400 && body12.code === "INVALID_WEBHOOK_SIGNATURE";
    results.push({
      name: "Missing PAYPAL_WEBHOOK_ID fails closed",
      expectedStatus: 400,
      actualStatus: res12.status,
      passed: pass12,
      notes: `Rejected with 400 when PAYPAL_WEBHOOK_ID is unset in production`,
    });
    console.log(
      `  ${pass12 ? "✓ PASS" : "✗ FAIL"} Status: ${res12.status} (Expected 400 INVALID_WEBHOOK_SIGNATURE)\n`,
    );

    // -------------------------------------------------------------
    // Test 13: Valid PayPal signature is accepted
    // -------------------------------------------------------------
    console.log(
      `[Test 13] Dispatching valid PayPal webhook with verified signature...`,
    );
    setPayPalClient(mockSuccessClient);

    const res13 = await fetch(paypalWebhookUrl, {
      method: "POST",
      headers: makePayPalHeaders({
        "paypal-transmission-id": paypalFixedDeliveryId,
      }),
      body: JSON.stringify(validPayPalPayload),
    });
    const body13 = (await res13.json()) as any;
    const pass13 = res13.status === 200 && body13.status === "ok";
    results.push({
      name: "Valid PayPal signature accepted",
      expectedStatus: 200,
      actualStatus: res13.status,
      passed: pass13,
      notes: `Accepted with 200 (${body13.message})`,
    });
    console.log(
      `  ${pass13 ? "✓ PASS" : "✗ FAIL"} Status: ${res13.status} (Body: ${body13.status})\n`,
    );

    // -------------------------------------------------------------
    // Test 14: Duplicate PayPal webhook event deduplication
    // -------------------------------------------------------------
    console.log(
      `[Test 14] Dispatching duplicate PayPal webhook with identical transmission ID...`,
    );
    setPayPalClient(mockSuccessClient);

    const res14 = await fetch(paypalWebhookUrl, {
      method: "POST",
      headers: makePayPalHeaders({
        "paypal-transmission-id": paypalFixedDeliveryId, // Same ID as Test 13
      }),
      body: JSON.stringify(validPayPalPayload),
    });
    const body14 = (await res14.json()) as any;
    const pass14 =
      res14.status === 200 &&
      body14.status === "ok" &&
      body14.message === "Webhook duplicate already processed";
    results.push({
      name: "Duplicate PayPal webhook deduplicated",
      expectedStatus: 200,
      actualStatus: res14.status,
      passed: pass14,
      notes: `Duplicate transmission caught safely (${body14.message})`,
    });
    console.log(
      `  ${pass14 ? "✓ PASS" : "✗ FAIL"} Status: ${res14.status} (Body: ${body14.status}, message: ${body14.message})\n`,
    );

    // -------------------------------------------------------------
    // Test 15: MongoDB claim failure aborts financial event processing (HTTP 500)
    // -------------------------------------------------------------
    console.log(
      `[Test 15] Simulating MongoDB claim failure on incoming webhook...`,
    );
    setPayPalClient(mockSuccessClient);
    const origCreate15 = WebhookDelivery.create;
    (WebhookDelivery as any).create = () =>
      Promise.reject(
        new Error("MongoNetworkTimeout: replica set connection failure"),
      );

    try {
      const res15 = await fetch(paypalWebhookUrl, {
        method: "POST",
        headers: makePayPalHeaders({
          "paypal-transmission-id": `trans-sec-claim-fail-${Date.now()}`,
        }),
        body: JSON.stringify(validPayPalPayload),
      });
      const body15 = (await res15.json()) as any;
      const pass15 =
        res15.status === 500 && body15.error?.includes("MongoNetworkTimeout");
      results.push({
        name: "MongoDB claim failure aborts processing",
        expectedStatus: 500,
        actualStatus: res15.status,
        passed: pass15,
        notes: `Aborted processing and returned 500 (${body15.error})`,
      });
      console.log(
        `  ${pass15 ? "✓ PASS" : "✗ FAIL"} Status: ${res15.status} (Expected 500, Error: ${body15.error})\n`,
      );
    } finally {
      WebhookDelivery.create = origCreate15;
    }

    // -------------------------------------------------------------
    // Test 16: MongoDB update failure is surfaced as 500 (not silently 200)
    // -------------------------------------------------------------
    console.log(
      `[Test 16] Simulating MongoDB completion update failure on incoming webhook...`,
    );
    setPayPalClient(mockSuccessClient);
    const origUpdateOne16 = WebhookDelivery.updateOne;
    (WebhookDelivery as any).updateOne = () =>
      Promise.reject(new Error("MongoWriteConcernError: write quorum lost"));

    try {
      const res16 = await fetch(paypalWebhookUrl, {
        method: "POST",
        headers: makePayPalHeaders({
          "paypal-transmission-id": `trans-sec-update-fail-${Date.now()}`,
        }),
        body: JSON.stringify(validPayPalPayload),
      });
      const body16 = (await res16.json()) as any;
      const pass16 =
        res16.status === 500 &&
        body16.error?.includes("MongoWriteConcernError");
      results.push({
        name: "MongoDB completion failure surfaced as 500",
        expectedStatus: 500,
        actualStatus: res16.status,
        passed: pass16,
        notes: `Surfaced error as 500 without false 200 (${body16.error})`,
      });
      console.log(
        `  ${pass16 ? "✓ PASS" : "✗ FAIL"} Status: ${res16.status} (Expected 500, Error: ${body16.error})\n`,
      );
    } finally {
      WebhookDelivery.updateOne = origUpdateOne16;
    }

    // -------------------------------------------------------------
    // Test 17: Concurrent duplicate deliveries - exactly one processes
    // -------------------------------------------------------------
    console.log(
      `[Test 17] Dispatching 2 concurrent identical webhooks simultaneously...`,
    );
    setPayPalClient(mockSuccessClient);
    const concurrentDeliveryId = `trans-sec-concurrent-${Date.now()}`;
    const concurrentHeaders = makePayPalHeaders({
      "paypal-transmission-id": concurrentDeliveryId,
    });

    const [res17a, res17b] = await Promise.all([
      fetch(paypalWebhookUrl, {
        method: "POST",
        headers: concurrentHeaders,
        body: JSON.stringify(validPayPalPayload),
      }),
      fetch(paypalWebhookUrl, {
        method: "POST",
        headers: concurrentHeaders,
        body: JSON.stringify(validPayPalPayload),
      }),
    ]);

    const body17a = (await res17a.json()) as any;
    const body17b = (await res17b.json()) as any;

    const messages = [body17a.message, body17b.message];
    const hasProcessed = messages.some((m) =>
      m?.includes("processed successfully"),
    );
    const hasDuplicate = messages.some((m) =>
      m?.includes("duplicate already processed"),
    );
    const both200 = res17a.status === 200 && res17b.status === 200;

    const dbRecordsCount = await WebhookDelivery.countDocuments({
      deliveryId: concurrentDeliveryId,
    });

    const pass17 =
      both200 && hasProcessed && hasDuplicate && dbRecordsCount === 1;
    results.push({
      name: "Concurrent duplicate webhooks atomic isolation",
      expectedStatus: 200,
      actualStatus: 200,
      passed: pass17,
      notes: `One PROCESSED, one DUPLICATE, exactly 1 DB record created (Count: ${dbRecordsCount})`,
    });
    console.log(
      `  ${pass17 ? "✓ PASS" : "✗ FAIL"} Result: One processed, one duplicate, 1 DB record.\n`,
    );

    // -------------------------------------------------------------
    // Test 18: Processing failure marks FAILED and retry succeeds
    // -------------------------------------------------------------
    console.log(
      `[Test 18] Simulating processing failure, FAILED state, and subsequent retry...`,
    );
    const retryDeliveryId = `trans-sec-retry-${Date.now()}`;
    const origReconcile = PayoutService.reconcileUncertainPayout;
    const origMilestoneFindOne = Milestone.findOne;

    const test18Payload = {
      id: `wh_evt_retry_${Date.now()}`,
      event_type: "PAYMENT.PAYOUTSBATCH.SUCCESS",
      resource: {
        payout_batch_id: "batch_fail_test_18",
        batch_status: "SUCCESS",
      },
    };

    // Return mock milestone so reconciliation is triggered
    (Milestone as any).findOne = () =>
      Promise.resolve({
        _id: new mongoose.Types.ObjectId(),
        payoutBatchId: "batch_fail_test_18",
      });

    // Fail first attempt during financial side effects
    (PayoutService as any).reconcileUncertainPayout = () =>
      Promise.reject(
        new Error("PayPalProvider500: Payout service temporarily unavailable"),
      );

    const failRes18 = await fetch(paypalWebhookUrl, {
      method: "POST",
      headers: makePayPalHeaders({
        "paypal-transmission-id": retryDeliveryId,
      }),
      body: JSON.stringify(test18Payload),
    });
    const failBody18 = (await failRes18.json()) as any;

    const failedDoc = await WebhookDelivery.findOne({
      deliveryId: retryDeliveryId,
    });
    const attempt1MarkedFailed =
      failRes18.status === 500 && failedDoc?.status === "FAILED";

    // Allow retry attempt to succeed
    (PayoutService as any).reconcileUncertainPayout = () =>
      Promise.resolve({ status: "RECONCILED" } as any);

    const retryRes18 = await fetch(paypalWebhookUrl, {
      method: "POST",
      headers: makePayPalHeaders({
        "paypal-transmission-id": retryDeliveryId,
      }),
      body: JSON.stringify(test18Payload),
    });
    const retryBody18 = (await retryRes18.json()) as any;

    const retriedDoc = await WebhookDelivery.findOne({
      deliveryId: retryDeliveryId,
    });
    const attempt2Succeeded =
      retryRes18.status === 200 &&
      retriedDoc?.status === "PROCESSED" &&
      retriedDoc?.attempts === 2;

    // Restore original methods
    (PayoutService as any).reconcileUncertainPayout = origReconcile;
    (Milestone as any).findOne = origMilestoneFindOne;

    const pass18 = attempt1MarkedFailed && attempt2Succeeded;
    results.push({
      name: "Processing failure transitions FAILED and retries safely",
      expectedStatus: 200,
      actualStatus: retryRes18.status,
      passed: pass18,
      notes: `Attempt 1 failed with 500 (marked FAILED), Attempt 2 succeeded with 200 (attempts: ${retriedDoc?.attempts})`,
    });
    console.log(
      `  ${pass18 ? "✓ PASS" : "✗ FAIL"} Status: ${retryRes18.status} (Initial 500 -> Retry 200, Attempts: ${retriedDoc?.attempts})\n`,
    );

    // -------------------------------------------------------------
    // Test 19: Stale crashed claim recovery
    // -------------------------------------------------------------
    console.log(
      `[Test 19] Simulating crash recovery for stale in-flight claim...`,
    );
    const crashedDeliveryId = `trans-sec-crashed-${Date.now()}`;

    // Seed a crashed in-flight delivery (started 30s ago, before 15s timeout)
    await WebhookDelivery.create({
      deliveryId: crashedDeliveryId,
      event: validPayPalPayload.event_type,
      action: "PROCESSING",
      status: "PROCESSING",
      processed: false,
      processingStartedAt: new Date(Date.now() - 30000),
      attempts: 1,
    });

    const recoveryRes19 = await fetch(paypalWebhookUrl, {
      method: "POST",
      headers: makePayPalHeaders({
        "paypal-transmission-id": crashedDeliveryId,
      }),
      body: JSON.stringify(validPayPalPayload),
    });
    const recoveryBody19 = (await recoveryRes19.json()) as any;

    const recoveredDoc = await WebhookDelivery.findOne({
      deliveryId: crashedDeliveryId,
    });
    const pass19 =
      recoveryRes19.status === 200 &&
      recoveredDoc?.status === "PROCESSED" &&
      recoveredDoc?.attempts === 2;

    results.push({
      name: "Stale crashed claim reclaimed and completed",
      expectedStatus: 200,
      actualStatus: recoveryRes19.status,
      passed: pass19,
      notes: `Reclaimed stale processing claim and completed (attempts: ${recoveredDoc?.attempts})`,
    });
    console.log(
      `  ${pass19 ? "✓ PASS" : "✗ FAIL"} Status: ${recoveryRes19.status} (Reclaimed -> PROCESSED, Attempts: ${recoveredDoc?.attempts})\n`,
    );

    // -------------------------------------------------------------
    // Test 20: Server restart and durable deduplication
    // -------------------------------------------------------------
    console.log(
      `[Test 20] Simulating server restart and durable MongoDB deduplication...`,
    );
    const restartDeliveryId = `trans-sec-restart-${Date.now()}`;
    setPayPalClient(mockSuccessClient);

    // Process delivery on original server instance
    const preRestartRes = await fetch(paypalWebhookUrl, {
      method: "POST",
      headers: makePayPalHeaders({
        "paypal-transmission-id": restartDeliveryId,
      }),
      body: JSON.stringify(validPayPalPayload),
    });
    const preRestartBody = (await preRestartRes.json()) as any;
    const preRestartOk =
      preRestartRes.status === 200 && preRestartBody.status === "ok";

    // Simulate complete server process restart
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const restartedServer = http.createServer(app);
    await new Promise<void>((resolve) => restartedServer.listen(0, resolve));
    const restartedPort = (restartedServer.address() as any).port;
    const restartedWebhookUrl = `http://localhost:${restartedPort}/api/webhooks/paypal`;

    // Replay the exact same delivery ID on the newly restarted server
    const postRestartRes = await fetch(restartedWebhookUrl, {
      method: "POST",
      headers: makePayPalHeaders({
        "paypal-transmission-id": restartDeliveryId,
      }),
      body: JSON.stringify(validPayPalPayload),
    });
    const postRestartBody = (await postRestartRes.json()) as any;
    const postRestartDeduplicated =
      postRestartRes.status === 200 &&
      postRestartBody.status === "ok" &&
      postRestartBody.message === "Webhook duplicate already processed";

    // Clean up restarted server
    await new Promise<void>((resolve) =>
      restartedServer.close(() => resolve()),
    );

    const pass20 = preRestartOk && postRestartDeduplicated;
    results.push({
      name: "Server restart and durable deduplication",
      expectedStatus: 200,
      actualStatus: postRestartRes.status,
      passed: pass20,
      notes: `Durable deduplication persisted across server restart (${postRestartBody.message})`,
    });
    console.log(
      `  ${pass20 ? "✓ PASS" : "✗ FAIL"} Status: ${postRestartRes.status} (Deduplicated after restart: ${postRestartDeduplicated})\n`,
    );

    // Re-start ephemeral server for subsequent tests
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const newPort = (server.address() as any).port;
    paypalWebhookUrl = `http://localhost:${newPort}/api/webhooks/paypal`;

    // -------------------------------------------------------------
    // Test 21: Recovery of interrupted PROCESSING delivery with side effect already completed
    // -------------------------------------------------------------
    console.log(
      `[Test 21] Recovery of interrupted PROCESSING delivery with side effect already completed...`,
    );
    const completedCrashDeliveryId = `trans-sec-side-effect-completed-${Date.now()}`;
    await WebhookDelivery.create({
      deliveryId: completedCrashDeliveryId,
      event: validPayPalPayload.event_type,
      action: "PROCESSING",
      status: "PROCESSING",
      processed: false,
      sideEffectInitiated: true,
      sideEffectCompleted: true,
      processingStartedAt: new Date(Date.now() - 30000),
      attempts: 1,
    });

    let reconcileCalls21 = 0;
    const origReconcile21 = PayoutService.reconcileUncertainPayout;
    (PayoutService as any).reconcileUncertainPayout = () => {
      reconcileCalls21++;
      return Promise.resolve({ status: "RECONCILED" } as any);
    };

    const res21 = await fetch(paypalWebhookUrl, {
      method: "POST",
      headers: makePayPalHeaders({
        "paypal-transmission-id": completedCrashDeliveryId,
      }),
      body: JSON.stringify(validPayPalPayload),
    });
    const body21 = (await res21.json()) as any;
    const doc21 = await WebhookDelivery.findOne({
      deliveryId: completedCrashDeliveryId,
    });

    (PayoutService as any).reconcileUncertainPayout = origReconcile21;

    const pass21 =
      res21.status === 200 &&
      doc21?.status === "PROCESSED" &&
      doc21?.processed === true &&
      reconcileCalls21 === 0;

    results.push({
      name: "Recovery skips already-completed external side effects",
      expectedStatus: 200,
      actualStatus: res21.status,
      passed: pass21,
      notes: `Marked PROCESSED without repeating external side effect (Side effect calls: ${reconcileCalls21})`,
    });
    console.log(
      `  ${pass21 ? "✓ PASS" : "✗ FAIL"} Status: ${res21.status} (Zero re-disbursement calls: ${reconcileCalls21 === 0})\n`,
    );

    // -------------------------------------------------------------
    // Test 22: Recovery of interrupted PROCESSING delivery with initiated side effect checks milestone SUCCESS
    // -------------------------------------------------------------
    console.log(
      `[Test 22] Recovery of interrupted claim checks milestone SUCCESS before re-disbursing...`,
    );
    const initiatedCrashDeliveryId = `trans-sec-side-effect-initiated-${Date.now()}`;
    const mockBatchId22 = `batch_confirmed_success_${Date.now()}`;
    const test22Payload = {
      id: `wh_evt_test22_${Date.now()}`,
      event_type: "PAYMENT.PAYOUTSBATCH.SUCCESS",
      resource: {
        payout_batch_id: mockBatchId22,
        batch_status: "SUCCESS",
      },
    };

    await WebhookDelivery.create({
      deliveryId: initiatedCrashDeliveryId,
      event: test22Payload.event_type,
      action: "PROCESSING",
      status: "PROCESSING",
      processed: false,
      sideEffectInitiated: true,
      sideEffectCompleted: false,
      processingStartedAt: new Date(Date.now() - 30000),
      attempts: 1,
    });

    const origMilestoneFindOne22 = Milestone.findOne;
    // Mock milestone finding that milestone is ALREADY authoritatively SUCCESS
    (Milestone as any).findOne = () =>
      Promise.resolve({
        _id: new mongoose.Types.ObjectId(),
        payoutBatchId: mockBatchId22,
        payoutStatus: "SUCCESS",
      });

    let reconcileCalls22 = 0;
    const origReconcile22 = PayoutService.reconcileUncertainPayout;
    (PayoutService as any).reconcileUncertainPayout = () => {
      reconcileCalls22++;
      return Promise.resolve({ status: "RECONCILED" } as any);
    };

    const res22 = await fetch(paypalWebhookUrl, {
      method: "POST",
      headers: makePayPalHeaders({
        "paypal-transmission-id": initiatedCrashDeliveryId,
      }),
      body: JSON.stringify(test22Payload),
    });
    const doc22 = await WebhookDelivery.findOne({
      deliveryId: initiatedCrashDeliveryId,
    });

    (PayoutService as any).reconcileUncertainPayout = origReconcile22;
    (Milestone as any).findOne = origMilestoneFindOne22;

    const pass22 =
      res22.status === 200 &&
      doc22?.status === "PROCESSED" &&
      doc22?.action === "RECOVERED_ALREADY_SUCCESS" &&
      reconcileCalls22 === 0;

    results.push({
      name: "Recovery checks milestone SUCCESS and avoids duplicate side effect",
      expectedStatus: 200,
      actualStatus: res22.status,
      passed: pass22,
      notes: `Verified milestone SUCCESS, marked PROCESSED without duplicate side effect (Calls: ${reconcileCalls22})`,
    });
    console.log(
      `  ${pass22 ? "✓ PASS" : "✗ FAIL"} Status: ${res22.status} (Confirmed SUCCESS, side effect calls: ${reconcileCalls22})\n`,
    );
  } finally {
    setPayPalClient(null);
    try {
      await WebhookDelivery.deleteMany({
        deliveryId: { $regex: /^trans-sec-/ },
      });
    } catch {}
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    console.log(`Ephemeral test server stopped.`);
  }

  // Print results table
  console.log(
    `\n========================================================================================================`,
  );
  console.log(
    `                               WEBHOOK ENDPOINT AUTOMATED TEST REPORT                                   `,
  );
  console.log(
    `========================================================================================================`,
  );
  console.log(`Test| Status| Actual Result`);
  console.log(`---|---|---`);
  for (const r of results) {
    console.log(
      `${r.name}| ${r.passed ? "PASS" : "FAIL"}| Expected HTTP ${r.expectedStatus}, got ${r.actualStatus}. ${r.notes}`,
    );
  }
  console.log(
    `========================================================================================================\n`,
  );

  const allPassed = results.every((r) => r.passed);
  if (!allPassed) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("[FATAL] Webhook test suite crashed:", err);
  process.exit(1);
});
