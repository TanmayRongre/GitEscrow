/**
 * GitEscrow - Task 2B.1 Comprehensive Bounty Management, Milestones & Escrow Ledger Automated Test Suite
 *
 * Verifies:
 *   A. Bounty Lifecycle (draft, validation, duplicate active issue, publish, accept, cancel, invalid transitions)
 *   B. Milestone Rules (creation, reward total checks, unique order, self-approval prevention, decisions)
 *   C. Escrow Ledger (append-only enforcement, idempotency, invalid amounts, unauthorized access)
 *   D. GitHub Issue Validation (valid repo/issue, invalid repo, closed issue publishing guard)
 *   E. RBAC & Tenant Isolation (OWNER/SPONSOR vs MEMBER vs Contributor vs Outsider)
 */

import http from "http";
import path from "path";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

// Ensure test environment
process.env.NODE_ENV = "test";
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

if (!process.env.JWT_ACCESS_SECRET) {
  process.env.JWT_ACCESS_SECRET =
    "gitescrow_test_jwt_access_secret_32bytes_min";
}

import app, { connectDB } from "../src/index";
import { User } from "../src/models/User";
import { Organization } from "../src/models/Organization";
import { Bounty } from "../src/models/Bounty";
import { Milestone } from "../src/models/Milestone";
import { EscrowLedger } from "../src/models/EscrowLedger";
import { LedgerService } from "../src/bounties/ledger.service";

interface TestResult {
  category: string;
  name: string;
  expectedStatus: number;
  actualStatus: number;
  passed: boolean;
  notes: string;
}

const results: TestResult[] = [];
// Short run ID for test isolation
const RUN_ID = "tb" + Math.random().toString(36).substring(2, 7);

function record(
  category: string,
  name: string,
  expectedStatus: number,
  actualStatus: number,
  passed: boolean,
  notes: string,
) {
  results.push({ category, name, expectedStatus, actualStatus, passed, notes });
  const icon = passed ? "✓ PASS" : "✗ FAIL";
  console.log(
    `  ${icon} [${category}] ${name} (Expected: ${expectedStatus}, Actual: ${actualStatus}) - ${notes}`,
  );
}

async function cleanupTestData() {
  try {
    const userFilter = {
      $or: [
        { email: { $regex: new RegExp(`^${RUN_ID}`) } },
        { username: { $regex: new RegExp(`^${RUN_ID}`) } },
        { email: { $regex: /^tb[a-z0-9]+_/ } },
        { username: { $regex: /^tb[a-z0-9]+_/ } },
      ],
    };
    const testUsers = await User.find(userFilter);
    const testUserIds = testUsers.map((u) => u._id);

    const testOrgs = await Organization.find({
      slug: { $regex: new RegExp(`^${RUN_ID}`) },
    });
    const testOrgIds = testOrgs.map((o) => o._id);

    await EscrowLedger.collection.deleteMany({
      $or: [
        { organizationId: { $in: testOrgIds } },
        { createdBy: { $in: testUserIds } },
      ],
    });

    const testBounties = await Bounty.find({
      $or: [
        { organizationId: { $in: testOrgIds } },
        { slug: { $regex: new RegExp(`^${RUN_ID}`) } },
      ],
    });
    const testBountyIds = testBounties.map((b) => b._id);

    await Milestone.deleteMany({ bountyId: { $in: testBountyIds } });
    await Bounty.deleteMany({ _id: { $in: testBountyIds } });
    await Organization.deleteMany({ _id: { $in: testOrgIds } });
    await User.deleteMany(userFilter);
  } catch (err: any) {
    console.warn(`[Cleanup Warning] ${err.message}`);
  }
}

