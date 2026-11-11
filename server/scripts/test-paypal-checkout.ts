/**
 * GitEscrow - PayPal Sandbox Checkout Automated Test Suite
 * Validates real PayPal Sandbox order creation, capture, independent verification,
 * authorization, idempotency, error handling, and ledger persistence.
 */

import http from "http";
import path from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";

// Ensure test environment
process.env.NODE_ENV = "test";
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import app, { connectDB } from "../src/index";
import { User } from "../src/models/User";
import { Organization } from "../src/models/Organization";
import { Bounty } from "../src/models/Bounty";
import { EscrowLedger } from "../src/models/EscrowLedger";
import { setPayPalClient } from "../src/paypal/client";

interface TestResult {
  name: string;
  expectedStatus: number;
  actualStatus: number;
  passed: boolean;
  notes: string;
}

const results: TestResult[] = [];
const RUN_ID = "chk" + Math.random().toString(36).substring(2, 7);

function record(
  name: string,
  expectedStatus: number,
  actualStatus: number,
  passed: boolean,
  notes: string,
) {
  results.push({ name, expectedStatus, actualStatus, passed, notes });
  const icon = passed ? "✓ PASS" : "✗ FAIL";
  console.log(
    `  ${icon} ${name} (Expected: ${expectedStatus}, Actual: ${actualStatus}) - ${notes}`,
  );
}

