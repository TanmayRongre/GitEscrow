/**
 * GitEscrow - GitHub Integration Verification Script
 * Task 1B: GitHub API Integration & CI Verification
 *
 * Verifies:
 *   1. GitHub authentication (via GITHUB_TOKEN)
 *   2. Repository information retrieval (GITHUB_TEST_OWNER / GITHUB_TEST_REPO)
 *   3. Issue listing
 *   4. Individual issue retrieval (GITHUB_TEST_ISSUE_NUMBER)
 *   5. Pull Request retrieval (GITHUB_TEST_PR_NUMBER)
 *   6. Changed-files retrieval
 *   7. PR diff retrieval
 *   8. CI / check-run status retrieval
 *
 * Reports: PASS / FAIL / NOT CONFIGURED
 *
 * Usage:
 *   npx tsx scripts/verify-github.ts
 *   npx tsx scripts/verify-github.ts --owner facebook --repo react --issue 1 --pr 2
 */

import path from "path";
import dotenv from "dotenv";
import { GitHubClient, GitHubApiError } from "../src/github/client";
import { GitHubPullRequest } from "../src/github/types";

// Load environment variables from server/.env and root .env
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const args = process.argv.slice(2);

function getArgValue(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith("--")) {
    return args[idx + 1];
  }
  return undefined;
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN?.trim();
const GITHUB_API_BASE_URL =
  process.env.GITHUB_API_BASE_URL || "https://api.github.com";

const owner =
  getArgValue("--owner") || process.env.GITHUB_TEST_OWNER?.trim() || "facebook";
const repo =
  getArgValue("--repo") || process.env.GITHUB_TEST_REPO?.trim() || "react";
const issueNumberStr =
  getArgValue("--issue") ||
  process.env.GITHUB_TEST_ISSUE_NUMBER?.trim() ||
  "38090";
const prNumberStr =
  getArgValue("--pr") || process.env.GITHUB_TEST_PR_NUMBER?.trim() || "38090";

const issueNumber = issueNumberStr ? parseInt(issueNumberStr, 10) : undefined;
const prNumber = prNumberStr ? parseInt(prNumberStr, 10) : undefined;

type TestStatus = "PASS" | "FAIL" | "NOT CONFIGURED";

interface ReportRow {
  test: string;
  status: TestStatus;
  actualResult: string;
}

const reportMap: Record<string, ReportRow> = {
  auth: {
    test: "GitHub authentication",
    status: "NOT CONFIGURED",
    actualResult: "GITHUB_TOKEN not provided",
  },
  rateLimit: {
    test: "Core API rate limit (/rate_limit)",
    status: "NOT CONFIGURED",
    actualResult: "Not checked",
  },
  repo: {
    test: "Repository retrieval",
    status: "NOT CONFIGURED",
    actualResult: "GITHUB_TEST_OWNER or GITHUB_TEST_REPO not set",
  },
  issueList: {
    test: "Issue listing",
    status: "NOT CONFIGURED",
    actualResult: "Repository not configured",
  },
  issueItem: {
    test: "Issue retrieval",
    status: "NOT CONFIGURED",
    actualResult: "GITHUB_TEST_ISSUE_NUMBER not set",
  },
  prItem: {
    test: "PR retrieval",
    status: "NOT CONFIGURED",
    actualResult: "GITHUB_TEST_PR_NUMBER not set",
  },
  changedFiles: {
    test: "Changed-files retrieval",
    status: "NOT CONFIGURED",
    actualResult: "PR not configured",
  },
  prDiff: {
    test: "PR diff retrieval",
    status: "NOT CONFIGURED",
    actualResult: "PR not configured",
  },
  ciStatus: {
    test: "CI/check status",
    status: "NOT CONFIGURED",
    actualResult: "PR not configured",
  },
};

function truncate(str: string, maxLen = 70): string {
  if (!str) return "";
  return str.length > maxLen ? `${str.substring(0, maxLen - 3)}...` : str;
}