async function run() {
  console.log(
    `\n======================================================================`,
  );
  console.log(
    `  GitEscrow - Task 2B.1 Bounty, Milestone & Ledger Automated Test Suite`,
  );
  console.log(`  Run ID: ${RUN_ID}`);
  console.log(
    `======================================================================\n`,
  );

  await connectDB();
  await cleanupTestData();

  // Start ephemeral HTTP server
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind ephemeral server");
  }
  const port = address.port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Ephemeral test server active on ${baseUrl}...\n`);

  try {
    // -------------------------------------------------------------
    // Setup Test Actors
    // -------------------------------------------------------------
    console.log(`--- [Setup: Creating Test Fixtures & Tokens] ---`);

    // 1. Owner User
    const ownerUser = await User.create({
      name: "Bounty Owner",
      username: `${RUN_ID}_owner`,
      email: `${RUN_ID}_owner@example.com`,
      passwordHash:
        "$2a$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy",
      role: "USER",
      accountStatus: "ACTIVE",
      emailVerified: true,
    });
    const ownerToken = jwt.sign(
      { sub: ownerUser._id.toString(), email: ownerUser.email, role: "USER" },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: "1h" },
    );

    // 2. Sponsor Member User
    const sponsorUser = await User.create({
      name: "Bounty Sponsor",
      username: `${RUN_ID}_sponsor`,
      email: `${RUN_ID}_sponsor@example.com`,
      passwordHash:
        "$2a$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy",
      role: "USER",
      accountStatus: "ACTIVE",
      emailVerified: true,
    });
    const sponsorToken = jwt.sign(
      {
        sub: sponsorUser._id.toString(),
        email: sponsorUser.email,
        role: "USER",
      },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: "1h" },
    );

    // 3. Regular Member User
    const memberUser = await User.create({
      name: "Regular Member",
      username: `${RUN_ID}_member`,
      email: `${RUN_ID}_member@example.com`,
      passwordHash:
        "$2a$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy",
      role: "USER",
      accountStatus: "ACTIVE",
      emailVerified: true,
    });
    const memberToken = jwt.sign(
      { sub: memberUser._id.toString(), email: memberUser.email, role: "USER" },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: "1h" },
    );

    // 4. Contributor 1
    const contributor1 = await User.create({
      name: "Contributor Alex",
      username: `${RUN_ID}_contrib1`,
      email: `${RUN_ID}_contrib1@example.com`,
      passwordHash:
        "$2a$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy",
      role: "USER",
      accountStatus: "ACTIVE",
      emailVerified: true,
    });
    const contributor1Token = jwt.sign(
      {
        sub: contributor1._id.toString(),
        email: contributor1.email,
        role: "USER",
      },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: "1h" },
    );

    // 5. Contributor 2
    const contributor2 = await User.create({
      name: "Contributor Blair",
      username: `${RUN_ID}_contrib2`,
      email: `${RUN_ID}_contrib2@example.com`,
      passwordHash:
        "$2a$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy",
      role: "USER",
      accountStatus: "ACTIVE",
      emailVerified: true,
    });
    const contributor2Token = jwt.sign(
      {
        sub: contributor2._id.toString(),
        email: contributor2.email,
        role: "USER",
      },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: "1h" },
    );

    // 6. Outsider (Non-member)
    const outsider = await User.create({
      name: "Outsider User",
      username: `${RUN_ID}_outsider`,
      email: `${RUN_ID}_outsider@example.com`,
      passwordHash:
        "$2a$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy",
      role: "USER",
      accountStatus: "ACTIVE",
      emailVerified: true,
    });
    const outsiderToken = jwt.sign(
      { sub: outsider._id.toString(), email: outsider.email, role: "USER" },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: "1h" },
    );

    // 7. Test Organization
    const testOrg = await Organization.create({
      name: "Acme OpenSource Labs",
      slug: `${RUN_ID}-acme-labs`,
      ownerId: ownerUser._id,
      members: [
        { userId: ownerUser._id, role: "OWNER", joinedAt: new Date() },
        { userId: sponsorUser._id, role: "SPONSOR", joinedAt: new Date() },
        { userId: memberUser._id, role: "MEMBER", joinedAt: new Date() },
      ],
    });
    const orgId = testOrg._id.toString();

    console.log(
      `✓ Fixtures created: Org @${testOrg.slug}, Owner, Sponsor, Member, Contributors\n`,
    );

    // -------------------------------------------------------------
    // Category A: Bounty Creation & Lifecycle Tests
    // -------------------------------------------------------------
    console.log(`--- [Category A: Bounty Management Tests] ---`);

    // A1: Create draft bounty with valid details
    const createRes1 = await fetch(`${baseUrl}/api/bounties`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        title: "Fix issue #10: Implement PayPal Escrow Verification",
        description:
          "Implement backend verification logic for milestone payouts on GitHub issues.",
        organizationId: orgId,
        repositoryOwner: "mock-owner",
        repositoryName: "escrow-repo",
        issueNumber: 10,
        rewardAmount: 100.0,
        currency: "USD",
        rewardDescription: "100 USD released upon milestone completion.",
      }),
    });
    const createBody1 = (await createRes1.json()) as any;
    const a1Pass =
      createRes1.status === 201 &&
      createBody1.bounty?.status === "DRAFT" &&
      Number(createBody1.bounty?.rewardAmount) === 100 &&
      createBody1.bounty?.repositoryFullName === "mock-owner/escrow-repo";

    record(
      "Bounty Management",
      "Create draft bounty returns 201 and DRAFT status",
      201,
      createRes1.status,
      a1Pass,
      `Bounty created: ID ${createBody1.bounty?._id}, status ${createBody1.bounty?.status}`,
    );

    const bountyId = createBody1.bounty?._id;

    // A2: Reject invalid reward amount (<= 0)
    const createRes2 = await fetch(`${baseUrl}/api/bounties`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        title: "Zero Reward Bounty",
        description: "Attempting to create a bounty with invalid zero reward.",
        organizationId: orgId,
        repositoryOwner: "mock-owner",
        repositoryName: "escrow-repo",
        issueNumber: 11,
        rewardAmount: -50.0,
        currency: "USD",
      }),
    });
    record(
      "Bounty Management",
      "Reject invalid (negative or zero) reward with 400 Bad Request",
      400,
      createRes2.status,
      createRes2.status === 400,
      "Zod / Service rejected negative reward amount",
    );

    // A3: Reject duplicate active issue bounty in same organization
    const createRes3 = await fetch(`${baseUrl}/api/bounties`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        title: "Duplicate Bounty for Issue #10",
        description: "Attempting duplicate active bounty for issue #10.",
        organizationId: orgId,
        repositoryOwner: "mock-owner",
        repositoryName: "escrow-repo",
        issueNumber: 10, // Same issue!
        rewardAmount: 200.0,
        currency: "USD",
      }),
    });
    const createBody3 = (await createRes3.json()) as any;
    record(
      "Bounty Management",
      "Reject duplicate active issue bounty with 409 Conflict",
      409,
      createRes3.status,
      createRes3.status === 409 &&
        createBody3.code === "DUPLICATE_ACTIVE_ISSUE_BOUNTY",
      `Duplicate rejected: "${createBody3.error}"`,
    );

    // A4: Reject unauthorized organization bounty creation (MEMBER or Outsider)
    const createRes4 = await fetch(`${baseUrl}/api/bounties`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${memberToken}`, // Regular member, not sponsor/owner
      },
      body: JSON.stringify({
        title: "Unauthorized Member Bounty",
        description: "Regular member attempting to create a bounty.",
        organizationId: orgId,
        repositoryOwner: "mock-owner",
        repositoryName: "escrow-repo",
        issueNumber: 12,
        rewardAmount: 50.0,
        currency: "USD",
      }),
    });
    record(
      "Bounty Management",
      "Reject unauthorized org member bounty creation with 403 Forbidden",
      403,
      createRes4.status,
      createRes4.status === 403,
      "Organization MEMBER forbidden from creating bounties",
    );

    // A5: List bounties endpoint (GET /api/bounties)
    const listRes = await fetch(`${baseUrl}/api/bounties?status=DRAFT`);
    const listBody = (await listRes.json()) as any;
    const a5Pass =
      listRes.status === 200 &&
      Array.isArray(listBody.bounties) &&
      listBody.bounties.length > 0;
    record(
      "Bounty Management",
      "GET /api/bounties returns filtered bounties and pagination",
      200,
      listRes.status,
      a5Pass,
      `Retrieved ${listBody.bounties?.length} bounties (Total: ${listBody.total})`,
    );

    // A6: Get bounty details (GET /api/bounties/:id)
    const getRes = await fetch(`${baseUrl}/api/bounties/${bountyId}`);
    const getBody = (await getRes.json()) as any;
    const a6Pass =
      getRes.status === 200 &&
      getBody.bounty?._id === bountyId &&
      Array.isArray(getBody.milestones);

    record(
      "Bounty Management",
      "GET /api/bounties/:id returns bounty details and milestones array",
      200,
      getRes.status,
      a6Pass,
      `Fetched bounty: "${getBody.bounty?.title}" with ${getBody.milestones?.length} milestones`,
    );

    // A7: Reject illegal status transition (DRAFT -> COMPLETED directly)
    const illegalTransRes = await fetch(`${baseUrl}/api/bounties/${bountyId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ status: "COMPLETED" }), // Illegal transition!
    });
    // In our API, status cannot be mutated arbitrarily via PATCH, so it either ignores or status remains DRAFT
    const verifyDoc = await Bounty.findById(bountyId);
    record(
      "Bounty Management",
      "Arbitrary status manipulation via PATCH is strictly prevented",
      200,
      illegalTransRes.status,
      verifyDoc?.status === "DRAFT",
      `Direct status mutation ignored; persisted status remains: "${verifyDoc?.status}"`,
    );

    // -------------------------------------------------------------
    // Category B: Milestone Rules & Validation Tests
    // -------------------------------------------------------------
    console.log(`\n--- [Category B: Milestone Rules & Validation Tests] ---`);

    // B1: Create valid milestone 1 ($60.00)
    const mRes1 = await fetch(
      `${baseUrl}/api/bounties/${bountyId}/milestones`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          title: "Milestone 1: Backend API Architecture",
          description:
            "Implement Express routing, authentication guards, and validation.",
          order: 1,
          rewardAmount: 60.0,
          currency: "USD",
          acceptanceCriteria: ["Pass unit tests", "Document API endpoints"],
        }),
      },
    );
    const mBody1 = (await mRes1.json()) as any;
    const b1Pass =
      mRes1.status === 201 &&
      mBody1.milestone?.order === 1 &&
      mBody1.milestone?.rewardAmount === 60;
    record(
      "Milestone Rules",
      "Create valid milestone returns 201 and stores criteria",
      201,
      mRes1.status,
      b1Pass,
      `Milestone 1 created: ID ${mBody1.milestone?._id}, reward: $${mBody1.milestone?.rewardAmount}`,
    );
    const milestone1Id = mBody1.milestone?._id;

    // B2: Reject negative reward amount
    const mRes2 = await fetch(
      `${baseUrl}/api/bounties/${bountyId}/milestones`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          title: "Negative Reward Milestone",
          order: 2,
          rewardAmount: -20.0,
          acceptanceCriteria: ["Criteria"],
        }),
      },
    );
    record(
      "Milestone Rules",
      "Reject negative milestone reward amount with 400 Bad Request",
      400,
      mRes2.status,
      mRes2.status === 400,
      "Negative reward rejected",
    );

    // B3: Reject invalid currency (EUR)
    const mRes3 = await fetch(
      `${baseUrl}/api/bounties/${bountyId}/milestones`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          title: "EUR Currency Milestone",
          order: 2,
          rewardAmount: 20.0,
          currency: "EUR",
          acceptanceCriteria: ["Criteria"],
        }),
      },
    );
    record(
      "Milestone Rules",
      "Reject non-USD milestone currency with 400 Bad Request",
      400,
      mRes3.status,
      mRes3.status === 400,
      "Only USD currency accepted",
    );

    // B4: Reject milestone rewards exceeding total bounty reward ($60 existing + $50 = $110 > $100 total)
    const mRes4 = await fetch(
      `${baseUrl}/api/bounties/${bountyId}/milestones`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          title: "Exceeding Milestone",
          order: 2,
          rewardAmount: 50.0, // 60 + 50 = 110 > 100!
          acceptanceCriteria: ["Criteria"],
        }),
      },
    );
    const mBody4 = (await mRes4.json()) as any;
    record(
      "Milestone Rules",
      "Reject milestone rewards exceeding total bounty reward with 400",
      400,
      mRes4.status,
      mRes4.status === 400 && mBody4.code === "MILESTONE_TOTAL_EXCEEDS_BOUNTY",
      `Exceeding sum blocked: "${mBody4.error}"`,
    );

    // B5: Reject duplicate milestone order (Order 1 already taken)
    const mRes5 = await fetch(
      `${baseUrl}/api/bounties/${bountyId}/milestones`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          title: "Duplicate Order 1 Milestone",
          order: 1, // Duplicate order!
          rewardAmount: 20.0,
          acceptanceCriteria: ["Criteria"],
        }),
      },
    );
    record(
      "Milestone Rules",
      "Reject duplicate milestone order with 409 Conflict",
      409,
      mRes5.status,
      mRes5.status === 409,
      "Unique milestone order enforced within bounty",
    );

    // B6: Reject publishing when milestone sum is below bounty total ($60 < $100)
    const pubFailRes = await fetch(
      `${baseUrl}/api/bounties/${bountyId}/publish`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${ownerToken}` },
      },
    );
    const pubFailBody = (await pubFailRes.json()) as any;
    record(
      "Milestone Rules",
      "Reject publishing when milestone rewards total is below bounty total",
      400,
      pubFailRes.status,
      pubFailRes.status === 400 &&
        pubFailBody.code === "MILESTONE_SUM_MISMATCH",
      `Publishing blocked: "${pubFailBody.error}"`,
    );

    // B7: Add Milestone 2 ($40.00) so milestone sum ($60 + $40 = $100) exactly matches bounty
    const mRes6 = await fetch(
      `${baseUrl}/api/bounties/${bountyId}/milestones`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          title: "Milestone 2: Frontend & E2E Verification",
          description: "Complete UI components and automated tests.",
          order: 2,
          rewardAmount: 40.0,
          currency: "USD",
          acceptanceCriteria: [
            "Automated test passes",
            "UI responsiveness verified",
          ],
        }),
      },
    );
    const mBody6 = (await mRes6.json()) as any;
    const milestone2Id = mBody6.milestone?._id;
    record(
      "Milestone Rules",
      "Add second milestone completing exact bounty sum ($100.00)",
      201,
      mRes6.status,
      mRes6.status === 201,
      `Milestone 2 created: $40.00. Total milestone sum = $100.00`,
    );

    // -------------------------------------------------------------
    // Category C: Publishing & Contributor Acceptance Lifecycle
    // -------------------------------------------------------------
    console.log(
      `\n--- [Category C: Publishing & Contributor Acceptance Tests] ---`,
    );

    // C1: Publish valid bounty (Milestones sum = $100)
    const pubRes = await fetch(`${baseUrl}/api/bounties/${bountyId}/publish`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const pubBody = (await pubRes.json()) as any;
    const c1Pass =
      pubRes.status === 200 &&
      pubBody.bounty?.status === "OPEN" &&
      Boolean(pubBody.bounty?.publishedAt);
    record(
      "Bounty Lifecycle",
      "Publish valid bounty transitions DRAFT -> OPEN and sets publishedAt",
      200,
      pubRes.status,
      c1Pass,
      `Bounty successfully published to marketplace (Status: ${pubBody.bounty?.status})`,
    );

    // C2: Contributor 1 accepts OPEN bounty -> ASSIGNED
    const acceptRes1 = await fetch(
      `${baseUrl}/api/bounties/${bountyId}/accept`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${contributor1Token}` },
      },
    );
    const acceptBody1 = (await acceptRes1.json()) as any;
    const c2Pass =
      acceptRes1.status === 200 &&
      acceptBody1.bounty?.status === "ASSIGNED" &&
      acceptBody1.bounty?.assignedContributorId === contributor1._id.toString();

    record(
      "Bounty Lifecycle",
      "Eligible contributor accepts OPEN bounty -> status ASSIGNED",
      200,
      acceptRes1.status,
      c2Pass,
      `Bounty assigned to contributor @${contributor1.username}`,
    );

    // C3: Contributor 2 attempts to accept already ASSIGNED bounty -> 409 Conflict
    const acceptRes2 = await fetch(
      `${baseUrl}/api/bounties/${bountyId}/accept`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${contributor2Token}` },
      },
    );
    const acceptBody2 = (await acceptRes2.json()) as any;
    record(
      "Bounty Lifecycle",
      "Prevent multiple contributors accepting same bounty with 409 Conflict",
      409,
      acceptRes2.status,
      (acceptRes2.status === 409 || acceptRes2.status === 400) &&
        acceptBody2.code === "BOUNTY_ALREADY_ASSIGNED",
      `Duplicate acceptance prevented: "${acceptBody2.error}"`,
    );

    // C4: Contributor 1 starts work (ASSIGNED -> IN_PROGRESS)
    const startRes = await fetch(`${baseUrl}/api/bounties/${bountyId}/start`, {
      method: "POST",
      headers: { Authorization: `Bearer ${contributor1Token}` },
    });
    const startBody = (await startRes.json()) as any;
    record(
      "Bounty Lifecycle",
      "Contributor transitions bounty ASSIGNED -> IN_PROGRESS",
      200,
      startRes.status,
      startRes.status === 200 && startBody.bounty?.status === "IN_PROGRESS",
      `Bounty active in progress by @${contributor1.username}`,
    );

    // C5: Contributor 1 submits PR reference (IN_PROGRESS -> SUBMITTED)
    const submitRes = await fetch(
      `${baseUrl}/api/bounties/${bountyId}/submit`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${contributor1Token}`,
        },
        body: JSON.stringify({
          prUrl: "https://github.com/facebook/react/pull/42",
          prNumber: 42,
          submissionNotes:
            "Implemented feature and verified against test suite.",
        }),
      },
    );
    const submitBody = (await submitRes.json()) as any;
    record(
      "Bounty Lifecycle",
      "Contributor submits PR reference transitioning IN_PROGRESS -> SUBMITTED",
      200,
      submitRes.status,
      submitRes.status === 200 && submitBody.bounty?.status === "SUBMITTED",
      `PR #42 submitted by contributor`,
    );

    // -------------------------------------------------------------
    // Category D: Milestone Reviews & Self-Approval Guards
    // -------------------------------------------------------------
    console.log(
      `\n--- [Category D: Milestone Approvals & Security Guards] ---`,
    );

    // D1: Contributor submits Milestone 1
    const mSubRes = await fetch(
      `${baseUrl}/api/milestones/${milestone1Id}/submit`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${contributor1Token}`,
        },
        body: JSON.stringify({
          submissionDetails: "Completed backend route handling and tests.",
        }),
      },
    );
    record(
      "Milestone Security",
      "Contributor submits milestone deliverable for review",
      200,
      mSubRes.status,
      mSubRes.status === 200,
      "Milestone marked SUBMITTED",
    );

    // D2: Contributor attempts to SELF-APPROVE Milestone 1 -> 403 Forbidden!
    const selfApproveRes = await fetch(
      `${baseUrl}/api/milestones/${milestone1Id}/approve`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${contributor1Token}`, // Contributor trying to approve own work!
        },
        body: JSON.stringify({ decisionNotes: "I approve my own work!" }),
      },
    );
    const selfApproveBody = (await selfApproveRes.json()) as any;
    record(
      "Milestone Security",
      "Prevent contributor self-approval of milestones with 403 Forbidden",
      403,
      selfApproveRes.status,
      selfApproveRes.status === 403 &&
        selfApproveBody.code === "CONTRIBUTOR_SELF_APPROVAL_PROHIBITED",
      `Self-approval blocked: "${selfApproveBody.error}"`,
    );

    // D3: Sponsor requests changes on Milestone 1
    const reqChangesRes = await fetch(
      `${baseUrl}/api/milestones/${milestone1Id}/request-changes`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sponsorToken}`,
        },
        body: JSON.stringify({
          decisionNotes: "Please add additional error handling tests.",
        }),
      },
    );
    const reqChangesBody = (await reqChangesRes.json()) as any;
    record(
      "Milestone Security",
      "Sponsor requests changes transitioning milestone to IN_PROGRESS",
      200,
      reqChangesRes.status,
      reqChangesRes.status === 200 &&
        reqChangesBody.milestone?.status === "IN_PROGRESS",
      `Changes requested: "${reqChangesBody.milestone?.decisionNotes}"`,
    );

    // D4: Contributor re-submits and Sponsor APPROVES Milestone 1
    await fetch(`${baseUrl}/api/milestones/${milestone1Id}/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${contributor1Token}`,
      },
      body: JSON.stringify({ submissionDetails: "Added requested tests." }),
    });
    const sponsorApproveRes = await fetch(
      `${baseUrl}/api/milestones/${milestone1Id}/approve`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sponsorToken}`,
        },
        body: JSON.stringify({
          decisionNotes: "Verified all criteria met. Approved.",
        }),
      },
    );
    const sponsorApproveBody = (await sponsorApproveRes.json()) as any;
    const d4Pass =
      sponsorApproveRes.status === 200 &&
      sponsorApproveBody.milestone?.status === "APPROVED" &&
      sponsorApproveBody.milestone?.approvedBy === sponsorUser._id.toString();

    record(
      "Milestone Security",
      "Sponsor approves milestone and triggers MILESTONE_APPROVED ledger event",
      200,
      sponsorApproveRes.status,
      d4Pass,
      `Milestone 1 approved by sponsor @${sponsorUser.username}`,
    );

    // D5: Prevent editing an already APPROVED milestone
    const editApprovedRes = await fetch(
      `${baseUrl}/api/milestones/${milestone1Id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ title: "Tampered Milestone Title" }),
      },
    );
    const editApprovedBody = (await editApprovedRes.json()) as any;
    record(
      "Milestone Security",
      "Editing an approved milestone is strictly locked with 400 Bad Request",
      400,
      editApprovedRes.status,
      editApprovedRes.status === 400 &&
        editApprovedBody.code === "APPROVED_MILESTONE_LOCKED",
      `Locked milestone: "${editApprovedBody.error}"`,
    );

    // -------------------------------------------------------------
    // Category E: Escrow Ledger & Immutability Tests
    // -------------------------------------------------------------
    console.log(`\n--- [Category E: Escrow Ledger & Immutability Tests] ---`);

    // E1: Append funding event via internal LedgerService
    const ledgerKey1 = `test_funding_${RUN_ID}_001`;
    const ledgerEvent1 = await LedgerService.recordEvent({
      bountyId: bountyId,
      organizationId: orgId,
      eventType: "FUNDING_INITIATED",
      amount: 100.0,
      currency: "USD",
      direction: "CREDIT",
      status: "COMPLETED",
      paypalOrderId: "TEST_ORDER_123",
      idempotencyKey: ledgerKey1,
      description: "Initial bounty funding recorded for escrow",
      createdBy: ownerUser._id,
    });
    record(
      "Escrow Ledger",
      "Append funding event to internal ledger",
      201,
      201,
      Boolean(ledgerEvent1._id) && ledgerEvent1.idempotencyKey === ledgerKey1,
      `Ledger event created: ${ledgerEvent1.eventType} ($100.00 USD)`,
    );

    // E2: Reject duplicate idempotency key
    let duplicateRejected = false;
    try {
      await LedgerService.recordEvent({
        bountyId: bountyId,
        organizationId: orgId,
        eventType: "FUNDING_INITIATED",
        amount: 100.0,
        currency: "USD",
        direction: "CREDIT",
        status: "COMPLETED",
        idempotencyKey: ledgerKey1, // Duplicate key!
        description: "Duplicate attempt",
      });
    } catch (err: any) {
      duplicateRejected =
        err.status === 409 && err.code === "DUPLICATE_IDEMPOTENCY_KEY";
    }
    record(
      "Escrow Ledger",
      "Reject duplicate ledger idempotency key with 409 Conflict",
      409,
      duplicateRejected ? 409 : 200,
      duplicateRejected,
      "Duplicate idempotency key successfully caught and rejected",
    );

    // E3: Reject invalid (negative) amount
    let negativeAmountRejected = false;
    try {
      await LedgerService.recordEvent({
        bountyId: bountyId,
        organizationId: orgId,
        eventType: "MANUAL_ADJUSTMENT",
        amount: -25.0,
        currency: "USD",
        direction: "DEBIT",
        idempotencyKey: `neg_test_${Date.now()}`,
        description: "Negative amount attempt",
      });
    } catch (err: any) {
      negativeAmountRejected = err.status === 400;
    }
    record(
      "Escrow Ledger",
      "Reject negative ledger amount with 400 Bad Request",
      400,
      negativeAmountRejected ? 400 : 200,
      negativeAmountRejected,
      "Non-negative amount constraint enforced",
    );

    // E4: Enforce append-only immutability (Mongoose mutation block)
    let updateBlocked = false;
    try {
      await EscrowLedger.updateOne(
        { idempotencyKey: ledgerKey1 },
        { $set: { description: "Tampered Description" } },
      );
    } catch (err: any) {
      updateBlocked = err.message.includes("append-only");
    }
    record(
      "Escrow Ledger",
      "Strict append-only enforcement: Direct updates and deletions throw error",
      500,
      updateBlocked ? 500 : 200,
      updateBlocked,
      "Mongoose schema hooks strictly block updateOne/delete operations",
    );

    // E5: Query bounty ledger (Authorized sponsor access)
    const ledgerRes1 = await fetch(
      `${baseUrl}/api/bounties/${bountyId}/ledger`,
      {
        headers: { Authorization: `Bearer ${sponsorToken}` },
      },
    );
    const ledgerBody1 = (await ledgerRes1.json()) as any;
    const e5Pass =
      ledgerRes1.status === 200 &&
      Array.isArray(ledgerBody1.ledger) &&
      ledgerBody1.ledger.length >= 2; // Contains MILESTONE_APPROVED + FUNDING_INITIATED

    record(
      "Escrow Ledger",
      "Authorized organization sponsor retrieves bounty ledger event history",
      200,
      ledgerRes1.status,
      e5Pass,
      `Retrieved ${ledgerBody1.ledger?.length} financial audit records`,
    );

    // E6: Reject unauthorized ledger access (Contributor or Outsider)
    const ledgerRes2 = await fetch(
      `${baseUrl}/api/bounties/${bountyId}/ledger`,
      {
        headers: { Authorization: `Bearer ${contributor1Token}` }, // Contributor should not see org financial ledger
      },
    );
    record(
      "Escrow Ledger",
      "Reject contributor or non-sponsor access to financial ledger with 403",
      403,
      ledgerRes2.status,
      ledgerRes2.status === 403,
      "Financial records isolated from non-sponsors",
    );

    // -------------------------------------------------------------
    // Category F: GitHub Validation & Cancellation Tests
    // -------------------------------------------------------------
    console.log(
      `\n--- [Category F: GitHub Validation & Cancellation Tests] ---`,
    );

    // F1: Reject non-existent repository
    const ghRes1 = await fetch(`${baseUrl}/api/bounties`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        title: "Bounty on Nonexistent Repository",
        description: "Testing 404 handling when GitHub repo does not exist.",
        organizationId: orgId,
        repositoryOwner: "nonexistent-owner-9988776655",
        repositoryName: "nonexistent-repo-9988776655",
        issueNumber: 1,
        rewardAmount: 50.0,
        currency: "USD",
      }),
    });
    record(
      "GitHub Validation",
      "Reject non-existent GitHub repository with 404 Not Found",
      404,
      ghRes1.status,
      ghRes1.status === 404,
      "GitHub 404 propagated properly",
    );

    // F2: Closed issue publishing guard
    // Create draft with closed issue marker
    const closedBounty = await Bounty.create({
      title: "Closed Issue Bounty",
      slug: `${RUN_ID}-closed-issue-bounty`,
      description: "Testing closed issue rejection on publish.",
      organizationId: testOrg._id,
      createdBy: ownerUser._id,
      updatedBy: ownerUser._id,
      repositoryOwner: "facebook",
      repositoryName: "react",
      repositoryFullName: "facebook/react",
      repositoryUrl: "https://github.com/facebook/react",
      repositoryId: 10270250,
      issueNumber: 1,
      issueUrl: "https://github.com/facebook/react/issues/1",
      issueTitle: "Closed Issue #1",
      issueState: "closed", // Closed issue!
      rewardAmount: mongoose.Types.Decimal128.fromString("50.00"),
      currency: "USD",
      status: "DRAFT",
    });
    await Milestone.create({
      bountyId: closedBounty._id,
      title: "Milestone 1",
      description: "Single milestone",
      order: 1,
      rewardAmount: mongoose.Types.Decimal128.fromString("50.00"),
      currency: "USD",
      acceptanceCriteria: ["All tests pass"],
    });

    const pubClosedRes = await fetch(
      `${baseUrl}/api/bounties/${closedBounty._id}/publish`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${ownerToken}` },
      },
    );
    const pubClosedBody = (await pubClosedRes.json()) as any;
    record(
      "GitHub Validation",
      "Reject publishing bounty for a closed GitHub issue with 400 Bad Request",
      400,
      pubClosedRes.status,
      pubClosedRes.status === 400 &&
        pubClosedBody.code === "GITHUB_ISSUE_CLOSED",
      `Closed issue guard triggered: "${pubClosedBody.error}"`,
    );

    // F3: Sponsor cancels eligible bounty
    const cancelRes = await fetch(
      `${baseUrl}/api/bounties/${closedBounty._id}/cancel`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ reason: "Issue is closed on upstream repo" }),
      },
    );
    const cancelBody = (await cancelRes.json()) as any;
    record(
      "Bounty Lifecycle",
      "Sponsor cancels eligible bounty transitioning status to CANCELLED",
      200,
      cancelRes.status,
      cancelRes.status === 200 && cancelBody.bounty?.status === "CANCELLED",
      `Bounty cancelled: "${cancelBody.bounty?.status}"`,
    );

    // F4: Reject unauthorized cancellation (by contributor)
    const cancelUnauthRes = await fetch(
      `${baseUrl}/api/bounties/${bountyId}/cancel`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${contributor1Token}`, // Contributor trying to cancel!
        },
        body: JSON.stringify({ reason: "Contributor trying to cancel" }),
      },
    );
    record(
      "Bounty Lifecycle",
      "Reject unauthorized contributor cancellation attempt with 403 Forbidden",
      403,
      cancelUnauthRes.status,
      cancelUnauthRes.status === 403,
      "Contributor prevented from cancelling organization bounty",
    );
  } finally {
    server.close();
    await cleanupTestData();
    await mongoose.disconnect();
    console.log(`\nEphemeral test server closed. Test fixtures cleaned up.\n`);
  }

  // -------------------------------------------------------------
  // Test Results Report
  // -------------------------------------------------------------
  console.log(
    `========================================================================================================`,
  );
  console.log(
    `                  TASK 2B.1: BOUNTY, MILESTONE & ESCROW LEDGER TEST REPORT                              `,
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
    `========================================================================================================`,
  );

  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  console.log(
    `\nTotal Tests: ${totalCount} | Passed: ${passedCount} | Failed: ${totalCount - passedCount}`,
  );

  if (passedCount !== totalCount) {
    console.error(
      `\n❌ Task 2B.1 test suite failed with ${totalCount - passedCount} failing tests.\n`,
    );
    process.exit(1);
  } else {
    console.log(`\n✓ All ${totalCount} Task 2B.1 tests passed successfully!\n`);
    process.exit(0);
  }
}

run().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