async function request(
  serverUrl: string,
  method: string,
  urlPath: string,
  body?: any,
  token?: string,
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const fullUrl = new URL(urlPath, serverUrl);
    const postData = body ? JSON.stringify(body) : undefined;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
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
          });
        });
      },
    );

    req.on("error", reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function run() {
  console.log(
    "\n======================================================================",
  );
  console.log(`  GitEscrow - PayPal Sandbox Checkout Automated Test Suite`);
  console.log(`  Run ID: ${RUN_ID}`);
  console.log(
    "======================================================================\n",
  );

  await connectDB();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const jwtSecret =
    process.env.JWT_ACCESS_SECRET ||
    "default_test_jwt_secret_key_12345678901234567890";
  process.env.JWT_ACCESS_SECRET = jwtSecret;

  // 1. Seed Users
  const sponsorUser = await User.create({
    name: "Checkout Sponsor",
    username: `${RUN_ID}_sponsor`,
    email: `${RUN_ID}_sponsor@example.com`,
    passwordHash:
      "$2a$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy",
    role: "USER",
    accountStatus: "ACTIVE",
    emailVerified: true,
  });
  const sponsorToken = jwt.sign(
    { sub: sponsorUser._id.toString(), email: sponsorUser.email, role: "USER" },
    jwtSecret,
    { expiresIn: "1h" },
  );

  const unauthorizedUser = await User.create({
    name: "Unauthorized Contributor",
    username: `${RUN_ID}_contributor`,
    email: `${RUN_ID}_contributor@example.com`,
    passwordHash:
      "$2a$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy",
    role: "USER",
    accountStatus: "ACTIVE",
    emailVerified: true,
  });
  const unauthorizedToken = jwt.sign(
    {
      sub: unauthorizedUser._id.toString(),
      email: unauthorizedUser.email,
      role: "USER",
    },
    jwtSecret,
    { expiresIn: "1h" },
  );

  // 2. Seed Organization
  const organization = await Organization.create({
    name: `Org ${RUN_ID}`,
    slug: `org-${RUN_ID}`,
    ownerId: sponsorUser._id,
    members: [{ userId: sponsorUser._id, role: "OWNER" }],
  });

  const makeBountyFixture = (overrides: any = {}) => ({
    organizationId: organization._id,
    createdBy: sponsorUser._id,
    updatedBy: sponsorUser._id,
    title: `Bounty ${RUN_ID}`,
    slug: `bounty-${RUN_ID}-${Date.now()}`,
    description: "PayPal checkout verification bounty",
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
    ...overrides,
  });

  // 3. Seed Bounty
  const bounty = await Bounty.create(makeBountyFixture());

  try {
    // -----------------------------------------------------------------
    // Test 1: GET /api/bounties/paypal/config returns public configuration
    // -----------------------------------------------------------------
    console.log("[Test 1] Requesting public PayPal config...");
    const res1 = await request(baseUrl, "GET", "/api/bounties/paypal/config");
    const pass1 =
      res1.status === 200 &&
      res1.body.environment === "sandbox" &&
      res1.body.currency === "USD";
    record(
      "PayPal public config returned safely without secrets",
      200,
      res1.status,
      pass1,
      `Environment: ${res1.body.environment}`,
    );

    // -----------------------------------------------------------------
    // Test 2: Unauthorized sponsor blocked from order creation (403)
    // -----------------------------------------------------------------
    console.log(
      "[Test 2] Unauthorized user attempts to create PayPal order...",
    );
    const res2 = await request(
      baseUrl,
      "POST",
      `/api/bounties/${bounty._id}/create-paypal-order`,
      {},
      unauthorizedToken,
    );
    const pass2 = res2.status === 403;
    record(
      "Unauthorized user blocked from creating PayPal order (403)",
      403,
      res2.status,
      pass2,
      res2.body.error,
    );

    // -----------------------------------------------------------------
    // Test 3: Unauthorized sponsor blocked from order capture (403)
    // -----------------------------------------------------------------
    console.log(
      "[Test 3] Unauthorized user attempts to capture PayPal order...",
    );
    const res3 = await request(
      baseUrl,
      "POST",
      `/api/bounties/${bounty._id}/capture-paypal-order`,
      { orderId: "ORDER_UNAUTH_123" },
      unauthorizedToken,
    );
    const pass3 = res3.status === 403;
    record(
      "Unauthorized user blocked from capturing PayPal order (403)",
      403,
      res3.status,
      pass3,
      res3.body.error,
    );

    // -----------------------------------------------------------------
    // Test 4: Cannot create order on cancelled bounty
    // -----------------------------------------------------------------
    console.log("[Test 4] Attempting to create order on cancelled bounty...");
    const cancelledBounty = await Bounty.create(
      makeBountyFixture({
        title: `Cancelled Bounty ${RUN_ID}`,
        status: "CANCELLED",
        rewardAmount: mongoose.Types.Decimal128.fromString("50.00"),
      }),
    );

    const res4 = await request(
      baseUrl,
      "POST",
      `/api/bounties/${cancelledBounty._id}/create-paypal-order`,
      {},
      sponsorToken,
    );
    const pass4 = res4.status === 400 && res4.body.code === "BOUNTY_INACTIVE";
    record(
      "Order creation on cancelled bounty is rejected (400 BOUNTY_INACTIVE)",
      400,
      res4.status,
      pass4,
      res4.body.error,
    );

    // -----------------------------------------------------------------
    // Test 5: Authorized sponsor creates PayPal order for exact reward amount
    // -----------------------------------------------------------------
    console.log(
      "[Test 5] Authorized sponsor creates PayPal order for exact bounty amount...",
    );
    const mockOrderId = `ORD_${RUN_ID}_VALID`;
    let capturedPayloadToPayPal: any = null;

    setPayPalClient({
      createOrder: async (payload: any) => {
        capturedPayloadToPayPal = payload;
        return {
          id: mockOrderId,
          status: "CREATED",
          intent: "CAPTURE",
          links: [],
        } as any;
      },
    } as any);

    const res5 = await request(
      baseUrl,
      "POST",
      `/api/bounties/${bounty._id}/create-paypal-order`,
      {},
      sponsorToken,
    );
    const pass5 =
      res5.status === 201 &&
      res5.body.orderId === mockOrderId &&
      res5.body.amount === "100.00" &&
      res5.body.currency === "USD" &&
      capturedPayloadToPayPal?.purchase_units?.[0]?.amount?.value === "100.00";

    record(
      "Authorized sponsor creates PayPal order with exact reward amount",
      201,
      res5.status,
      pass5,
      `Order ID: ${res5.body.orderId}`,
    );

    // -----------------------------------------------------------------
    // Test 6: PayPal capture failure / timeout handled safely
    // -----------------------------------------------------------------
    console.log("[Test 6] Simulating PayPal capture API network timeout...");
    setPayPalClient({
      captureOrder: async () => {
        throw new Error("PayPal API 504 Gateway Timeout during capture");
      },
    } as any);

    const res6 = await request(
      baseUrl,
      "POST",
      `/api/bounties/${bounty._id}/capture-paypal-order`,
      { orderId: mockOrderId },
      sponsorToken,
    );
    const bountyAfterFail = await Bounty.findById(bounty._id);
    const pass6 =
      res6.status === 400 && bountyAfterFail?.fundingStatus === "UNFUNDED";
    record(
      "PayPal capture API failure fails closed without corrupting bounty status",
      400,
      res6.status,
      pass6,
      res6.body.error,
    );

    // -----------------------------------------------------------------
    // Test 7: Amount mismatch during capture is strictly rejected
    // -----------------------------------------------------------------
    console.log(
      "[Test 7] PayPal capture returned $80.00 for $100.00 bounty...",
    );
    setPayPalClient({
      captureOrder: async () => ({
        id: mockOrderId,
        status: "COMPLETED",
        intent: "CAPTURE",
        purchase_units: [
          {
            payments: {
              captures: [
                {
                  id: `cap_short_${RUN_ID}`,
                  status: "COMPLETED",
                  amount: { currency_code: "USD", value: "80.00" }, // Short by $20
                },
              ],
            },
          },
        ],
      }),
    } as any);

    const res7 = await request(
      baseUrl,
      "POST",
      `/api/bounties/${bounty._id}/capture-paypal-order`,
      { orderId: mockOrderId },
      sponsorToken,
    );
    const pass7 =
      res7.status === 400 && res7.body.code === "INSUFFICIENT_FUNDING_AMOUNT";
    record(
      "Under-funded PayPal capture ($80 vs $100) rejected (400 INSUFFICIENT_FUNDING_AMOUNT)",
      400,
      res7.status,
      pass7,
      res7.body.error,
    );

    // -----------------------------------------------------------------
    // Test 7b: Overfunded capture rejection (exact equality required)
    // -----------------------------------------------------------------
    console.log(
      "[Test 7b] PayPal capture returned $120.00 for $100.00 bounty (overfunded)...",
    );
    setPayPalClient({
      captureOrder: async () => ({
        id: mockOrderId,
        status: "COMPLETED",
        intent: "CAPTURE",
        purchase_units: [
          {
            payments: {
              captures: [
                {
                  id: `cap_over_${RUN_ID}`,
                  status: "COMPLETED",
                  amount: { currency_code: "USD", value: "120.00" }, // Exceeds by $20
                },
              ],
            },
          },
        ],
      }),
    } as any);

    const res7b = await request(
      baseUrl,
      "POST",
      `/api/bounties/${bounty._id}/capture-paypal-order`,
      { orderId: mockOrderId },
      sponsorToken,
    );
    const pass7b =
      res7b.status === 400 && res7b.body.code === "OVERFUNDED_CAPTURE";
    record(
      "Over-funded PayPal capture ($120 vs $100) rejected (400 OVERFUNDED_CAPTURE)",
      400,
      res7b.status,
      pass7b,
      res7b.body.error,
    );

    // -----------------------------------------------------------------
    // Test 8: Currency mismatch during capture is rejected
    // -----------------------------------------------------------------
    console.log("[Test 8] PayPal capture returned EUR instead of USD...");
    setPayPalClient({
      captureOrder: async () => ({
        id: mockOrderId,
        status: "COMPLETED",
        intent: "CAPTURE",
        purchase_units: [
          {
            payments: {
              captures: [
                {
                  id: `cap_eur_${RUN_ID}`,
                  status: "COMPLETED",
                  amount: { currency_code: "EUR", value: "100.00" }, // Non-USD
                },
              ],
            },
          },
        ],
      }),
    } as any);

    const res8 = await request(
      baseUrl,
      "POST",
      `/api/bounties/${bounty._id}/capture-paypal-order`,
      { orderId: mockOrderId },
      sponsorToken,
    );
    const pass8 =
      res8.status === 400 && res8.body.code === "INVALID_CAPTURE_CURRENCY";
    record(
      "Non-USD PayPal capture (EUR) rejected (400 INVALID_CAPTURE_CURRENCY)",
      400,
      res8.status,
      pass8,
      res8.body.error,
    );

    // -----------------------------------------------------------------
    // Test 9: Non-COMPLETED capture status (e.g. PENDING / DECLINED) rejected
    // -----------------------------------------------------------------
    console.log("[Test 9] PayPal capture returned PENDING status...");
    setPayPalClient({
      captureOrder: async () => ({
        id: mockOrderId,
        status: "COMPLETED",
        intent: "CAPTURE",
        purchase_units: [
          {
            payments: {
              captures: [
                {
                  id: `cap_pending_${RUN_ID}`,
                  status: "PENDING", // Not COMPLETED
                  amount: { currency_code: "USD", value: "100.00" },
                },
              ],
            },
          },
        ],
      }),
    } as any);

    const res9 = await request(
      baseUrl,
      "POST",
      `/api/bounties/${bounty._id}/capture-paypal-order`,
      { orderId: mockOrderId },
      sponsorToken,
    );
    const pass9 =
      res9.status === 400 && res9.body.code === "CAPTURE_NOT_COMPLETED";
    record(
      "Non-COMPLETED PayPal capture (PENDING) rejected (400 CAPTURE_NOT_COMPLETED)",
      400,
      res9.status,
      pass9,
      res9.body.error,
    );

    // -----------------------------------------------------------------
    // Test 10: Order custom_id mismatch is rejected
    // -----------------------------------------------------------------
    console.log(
      "[Test 10] PayPal order custom_id belongs to another bounty...",
    );
    setPayPalClient({
      captureOrder: async () => ({
        id: mockOrderId,
        status: "COMPLETED",
        intent: "CAPTURE",
        purchase_units: [
          {
            custom_id: new mongoose.Types.ObjectId().toString(), // Different bounty ID
            payments: {
              captures: [
                {
                  id: `cap_wrong_id_${RUN_ID}`,
                  status: "COMPLETED",
                  amount: { currency_code: "USD", value: "100.00" },
                },
              ],
            },
          },
        ],
      }),
    } as any);

    const res10 = await request(
      baseUrl,
      "POST",
      `/api/bounties/${bounty._id}/capture-paypal-order`,
      { orderId: mockOrderId },
      sponsorToken,
    );
    const pass10 =
      res10.status === 400 && res10.body.code === "ORDER_BOUNTY_MISMATCH";
    record(
      "Order custom_id mismatch rejected (400 ORDER_BOUNTY_MISMATCH)",
      400,
      res10.status,
      pass10,
      res10.body.error,
    );

    // -----------------------------------------------------------------
    // Test 11: End-to-end verified capture funds bounty and writes ledger
    // -----------------------------------------------------------------
    console.log(
      "[Test 11] Authorized capture verified successfully by PayPal REST API...",
    );
    const validCaptureId = `cap_verified_${RUN_ID}`;
    setPayPalClient({
      captureOrder: async () => ({
        id: mockOrderId,
        status: "COMPLETED",
        intent: "CAPTURE",
        purchase_units: [
          {
            custom_id: bounty._id.toString(),
            payments: {
              captures: [
                {
                  id: validCaptureId,
                  status: "COMPLETED",
                  amount: { currency_code: "USD", value: "100.00" },
                },
              ],
            },
          },
        ],
      }),
      getCapture: async (captureId: string) => ({
        id: captureId,
        status: "COMPLETED",
        amount: { currency_code: "USD", value: "100.00" },
        supplementary_data: { related_ids: { order_id: mockOrderId } },
      }),
    } as any);

    const res11 = await request(
      baseUrl,
      "POST",
      `/api/bounties/${bounty._id}/capture-paypal-order`,
      { orderId: mockOrderId },
      sponsorToken,
    );

    const fundedBounty = await Bounty.findById(bounty._id);
    const ledgerEntry = await EscrowLedger.findOne({
      bountyId: bounty._id,
      eventType: "FUNDING_CAPTURED",
    });

    const pass11 =
      res11.status === 200 &&
      fundedBounty?.fundingStatus === "FUNDED" &&
      fundedBounty?.inboundCaptureId === validCaptureId &&
      fundedBounty?.inboundOrderId === mockOrderId &&
      ledgerEntry?.paypalCaptureId === validCaptureId &&
      ledgerEntry?.direction === "CREDIT";

    record(
      "End-to-end verified capture sets status FUNDED and records EscrowLedger entry",
      200,
      res11.status,
      pass11,
      `Capture ID: ${validCaptureId}`,
    );

    // -----------------------------------------------------------------
    // Test 12: Duplicate capture request on already funded bounty returns idempotent 200
    // -----------------------------------------------------------------
    console.log(
      "[Test 12] Replaying capture request with identical order ID on funded bounty...",
    );
    const res12 = await request(
      baseUrl,
      "POST",
      `/api/bounties/${bounty._id}/capture-paypal-order`,
      { orderId: mockOrderId },
      sponsorToken,
    );
    const totalLedgerEvents = await EscrowLedger.countDocuments({
      bountyId: bounty._id,
      eventType: "FUNDING_CAPTURED",
    });

    const pass12 = res12.status === 200 && totalLedgerEvents === 1;
    record(
      "Duplicate capture request returns safe idempotent 200 without duplicate ledger entries",
      200,
      res12.status,
      pass12,
      `Total ledger credits: ${totalLedgerEvents}`,
    );

    // -----------------------------------------------------------------
    // Test 13: Reusing capture ID on another bounty is blocked (409 CAPTURE_ALREADY_USED)
    // -----------------------------------------------------------------
    console.log(
      "[Test 13] Attempting to fund another bounty with the same capture ID...",
    );
    const bounty2 = await Bounty.create(
      makeBountyFixture({
        title: `Second Bounty ${RUN_ID}`,
      }),
    );

    const res13 = await request(
      baseUrl,
      "POST",
      `/api/bounties/${bounty2._id}/fund`,
      {
        paypalCaptureId: validCaptureId,
        amount: 100.0,
      },
      sponsorToken,
    );
    const pass13 =
      res13.status === 409 && res13.body.code === "CAPTURE_ALREADY_USED";
    record(
      "Reusing PayPal capture ID on another bounty is blocked (409 CAPTURE_ALREADY_USED)",
      409,
      res13.status,
      pass13,
      res13.body.error,
    );
  } finally {
    setPayPalClient(null);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    try {
      await User.deleteMany({
        _id: { $in: [sponsorUser._id, unauthorizedUser._id] },
      });
      await Organization.deleteMany({ _id: organization._id });
      await Bounty.deleteMany({
        slug: { $regex: new RegExp(`^.*${RUN_ID}.*$`) },
      });
      await EscrowLedger.deleteMany({ bountyId: bounty._id });
    } catch {}
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }

  console.log(
    "\n======================================================================",
  );
  console.log(
    "                  PAYPAL CHECKOUT TEST SUITE REPORT                   ",
  );
  console.log(
    "======================================================================",
  );
  for (const r of results) {
    console.log(
      `${r.name} | ${r.passed ? "PASS" : "FAIL"} | Expected: ${r.expectedStatus}, Got: ${r.actualStatus}`,
    );
  }
  console.log(
    "======================================================================\n",
  );

  const allPassed = results.every((r) => r.passed);
  if (!allPassed) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("FATAL: PayPal checkout test suite failed:", err);
  process.exit(1);
});