function printReport() {
  console.log(
    `\n========================================================================================================`,
  );
  console.log(
    `                             GITESCROW TASK 1B: GITHUB VERIFICATION REPORT                              `,
  );
  console.log(
    `========================================================================================================`,
  );
  console.log(`Test| Status| Actual Result`);
  console.log(`---|---|---`);
  const keys = [
    "auth",
    "rateLimit",
    "repo",
    "issueList",
    "issueItem",
    "prItem",
    "changedFiles",
    "prDiff",
    "ciStatus",
  ];
  for (const k of keys) {
    const row = reportMap[k];
    console.log(`${row.test}| ${row.status}| ${row.actualResult}`);
  }
  console.log(
    `========================================================================================================\n`,
  );
}

async function run() {
  console.log(
    `\n======================================================================`,
  );
  console.log(`  GitEscrow - GitHub Integration Verification Suite`);
  console.log(`  Base URL: ${GITHUB_API_BASE_URL}`);
  console.log(
    `  Token Configured: ${GITHUB_TOKEN ? `YES (${GITHUB_TOKEN.substring(0, 6)}***)` : "NO"}`,
  );
  console.log(
    `  Target Repo: ${owner && repo ? `${owner}/${repo}` : "NOT CONFIGURED"}`,
  );
  console.log(
    `  Target Issue: ${issueNumber !== undefined ? `#${issueNumber}` : "NOT CONFIGURED"}`,
  );
  console.log(
    `  Target PR: ${prNumber !== undefined ? `#${prNumber}` : "NOT CONFIGURED"}`,
  );
  console.log(
    `======================================================================\n`,
  );

  const client = new GitHubClient({
    token: GITHUB_TOKEN,
    baseUrl: GITHUB_API_BASE_URL,
  });

  // 1. GitHub Authentication
  console.log(`[1/8] Verifying GitHub Authentication (/user)...`);
  if (!GITHUB_TOKEN) {
    reportMap.auth = {
      test: "GitHub authentication",
      status: "NOT CONFIGURED",
      actualResult: "GITHUB_TOKEN is missing in server/.env",
    };
    console.log(
      `  ℹ GITHUB_TOKEN not configured. Skipping authenticated user check.\n`,
    );
  } else {
    try {
      const user = await client.getAuthenticatedUser();
      reportMap.auth = {
        test: "GitHub authentication",
        status: "PASS",
        actualResult: `Authenticated as @${user.login} (${user.type || "User"})`,
      };
      console.log(
        `  ✓ Authenticated as @${user.login} (${user.type || "User"})\n`,
      );
    } catch (err: any) {
      const status = err instanceof GitHubApiError ? err.status : 500;
      reportMap.auth = {
        test: "GitHub authentication",
        status: "FAIL",
        actualResult: `HTTP ${status}: ${err.message}`,
      };
      console.error(`  ✗ Authentication failed: ${err.message}\n`);
    }
  }

  // 1b. Rate Limit Verification (/rate_limit)
  console.log(`[Rate Limit] Querying Core API Rate Limit (/rate_limit)...`);
  try {
    const rl = await client.getRateLimit();
    const core = rl.resources?.core || rl.rate;
    const isAuth = core.limit >= 1000;
    reportMap.rateLimit = {
      test: "Core API rate limit (/rate_limit)",
      status: isAuth ? "PASS" : "FAIL",
      actualResult: `${core.remaining} / ${core.limit} remaining (Authenticated: ${isAuth ? "YES" : "NO"})`,
    };
    console.log(
      `  ✓ Rate limit: ${core.remaining} of ${core.limit} remaining (Authenticated: ${isAuth ? "YES" : "NO"})\n`,
    );
  } catch (err: any) {
    reportMap.rateLimit = {
      test: "Core API rate limit (/rate_limit)",
      status: "FAIL",
      actualResult: `Error: ${err.message}`,
    };
    console.error(`  ✗ Failed to query rate limit: ${err.message}\n`);
  }

  // 2. Repository Information Retrieval
  console.log(`[2/8] Fetching Repository Metadata...`);
  let repoAccessible = false;
  if (!owner || !repo) {
    reportMap.repo = {
      test: "Repository retrieval",
      status: "NOT CONFIGURED",
      actualResult:
        "GITHUB_TEST_OWNER or GITHUB_TEST_REPO not specified in .env",
    };
    console.log(
      `  ℹ Target repository not configured in .env. Skipping repository checks.\n`,
    );
  } else {
    try {
      const repoData = await client.getRepository(owner, repo);
      repoAccessible = true;
      reportMap.repo = {
        test: "Repository retrieval",
        status: "PASS",
        actualResult: `${repoData.full_name} (Stars: ${repoData.stargazers_count}, Default: ${repoData.default_branch})`,
      };
      console.log(
        `  ✓ Repository found: ${repoData.full_name} [Private: ${repoData.private}]\n`,
      );
    } catch (err: any) {
      const status = err instanceof GitHubApiError ? err.status : 500;
      reportMap.repo = {
        test: "Repository retrieval",
        status: "FAIL",
        actualResult: `HTTP ${status}: ${err.message}`,
      };
      console.error(`  ✗ Repository retrieval failed: ${err.message}\n`);
    }
  }

  // 3. Issue Listing
  console.log(`[3/8] Fetching Issue Listing...`);
  if (!repoAccessible || !owner || !repo) {
    reportMap.issueList = {
      test: "Issue listing",
      status: "NOT CONFIGURED",
      actualResult: "Requires valid target repository",
    };
    console.log(`  ℹ Skipping issue listing (repository not accessible).\n`);
  } else {
    try {
      const issues = await client.getIssues(owner, repo, {
        per_page: 5,
        state: "all",
      });
      reportMap.issueList = {
        test: "Issue listing",
        status: "PASS",
        actualResult: `Retrieved ${issues.length} issue(s) from ${owner}/${repo}`,
      };
      console.log(`  ✓ Successfully fetched ${issues.length} issue(s).\n`);
    } catch (err: any) {
      const status = err instanceof GitHubApiError ? err.status : 500;
      reportMap.issueList = {
        test: "Issue listing",
        status: "FAIL",
        actualResult: `HTTP ${status}: ${err.message}`,
      };
      console.error(`  ✗ Issue listing failed: ${err.message}\n`);
    }
  }

  // 4. Individual Issue Retrieval
  console.log(`[4/8] Fetching Individual Issue...`);
  if (!repoAccessible || !owner || !repo || !issueNumber) {
    reportMap.issueItem = {
      test: "Issue retrieval",
      status: "NOT CONFIGURED",
      actualResult: "GITHUB_TEST_ISSUE_NUMBER not specified in .env",
    };
    console.log(
      `  ℹ GITHUB_TEST_ISSUE_NUMBER not specified. Skipping individual issue retrieval.\n`,
    );
  } else {
    try {
      const issue = await client.getIssue(owner, repo, issueNumber);
      reportMap.issueItem = {
        test: "Issue retrieval",
        status: "PASS",
        actualResult: `Issue #${issue.number}: "${truncate(issue.title, 35)}" [State: ${issue.state}]`,
      };
      console.log(
        `  ✓ Found Issue #${issue.number}: "${issue.title}" [Author: @${issue.user?.login || "unknown"}]\n`,
      );
    } catch (err: any) {
      const status = err instanceof GitHubApiError ? err.status : 500;
      reportMap.issueItem = {
        test: "Issue retrieval",
        status: "FAIL",
        actualResult: `HTTP ${status}: ${err.message}`,
      };
      console.error(`  ✗ Individual issue retrieval failed: ${err.message}\n`);
    }
  }

  // 5. Pull Request Retrieval
  console.log(`[5/8] Fetching Pull Request...`);
  let prData: GitHubPullRequest | null = null;
  if (!repoAccessible || !owner || !repo || !prNumber) {
    reportMap.prItem = {
      test: "PR retrieval",
      status: "NOT CONFIGURED",
      actualResult: "GITHUB_TEST_PR_NUMBER not specified in .env",
    };
    reportMap.changedFiles = {
      test: "Changed-files retrieval",
      status: "NOT CONFIGURED",
      actualResult: "Requires GITHUB_TEST_PR_NUMBER",
    };
    reportMap.prDiff = {
      test: "PR diff retrieval",
      status: "NOT CONFIGURED",
      actualResult: "Requires GITHUB_TEST_PR_NUMBER",
    };
    reportMap.ciStatus = {
      test: "CI/check status",
      status: "NOT CONFIGURED",
      actualResult: "Requires GITHUB_TEST_PR_NUMBER",
    };
    console.log(
      `  ℹ GITHUB_TEST_PR_NUMBER not specified. Skipping PR-dependent checks.\n`,
    );
  } else {
    try {
      prData = await client.getPullRequest(owner, repo, prNumber);
      reportMap.prItem = {
        test: "PR retrieval",
        status: "PASS",
        actualResult: `PR #${prData.number}: "${truncate(prData.title, 35)}" [Merged: ${prData.merged}]`,
      };
      console.log(
        `  ✓ Found PR #${prData.number}: "${prData.title}" [State: ${prData.state}, Merged: ${prData.merged}]\n`,
      );
    } catch (err: any) {
      const status = err instanceof GitHubApiError ? err.status : 500;
      reportMap.prItem = {
        test: "PR retrieval",
        status: "FAIL",
        actualResult: `HTTP ${status}: ${err.message}`,
      };
      console.error(`  ✗ Pull Request retrieval failed: ${err.message}\n`);
    }

    // 6. Changed-Files Retrieval
    console.log(`[6/8] Fetching Changed Files for PR #${prNumber}...`);
    try {
      const files = await client.getPullRequestFiles(owner, repo, prNumber);
      reportMap.changedFiles = {
        test: "Changed-files retrieval",
        status: "PASS",
        actualResult: `Retrieved ${files.length} changed file(s)`,
      };
      console.log(`  ✓ Retrieved ${files.length} changed file(s).\n`);
    } catch (err: any) {
      const status = err instanceof GitHubApiError ? err.status : 500;
      reportMap.changedFiles = {
        test: "Changed-files retrieval",
        status: "FAIL",
        actualResult: `HTTP ${status}: ${err.message}`,
      };
      console.error(`  ✗ Changed-files retrieval failed: ${err.message}\n`);
    }

    // 7. PR Diff Retrieval
    console.log(`[7/8] Fetching Unified Diff for PR #${prNumber}...`);
    try {
      const diff = await client.getPullRequestDiff(owner, repo, prNumber);
      reportMap.prDiff = {
        test: "PR diff retrieval",
        status: "PASS",
        actualResult: `Diff fetched successfully (${diff.length} bytes)`,
      };
      console.log(`  ✓ Unified diff fetched: ${diff.length} bytes.\n`);
    } catch (err: any) {
      const status = err instanceof GitHubApiError ? err.status : 500;
      reportMap.prDiff = {
        test: "PR diff retrieval",
        status: "FAIL",
        actualResult: `HTTP ${status}: ${err.message}`,
      };
      console.error(`  ✗ PR diff retrieval failed: ${err.message}\n`);
    }

    // 8. CI / Check-Run Status Retrieval
    console.log(`[8/8] Fetching CI / Check Runs for PR #${prNumber}...`);
    if (!prData?.head?.sha) {
      reportMap.ciStatus = {
        test: "CI/check status",
        status: "FAIL",
        actualResult: "PR head commit SHA unavailable",
      };
    } else {
      const commitSha = prData.head.sha;
      try {
        const checkRunsRes = await client.getCommitCheckRuns(
          owner,
          repo,
          commitSha,
        );
        const combinedStatus = await client.getCombinedStatus(
          owner,
          repo,
          commitSha,
        );

        reportMap.ciStatus = {
          test: "CI/check status",
          status: "PASS",
          actualResult: `Check runs: ${checkRunsRes.total_count}, Combined status: ${combinedStatus.state} (${commitSha.substring(0, 7)})`,
        };
        console.log(
          `  ✓ CI Status fetched for commit ${commitSha.substring(0, 7)}:`,
        );
        console.log(`    Total check runs: ${checkRunsRes.total_count}`);
        console.log(`    Combined status: ${combinedStatus.state}\n`);
      } catch (err: any) {
        const status = err instanceof GitHubApiError ? err.status : 500;
        reportMap.ciStatus = {
          test: "CI/check status",
          status: "FAIL",
          actualResult: `HTTP ${status}: ${err.message}`,
        };
        console.error(`  ✗ CI status retrieval failed: ${err.message}\n`);
      }
    }
  }

  printReport();
}

run().catch((err) => {
  console.error("[FATAL] verify-github crashed:", err);
  process.exit(1);
});
