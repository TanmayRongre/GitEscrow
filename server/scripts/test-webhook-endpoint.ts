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
import { computeGitHubWebhookSignature } from "../src/github/webhook";

// Ensure test environment
process.env.NODE_ENV = "test";
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const TEST_SECRET =
  process.env.GITHUB_WEBHOOK_SECRET || "gitescrow_test_webhook_secret_key_2026";
process.env.GITHUB_WEBHOOK_SECRET = TEST_SECRET;

import app from "../src/index";

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

  // Start in-process server on random available port
  const server = http.createServer(app);
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
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
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
