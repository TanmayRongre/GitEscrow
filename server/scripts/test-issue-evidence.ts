/**
 * GitEscrow - Task 4C.2 Regression Test Suite:
 * Strict Issue-Quality Validation & Evidence-Grounded Analysis
 *
 * Verifies:
 *   1. Empty issue description (YasirBinMudassir / "No description provided." / "Hola") -> INSUFFICIENT_EVIDENCE, 0 milestones.
 *   2. Username-only title -> INSUFFICIENT_EVIDENCE, 0 milestones.
 *   3. Greeting-only issue -> INSUFFICIENT_EVIDENCE, 0 milestones.
 *   4. Generic one-line issue ("Fix bug" / "It doesn't work") -> NEEDS_MORE_INFORMATION, 0 milestones.
 *   5. Detailed valid technical issue -> READY_FOR_REVIEW, >= 2 milestones, grounded evidence.
 *   6. Issue with useful technical comments -> READY_FOR_REVIEW, comments utilized as evidence.
 *   7. Issue with irrelevant comments (+1, bump, any update) -> INSUFFICIENT_EVIDENCE, 0 milestones.
 *   8. Groq malformed response -> falls back to deterministic analyzer, provider !== "groq".
 *   9. Groq HTTP 429 rate-limit response -> falls back to deterministic analyzer, provider !== "groq".
 *  10. Deterministic fallback with insufficient evidence -> INSUFFICIENT_EVIDENCE, 0 milestones, no invented scaffolding.
 *  11. Sponsor safeguard: confirms invalid issues can NEVER produce publishable milestones.
 *  12. Live Groq Smoke Test (if GROQ_API_KEY is configured).
 */

import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { IssueValidator } from "../src/ai/issue-validator";
import { SemanticFallbackAnalyzer } from "../src/ai/semantic-analyzer";
import { AIAnalysisClient } from "../src/ai/client";
import { GroqProvider, GroqError } from "../src/ai/groq.provider";
import { IssueAnalysisResultSchema } from "../src/ai/types";
import {
  GitHubIssue,
  GitHubIssueComment,
  GitHubRepo,
} from "../src/github/types";

interface TestRecord {
  scenario: number;
  name: string;
  passed: boolean;
  notes: string;
}

const records: TestRecord[] = [];

function record(
  scenario: number,
  name: string,
  passed: boolean,
  notes: string,
) {
  records.push({ scenario, name, passed, notes });
  const icon = passed ? "✓ PASS" : "✗ FAIL";
  console.log(`  ${icon} [Scenario ${scenario}] ${name} - ${notes}`);
}

const MOCK_REPO: GitHubRepo = {
  id: 1,
  name: "facebook.github.io",
  full_name: "facebook/facebook.github.io",
  private: false,
  owner: { id: 1, login: "facebook" },
  html_url: "https://github.com/facebook/facebook.github.io",
  description: "Docusaurus documentation site generator",
  fork: false,
  default_branch: "main",
  open_issues_count: 5,
  stargazers_count: 50000,
  forks_count: 8000,
};

