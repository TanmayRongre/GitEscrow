import mongoose from "mongoose";
import puppeteer from "puppeteer-core";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { User } from "../src/models/User";
import { Organization } from "../src/models/Organization";
import { Bounty } from "../src/models/Bounty";
import { Milestone } from "../src/models/Milestone";
import { PasswordService } from "../src/auth/password.service";
import { TokenService } from "../src/auth/token.service";
import type { AcceptanceVerificationResult } from "../src/ai/pr-verification.types";

const MONGO_URI = process.env.MONGODB_URI!;
const CHROME_PATH =
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ARTIFACTS_DIR = path.resolve(process.cwd(), "artifacts/screens");

async function main() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB.");

  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }

  // 1. Create or find Demo Sponsor & Contributor
  const passwordHash = await PasswordService.hashPassword("Password123!");

  let sponsor = await User.findOne({ email: "sponsor_screen@example.com" });
  if (!sponsor) {
    sponsor = await User.create({
      username: "screenshot_sponsor",
      email: "sponsor_screen@example.com",
      passwordHash,
      role: "USER",
      name: "Alex Rivera",
      displayName: "Alex Rivera (Lead Sponsor)",
      reputationScore: 100,
    });
  }

  let contributor = await User.findOne({
    email: "contributor_screen@example.com",
  });
  if (!contributor) {
    contributor = await User.create({
      username: "screenshot_contributor",
      email: "contributor_screen@example.com",
      passwordHash,
      role: "USER",
      name: "Elena Rostova",
      displayName: "Elena Rostova (Core Contributor)",
      reputationScore: 85,
    });
  }

  let org = await Organization.findOne({ slug: "react-core-team" });
  if (!org) {
    org = await Organization.create({
      name: "React Core Team",
      slug: "react-core-team",
      description: "Official React repository maintainers",
      ownerId: sponsor._id,
      members: [
        { userId: sponsor._id, role: "OWNER" },
        { userId: contributor._id, role: "MEMBER" },
      ],
    });
  }

  // 2. Create or find Bounty with Real GitHub Issue
  let bounty = await Bounty.findOne({
    issueNumber: 38090,
    repositoryFullName: "facebook/react",
  });
  if (!bounty) {
    bounty = await Bounty.create({
      title: "[Fizz] Use the script nonce for bootstrap script preloads",
      slug: "react-fizz-nonce-demo",
      description:
        "Ensure that Fizz server rendering passes the nonce attribute down to bootstrap script preloads to satisfy strict Content Security Policies (CSP).",
      repositoryOwner: "facebook",
      repositoryName: "react",
      repositoryFullName: "facebook/react",
      repositoryUrl: "https://github.com/facebook/react",
      repositoryId: 10270250,
      issueNumber: 38090,
      issueTitle: "[Fizz] Use the script nonce for bootstrap script preloads",
      issueUrl: "https://github.com/facebook/react/issues/38090",
      issueState: "open",
      issueLabels: [
        "Component: Fizz",
        "Type: Feature Request",
        "Security: CSP",
      ],
      organizationId: org._id,
      createdBy: sponsor._id,
      updatedBy: sponsor._id,
      assignedContributorId: contributor._id,
      status: "OPEN",
      rewardAmount: mongoose.Types.Decimal128.fromString("250.00"),
      currency: "USD",
      claimedRewardCents: 25000,
      publishedAt: new Date(),
    });
  } else {
    bounty.status = "OPEN";
    bounty.assignedContributorId = contributor._id;
    await bounty.save();
  }

  // Verification fixture conforming to AcceptanceVerificationResult
  const sampleVerification: any = {
    overallAssessment: "PASS",
    summary:
      "The pull request successfully passes the script nonce parameter down through ReactDOMServer.renderToPipeableStream options and propagates it to bootstrap script preloads. Unit test coverage demonstrates full compliance with strict Content Security Policy requirements.",
    confidence: {
      score: 0.94,
      level: "HIGH",
      rationale:
        "Found explicit nonce propagation in packages/react-dom/src/server/ReactDOMFizzServerNode.js, passing automated unit tests in ReactDOMServerFizz-test.js, and clean GitHub Actions CI status.",
    },
    criteriaEvaluations: [
      {
        criterion:
          "Pass script nonce option down through ReactDOMServer.renderToPipeableStream and renderToReadableStream",
        status: "MET",
        evidence:
          "Modified packages/react-dom/src/server/ReactDOMFizzServerNode.js and ReactDOMFizzServerBrowser.js to accept nonce in options and forward to bootstrap tags.",
        matchedFiles: [
          "packages/react-dom/src/server/ReactDOMFizzServerNode.js",
          "packages/react-dom/src/server/ReactDOMFizzServerBrowser.js",
        ],
      },
      {
        criterion:
          "Add automated unit tests verifying script nonce renders correctly in preloaded bootstrap script tags",
        status: "MET",
        evidence:
          "Added 4 test cases in packages/react-dom/src/__tests__/ReactDOMServerFizz-test.js asserting nonce='rAnd0m123' appears in <link rel='preload' as='script'> and bootstrap <script>.",
        matchedFiles: [
          "packages/react-dom/src/__tests__/ReactDOMServerFizz-test.js",
        ],
      },
      {
        criterion: "Ensure all CI lint and test suites pass without regression",
        status: "MET",
        evidence:
          "All 18 check runs and commit status contexts completed with conclusion SUCCESS.",
        matchedFiles: [],
      },
    ],
    codeReferences: [
      "packages/react-dom/src/server/ReactDOMFizzServerNode.js:L142-L175",
      "packages/react-dom/src/server/ReactDOMFizzServerBrowser.js:L98-L120",
      "packages/react-dom/src/__tests__/ReactDOMServerFizz-test.js:L310-L365",
    ],
    ciStatusSummary: {
      state: "PASSED",
      totalChecks: 18,
      passed: 18,
      failed: 0,
      pending: 0,
      details: [
        "React CI / unit-tests-node-20: PASSED (14,291 passed, 0 failed)",
        "React CI / lint: PASSED (0 errors, 0 warnings)",
        "React CI / bundle-size: PASSED (+0.04 KB within threshold)",
      ],
    },
    missingRequirements: [],
    potentialRisks: [
      "Ensure consumer documentation clarifies that nonce values must be generated uniquely per HTTP request to maintain CSP security guarantees.",
    ],
    suggestedChanges: [
      "Add a cross-reference link in docs/server-rendering.md pointing to CSP best practices.",
    ],
    facts: [
      "PR #38091 modifies 3 files across packages/react-dom",
      "3 files changed: +142 lines, -18 lines",
      "Commit 7f9a1c4 passed 18 of 18 GitHub Actions check-runs",
      "Test file packages/react-dom/src/__tests__/ReactDOMServerFizz-test.js includes 4 new test assertions",
      "Branch comparison: facebook:main ← elenarostova:fizz-script-nonce",
    ],
    interpretations: [
      "The nonce option interface matches established React Server Component conventions.",
      "No security regressions observed in CSP header handling.",
      "The change is non-breaking and backwards-compatible with existing renderToPipeableStream consumers.",
    ],
    pr: {
      url: "https://github.com/facebook/react/pull/38091",
      pullNumber: 38091,
      title: "[Fizz] Pass script nonce to bootstrap script preload tags",
      author: "elenarostova",
      state: "open",
      headSha: "7f9a1c4e9b20d3f8a1e5c2b489d70231aa4920fe",
      headBranch: "elenarostova:fizz-script-nonce",
      baseBranch: "main",
      changedFilesCount: 3,
    },
    provider: "deterministic-engine+gemini",
    verifiedAt: new Date().toISOString(),
  };

  // 3. Ensure Milestones
  await Milestone.deleteMany({ bountyId: bounty._id });

  const m1 = await Milestone.create({
    bountyId: bounty._id,
    order: 1,
    title: "Fizz bootstrap preload nonce propagation",
    description:
      "Accept nonce option in ReactDOMServer stream APIs and ensure preloaded bootstrap script tags render with nonce attribute.",
    rewardAmount: mongoose.Types.Decimal128.fromString("150.00"),
    currency: "USD",
    acceptanceCriteria: [
      "Pass script nonce option down through ReactDOMServer.renderToPipeableStream and renderToReadableStream",
      "Add automated unit tests verifying script nonce renders correctly in preloaded bootstrap script tags",
      "Ensure all CI lint and test suites pass without regression",
    ],
    status: "SUBMITTED",
    prUrl: "https://github.com/facebook/react/pull/38091",
    prNumber: 38091,
    prTitle: "[Fizz] Pass script nonce to bootstrap script preload tags",
    prState: "open",
    isMerged: false,
    headSha: "7f9a1c4e9b20d3f8a1e5c2b489d70231aa4920fe",
    baseBranch: "main",
    headBranch: "elenarostova:fizz-script-nonce",
    submissionDetails:
      "Implemented nonce forwarding through ReactDOMFizzServerNode and ReactDOMFizzServerBrowser. Added unit tests with 100% assertion pass rate.",
    submissionHistory: [
      {
        submittedAt: new Date(Date.now() - 3600000),
        prUrl: "https://github.com/facebook/react/pull/38091",
        prNumber: 38091,
        notes: "Initial submission: nonce plumbing implemented.",
        verificationSummary: "Met 2 of 3 criteria.",
        overallAssessment: "PARTIAL",
      },
      {
        submittedAt: new Date(),
        prUrl: "https://github.com/facebook/react/pull/38091",
        prNumber: 38091,
        notes:
          "Resubmission: Added complete unit test suites and verified CI checks.",
        verificationSummary: sampleVerification.summary,
        overallAssessment: "PASS",
      },
    ],
    latestVerification: sampleVerification,
  });

  const m2 = await Milestone.create({
    bountyId: bounty._id,
    order: 2,
    title: "Documentation & CSP Integration Example",
    description:
      "Document nonce option usage in SSR documentation with an example Express/Next.js CSP integration.",
    rewardAmount: mongoose.Types.Decimal128.fromString("100.00"),
    currency: "USD",
    acceptanceCriteria: [
      "Add usage example to ReactDOMServer documentation demonstrating CSP nonce generation",
      "Include sample Express middleware showing nonce injection into HTML stream",
    ],
    status: "IN_PROGRESS",
  });

  console.log(`Seeded Bounty ID: ${bounty._id}`);
  console.log(
    `Milestone 1 ID: ${m1._id} (SUBMITTED with PR & AI verification)`,
  );
  console.log(
    `Milestone 2 ID: ${m2._id} (IN_PROGRESS for Contributor Submit PR modal)`,
  );

  const contributorToken = TokenService.generateAccessToken({
    id: contributor._id.toString(),
    username: contributor.username,
    email: contributor.email,
    role: contributor.role,
  });

  // Launch Puppeteer
  console.log("Launching Chrome browser...");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  const viewports = [
    { name: "desktop", width: 1440, height: 900, isMobile: false },
    { name: "mobile", width: 390, height: 844, isMobile: true },
  ];

  for (const vp of viewports) {
    console.log(
      `\n--- Capturing ${vp.name.toUpperCase()} Viewport (${vp.width}x${vp.height}) ---`,
    );

    const page = await browser.newPage();
    await page.setViewport({
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 2,
      isMobile: vp.isMobile,
    });

    // Step A: Set HttpOnly access_token cookie directly to establish authenticated contributor session
    await page.setCookie({
      name: "access_token",
      value: contributorToken,
      domain: "localhost",
      path: "/",
      httpOnly: true,
    });

    await page.goto("http://localhost:5173", { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 800));

    // Step B: In marketplace, select the seeded bounty
    await page.waitForSelector(".bounty-card");
    await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll(".bounty-card"));
      for (const card of cards) {
        if (
          card.textContent?.includes("Add script nonce support") ||
          card.textContent?.includes("[Fizz]")
        ) {
          (card as HTMLElement).click();
          return;
        }
      }
      if (cards[0]) (cards[0] as HTMLElement).click();
    });
    await new Promise((r) => setTimeout(r, 1200));

    // Switch to "Milestones" tab
    await page.waitForSelector(".tab-btn");
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll(".tab-btn"));
      const mTab = tabs.find((t) => t.textContent?.includes("Milestones"));
      if (mTab) (mTab as HTMLElement).click();
    });
    await new Promise((r) => setTimeout(r, 1200));

    // CAPTURE 1: Milestone Details Page showing PR details banner (14-milestone-pr-applied)
    const filename14 = `14-milestone-pr-applied-${vp.name}.png`;
    const filepath14 = path.join(ARTIFACTS_DIR, filename14);
    await page.screenshot({ path: filepath14, fullPage: false });
    console.log(
      `✓ Saved: ${filename14} (${fs.statSync(filepath14).size} bytes)`,
    );

    // CAPTURE 2: Contributor Submit PR Modal (12-contributor-submit-pr-modal)
    // Click "Submit PR deliverable" on Milestone #2
    await page.evaluate(() => {
      const buttons = Array.from(
        document.querySelectorAll(".milestone-view-row button"),
      );
      const submitBtn = buttons.find((b) =>
        b.textContent?.includes("Submit PR deliverable"),
      );
      if (submitBtn) (submitBtn as HTMLElement).click();
    });
    await new Promise((r) => setTimeout(r, 1000));

    // Type the PR URL into the input to show real-time repository matching
    const prInput = await page.$("#pr-url-input");
    if (prInput) {
      await prInput.type("https://github.com/facebook/react/pull/38095", {
        delay: 10,
      });
    }
    await new Promise((r) => setTimeout(r, 600));

    const filename12 = `12-contributor-submit-pr-modal-${vp.name}.png`;
    const filepath12 = path.join(ARTIFACTS_DIR, filename12);
    await page.screenshot({ path: filepath12, fullPage: false });
    console.log(
      `✓ Saved: ${filename12} (${fs.statSync(filepath12).size} bytes)`,
    );

    // Close the submit modal
    await page.evaluate(() => {
      const closeBtn = document.querySelector(
        'button[aria-label="Close modal"]',
      );
      if (closeBtn) (closeBtn as HTMLElement).click();
    });
    await new Promise((r) => setTimeout(r, 800));

    // CAPTURE 3: AI Acceptance Criteria Verification Modal (13-pr-verification-modal)
    // Click "View AI report" on Milestone #1
    await page.evaluate(() => {
      const buttons = Array.from(
        document.querySelectorAll(".milestone-view-row button"),
      );
      const reportBtn = buttons.find((b) =>
        b.textContent?.includes("View AI report"),
      );
      if (reportBtn) (reportBtn as HTMLElement).click();
    });
    await new Promise((r) => setTimeout(r, 1200));

    const filename13 = `13-pr-verification-modal-${vp.name}.png`;
    const filepath13 = path.join(ARTIFACTS_DIR, filename13);
    await page.screenshot({ path: filepath13, fullPage: false });
    console.log(
      `✓ Saved: ${filename13} (${fs.statSync(filepath13).size} bytes)`,
    );

    await page.close();
  }

  await browser.close();
  await mongoose.disconnect();
  console.log("\nAll Task 2C screenshots captured successfully!");
}

main().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