async function runRegressionSuite() {
  console.log("\n=======================================================");
  console.log("  GitEscrow Task 4C.2: Issue Evidence Regression Suite");
  console.log("=======================================================\n");

  const client = new AIAnalysisClient({
    // Disable real calls initially to test deterministic logic and mocks
    groqApiKey: "",
  });

  // -------------------------------------------------------------------------
  // Scenario 1: Empty Issue Description (YasirBinMudassir)
  // -------------------------------------------------------------------------
  const issue1: GitHubIssue = {
    id: 3,
    number: 3,
    title: "YasirBinMudassir",
    body: "No description provided.",
    state: "open",
    user: { id: 99, login: "YasirBinMudassir" },
    labels: [],
    comments: 1,
    html_url: "https://github.com/facebook/facebook.github.io/issues/3",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    closed_at: null,
  };
  const comments1: GitHubIssueComment[] = [
    {
      id: 101,
      user: { id: 99, login: "YasirBinMudassir" },
      body: "Hola",
      created_at: "2026-01-01T00:01:00Z",
    },
  ];

  const res1 = await client.analyzeIssue(
    issue1,
    MOCK_REPO,
    150,
    "facebook",
    "facebook.github.io",
    comments1,
  );
  const parsed1 = IssueAnalysisResultSchema.safeParse(res1);
  const s1Passed =
    parsed1.success &&
    res1.status === "INSUFFICIENT_EVIDENCE" &&
    res1.suggestedMilestones.length === 0 &&
    res1.technicalRequirements.length === 0 &&
    res1.confidence === "LOW" &&
    res1.missingInformation.length > 0 &&
    res1.sponsorQuestions.length > 0 &&
    res1.improvementSuggestions.length > 0 &&
    res1.insufficientReason !== undefined &&
    res1.insufficientReason.includes("YasirBinMudassir");

  record(
    1,
    "Empty issue description (YasirBinMudassir / No description / Hola)",
    s1Passed,
    `Status=${res1.status}, milestones=${res1.suggestedMilestones.length}, confidence=${res1.confidence}`,
  );

  // -------------------------------------------------------------------------
  // Scenario 2: Username-only Title
  // -------------------------------------------------------------------------
  const issue2: GitHubIssue = {
    id: 4,
    number: 4,
    title: "tanmayrongre",
    body: null,
    state: "open",
    user: { id: 102, login: "tanmayrongre" },
    labels: [],
    comments: 0,
    html_url: "https://github.com/facebook/facebook.github.io/issues/4",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    closed_at: null,
  };
  const res2 = await client.analyzeIssue(
    issue2,
    MOCK_REPO,
    100,
    "facebook",
    "facebook.github.io",
  );
  const s2Passed =
    res2.status === "INSUFFICIENT_EVIDENCE" &&
    res2.suggestedMilestones.length === 0 &&
    res2.confidence === "LOW";

  record(
    2,
    "Username-only title",
    s2Passed,
    `Status=${res2.status}, milestones=${res2.suggestedMilestones.length}`,
  );

  // -------------------------------------------------------------------------
  // Scenario 3: Greeting-only Issue
  // -------------------------------------------------------------------------
  const issue3: GitHubIssue = {
    id: 5,
    number: 5,
    title: "Hi",
    body: "Hello team, good morning! Can someone help?",
    state: "open",
    user: { id: 103, login: "randomuser" },
    labels: [],
    comments: 0,
    html_url: "https://github.com/facebook/facebook.github.io/issues/5",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    closed_at: null,
  };
  const res3 = await client.analyzeIssue(
    issue3,
    MOCK_REPO,
    100,
    "facebook",
    "facebook.github.io",
  );
  const s3Passed =
    res3.status === "INSUFFICIENT_EVIDENCE" &&
    res3.suggestedMilestones.length === 0 &&
    res3.confidence === "LOW";

  record(
    3,
    "Greeting-only issue",
    s3Passed,
    `Status=${res3.status}, milestones=${res3.suggestedMilestones.length}`,
  );

  // -------------------------------------------------------------------------
  // Scenario 4: Generic One-Line Issue
  // -------------------------------------------------------------------------
  const issue4: GitHubIssue = {
    id: 6,
    number: 6,
    title: "Fix bug",
    body: "It doesn't work.",
    state: "open",
    user: { id: 104, login: "coder" },
    labels: [],
    comments: 0,
    html_url: "https://github.com/facebook/facebook.github.io/issues/6",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    closed_at: null,
  };
  const res4 = await client.analyzeIssue(
    issue4,
    MOCK_REPO,
    100,
    "facebook",
    "facebook.github.io",
  );
  const s4Passed =
    res4.status === "NEEDS_MORE_INFORMATION" &&
    res4.suggestedMilestones.length === 0 &&
    res4.confidence === "LOW";

  record(
    4,
    "Generic one-line issue",
    s4Passed,
    `Status=${res4.status}, milestones=${res4.suggestedMilestones.length}`,
  );

  // -------------------------------------------------------------------------
  // Scenario 5: Detailed Valid Technical Issue
  // -------------------------------------------------------------------------
  const issue5: GitHubIssue = {
    id: 38090,
    number: 38090,
    title: "[Fizz] Use the script nonce for bootstrap script preloads",
    body: `Fizz resolves script preloads with the bootstrap script nonce if available.
When rendering script tags during SSR with streaming (Fizz), preloaded bootstrap scripts should include the security nonce attribute.

- [ ] Add script nonce to bootstrap script preloads in ReactDOMServerFizz
- [ ] Author unit tests in ReactDOMServerFizz-test.js
- [ ] Verify CSP compliance on streaming HTML output`,
    state: "open",
    user: { id: 105, login: "hsusul" },
    labels: [{ id: 1, name: "Component: Fizz", color: "b60205" }],
    comments: 0,
    html_url: "https://github.com/facebook/react/issues/38090",
    created_at: "2026-01-15T00:00:00Z",
    updated_at: "2026-01-15T00:00:00Z",
    closed_at: null,
  };
  const res5 = await client.analyzeIssue(
    issue5,
    MOCK_REPO,
    250,
    "facebook",
    "react",
  );
  const s5Passed =
    res5.status === "READY_FOR_REVIEW" &&
    res5.suggestedMilestones.length >= 2 &&
    res5.technicalRequirements.length > 0 &&
    res5.groundedRequirements.length > 0 &&
    res5.provider === "deterministic";

  record(
    5,
    "Detailed valid technical issue",
    s5Passed,
    `Status=${res5.status}, milestones=${res5.suggestedMilestones.length}, groundedReqs=${res5.groundedRequirements.length}`,
  );

  // -------------------------------------------------------------------------
  // Scenario 6: Issue with Useful Technical Comments
  // -------------------------------------------------------------------------
  const issue6: GitHubIssue = {
    id: 7,
    number: 7,
    title: "Runtime exception in tokenizer",
    body: "Tokenizer crashes on unicode escape sequences.",
    state: "open",
    user: { id: 106, login: "dev" },
    labels: [],
    comments: 1,
    html_url: "https://github.com/facebook/react/issues/7",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    closed_at: null,
  };
  const comments6: GitHubIssueComment[] = [
    {
      id: 201,
      user: { id: 107, login: "maintainer" },
      body: `Here is the reproduction stack trace:
\`\`\`ts
Error: RangeError: Invalid code point 1114112 in parseUnicodeEscape
  at Tokenizer.scanEscape (src/tokenizer.ts:142)
  at Tokenizer.nextToken (src/tokenizer.ts:88)
\`\`\`
Steps to reproduce: run \`npm test -- test/tokenizer.test.ts\`. We need a boundary clamp check on hex values.`,
      created_at: "2026-01-01T01:00:00Z",
    },
  ];

  const res6 = await client.analyzeIssue(
    issue6,
    MOCK_REPO,
    150,
    "facebook",
    "react",
    comments6,
  );
  const s6Passed =
    res6.status === "READY_FOR_REVIEW" &&
    res6.suggestedMilestones.length >= 2 &&
    res6.technicalRequirements.some(
      (r) =>
        r.toLowerCase().includes("comment") ||
        r.toLowerCase().includes("tokenizer"),
    );

  record(
    6,
    "Issue with useful technical comments",
    s6Passed,
    `Status=${res6.status}, milestones=${res6.suggestedMilestones.length}, evidenceCoverage=${res6.evidenceCoverage}%`,
  );

  // -------------------------------------------------------------------------
  // Scenario 7: Issue with Irrelevant Comments
  // -------------------------------------------------------------------------
  const comments7: GitHubIssueComment[] = [
    {
      id: 301,
      user: { id: 1, login: "u1" },
      body: "+1",
      created_at: "2026-01-02T00:00:00Z",
    },
    {
      id: 302,
      user: { id: 2, login: "u2" },
      body: "bump",
      created_at: "2026-01-03T00:00:00Z",
    },
    {
      id: 303,
      user: { id: 3, login: "u3" },
      body: "any update??",
      created_at: "2026-01-04T00:00:00Z",
    },
    {
      id: 304,
      user: { id: 4, login: "u4" },
      body: "same here",
      created_at: "2026-01-05T00:00:00Z",
    },
  ];
  const res7 = await client.analyzeIssue(
    issue1,
    MOCK_REPO,
    100,
    "facebook",
    "facebook.github.io",
    comments7,
  );
  const s7Passed =
    res7.status === "INSUFFICIENT_EVIDENCE" &&
    res7.suggestedMilestones.length === 0 &&
    res7.confidence === "LOW";

  record(
    7,
    "Issue with irrelevant comments (+1, bump, any update)",
    s7Passed,
    `Status=${res7.status}, milestones=${res7.suggestedMilestones.length} (noise filtered cleanly)`,
  );

  // -------------------------------------------------------------------------
  // Scenario 8: Groq Malformed Response Fallback
  // -------------------------------------------------------------------------
  const mockMalformedGroqProvider = {
    isConfigured: () => true,
    getModel: () => "openai/gpt-oss-120b",
    chatCompletion: async () => ({
      content: "{ malformed json that cannot be parsed by JSON.parse [",
      model: "openai/gpt-oss-120b",
    }),
  } as unknown as GroqProvider;

  const malformedClient = new AIAnalysisClient({
    groqProvider: mockMalformedGroqProvider,
  });

  const res8 = await malformedClient.analyzeIssue(
    issue5,
    MOCK_REPO,
    200,
    "facebook",
    "react",
  );
  const s8Passed =
    res8.status === "READY_FOR_REVIEW" &&
    res8.suggestedMilestones.length >= 2 &&
    res8.provider === "deterministic"; // Must NEVER be labeled "groq"

  record(
    8,
    "Groq malformed response fallback",
    s8Passed,
    `Provider=${res8.provider} (not 'groq'), milestones=${res8.suggestedMilestones.length}`,
  );

  // -------------------------------------------------------------------------
  // Scenario 9: Groq Rate-Limit (HTTP 429) Fallback
  // -------------------------------------------------------------------------
  const mock429GroqProvider = {
    isConfigured: () => true,
    getModel: () => "openai/gpt-oss-120b",
    chatCompletion: async () => {
      throw new GroqError(
        "Rate limit exceeded for model openai/gpt-oss-120b. TPM limit reached.",
        {
          statusCode: 429,
          isRateLimit: true,
          retryAfterSec: 30,
        },
      );
    },
  } as unknown as GroqProvider;

  const rateLimitClient = new AIAnalysisClient({
    groqProvider: mock429GroqProvider,
  });

  const res9 = await rateLimitClient.analyzeIssue(
    issue5,
    MOCK_REPO,
    200,
    "facebook",
    "react",
  );
  const s9Passed =
    res9.status === "READY_FOR_REVIEW" &&
    res9.suggestedMilestones.length >= 2 &&
    res9.provider === "deterministic";

  record(
    9,
    "Groq rate-limit (HTTP 429) fallback",
    s9Passed,
    `Provider=${res9.provider} (clean deterministic fallback without crash)`,
  );

  // -------------------------------------------------------------------------
  // Scenario 10: Deterministic Fallback with Insufficient Evidence
  // -------------------------------------------------------------------------
  const res10 = SemanticFallbackAnalyzer.analyze(
    issue1,
    MOCK_REPO,
    150,
    "facebook",
    "facebook.github.io",
    comments1,
  );
  const s10Passed =
    res10.status === "INSUFFICIENT_EVIDENCE" &&
    res10.suggestedMilestones.length === 0 &&
    res10.technicalRequirements.length === 0 &&
    res10.provider === "deterministic" &&
    res10.confidence === "LOW";

  record(
    10,
    "Deterministic fallback with insufficient evidence",
    s10Passed,
    `Status=${res10.status}, milestones=${res10.suggestedMilestones.length}, zero invented scaffolding`,
  );

  // -------------------------------------------------------------------------
  // Scenario 11: Anti-Hallucination & Publication Safeguard
  // -------------------------------------------------------------------------
  // Confirm that under no circumstances does an invalid issue produce milestones
  const invalidIssues = [issue1, issue2, issue3, issue4];
  let allZeroMilestones = true;
  for (const inv of invalidIssues) {
    const r = await client.analyzeIssue(inv, MOCK_REPO, 100);
    if (r.suggestedMilestones.length > 0 || r.status === "READY_FOR_REVIEW") {
      allZeroMilestones = false;
      break;
    }
  }

  record(
    11,
    "Anti-hallucination safeguard across all invalid issues",
    allZeroMilestones,
    "Verified all invalid issues return 0 milestones and status !== READY_FOR_REVIEW",
  );

  // -------------------------------------------------------------------------
  // Scenario 12: Live Groq API Smoke Test (when API key is configured)
  // -------------------------------------------------------------------------
  const liveApiKey = process.env.GROQ_API_KEY;
  if (liveApiKey && liveApiKey.startsWith("gsk_")) {
    console.log(
      "\n  [Live Test] Detected valid GROQ_API_KEY. Executing live Groq analysis...",
    );
    const liveClient = new AIAnalysisClient({
      groqApiKey: liveApiKey,
      groqModel: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
    });

    try {
      const liveRes = await liveClient.analyzeIssue(
        issue5,
        MOCK_REPO,
        300,
        "facebook",
        "react",
      );
      const isLiveGroq = liveRes.provider === "groq";
      const livePassed =
        liveRes.status === "READY_FOR_REVIEW" &&
        liveRes.suggestedMilestones.length >= 2 &&
        isLiveGroq;

      record(
        12,
        `Live Groq API Smoke Test (${liveRes.model || "openai/gpt-oss-120b"})`,
        livePassed,
        `Provider=${liveRes.provider}, model=${liveRes.model}, milestones=${liveRes.suggestedMilestones.length}, tokens=${liveRes.tokenUsage?.totalTokens ?? "n/a"}`,
      );
    } catch (liveErr: any) {
      record(
        12,
        "Live Groq API Smoke Test",
        false,
        `Live request failed: ${liveErr.message}`,
      );
    }
  } else {
    record(
      12,
      "Live Groq API Smoke Test",
      true,
      "Skipped live network call (no GROQ_API_KEY configured in environment)",
    );
  }

  console.log("\n-------------------------------------------------------");
  const passedCount = records.filter((r) => r.passed).length;
  console.log(
    `  Summary: ${passedCount}/${records.length} regression tests PASSED.`,
  );
  console.log("-------------------------------------------------------\n");

  if (passedCount !== records.length) {
    process.exit(1);
  }
}

runRegressionSuite().catch((err) => {
  console.error("Test suite failed with fatal error:", err);
  process.exit(1);
});
