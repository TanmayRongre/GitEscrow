import { GitHubIssue, GitHubRepo } from "../github/types";
import {
  IssueAnalysisResult,
  SuggestedMilestone,
  IssueComplexity,
  AnalysisConfidence,
} from "./types";

/**
 * Helper to convert dollar float to integer cents
 */
function toCents(val: number): number {
  return Math.round(val * 100);
}

/**
 * Distribute total cents across percentage weights so that the sum of distributed cents
 * is EXACTLY equal to total cents, eliminating floating-point rounding errors.
 */
export function distributeCents(
  totalCents: number,
  weights: number[],
): number[] {
  const sumWeights = weights.reduce((a, b) => a + b, 0);
  const normalizedWeights = weights.map((w) => w / sumWeights);

  const centShares: number[] = [];
  let allocated = 0;

  for (let i = 0; i < normalizedWeights.length; i++) {
    if (i === normalizedWeights.length - 1) {
      // Last milestone receives the exact remaining balance
      centShares.push(totalCents - allocated);
    } else {
      const share = Math.round(totalCents * normalizedWeights[i]);
      centShares.push(share);
      allocated += share;
    }
  }

  return centShares;
}

/**
 * Extracts backticked code tokens, file paths, and package references from markdown
 */
function extractCodeReferences(body: string): string[] {
  const matches = body.match(/`([^`\n]+)`/g) || [];
  const set = new Set<string>();

  for (const m of matches) {
    const clean = m.replace(/`/g, "").trim();
    if (
      clean.length > 2 &&
      clean.length < 50 &&
      !clean.includes(" ") &&
      (clean.includes(".") ||
        clean.includes("/") ||
        clean.includes("-") ||
        clean.includes("("))
    ) {
      set.add(clean);
    }
  }

  return Array.from(set).slice(0, 8);
}

/**
 * Extract checklist items (`- [ ] ...` or `- [x] ...`)
 */
function extractChecklistItems(body: string): string[] {
  const lines = body.split("\n");
  const items: string[] = [];

  for (const line of lines) {
    const match = line.match(/^[-*]\s*\[([ xX])\]\s*(.+)$/);
    if (match && match[2].trim()) {
      items.push(match[2].trim());
    }
  }

  return items;
}

/**
 * Detect issue complexity based on labels, length of body, code blocks, and stack traces
 */
function assessComplexity(issue: GitHubIssue): {
  complexity: IssueComplexity;
  confidence: AnalysisConfidence;
} {
  const text = `${issue.title} ${issue.body || ""}`.toLowerCase();
  const labelNames = (issue.labels || []).map((l) =>
    (typeof l === "string" ? l : l.name).toLowerCase(),
  );

  let score = 1;

  if (
    labelNames.some(
      (l) =>
        l.includes("epic") ||
        l.includes("major") ||
        l.includes("breaking") ||
        l.includes("architecture"),
    )
  ) {
    score += 2;
  }
  if (
    labelNames.some(
      (l) =>
        l.includes("bug") || l.includes("regression") || l.includes("security"),
    )
  ) {
    score += 1;
  }
  if ((issue.body || "").length > 1500) {
    score += 1;
  }
  if (
    text.includes("stack trace") ||
    text.includes("unhandled exception") ||
    text.includes("memory leak") ||
    text.includes("race condition")
  ) {
    score += 1;
  }

  if (score >= 4) {
    return { complexity: "HIGH", confidence: "HIGH" };
  } else if (score >= 2) {
    return { complexity: "MEDIUM", confidence: "HIGH" };
  } else {
    return { complexity: "LOW", confidence: "MEDIUM" };
  }
}

/**
 * Synthesizes a clean problem summary from raw title and body
 */
function synthesizeSummary(title: string, body: string): string {
  const cleanedTitle = title.trim();
  const firstParagraph =
    body
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(
        (p) => p.length > 20 && !p.startsWith("#") && !p.startsWith("```"),
      )[0] || "";

  if (firstParagraph) {
    const trimmedP = firstParagraph.replace(/[\r\n]+/g, " ").substring(0, 300);
    return `${cleanedTitle}: ${trimmedP}${trimmedP.length === 300 ? "..." : ""}`;
  }

  return cleanedTitle;
}

/**
 * Deterministic Semantic Analyzer
 * Deconstructs GitHub issues into structured milestones, requirements, and acceptance criteria.
 */
export class SemanticFallbackAnalyzer {
  public static analyze(
    issue: GitHubIssue,
    repo: GitHubRepo | null,
    totalRewardAmount: number = 100,
    repositoryOwner?: string,
    repositoryName?: string,
  ): IssueAnalysisResult {
    const rawBody = issue.body || "";
    const labelNames = (issue.labels || []).map((l) =>
      typeof l === "string" ? l : l.name,
    );
    const isBug =
      labelNames.some((l) =>
        /bug|fix|defect|regression|panic|crash/i.test(l),
      ) || /fix|bug|broken|error|fails|crash|regression/i.test(issue.title);

    const { complexity, confidence } = assessComplexity(issue);
    const codeRefs = extractCodeReferences(rawBody);
    const checklistItems = extractChecklistItems(rawBody);

    // Identify Technical Requirements
    const technicalRequirements: string[] = [];
    if (checklistItems.length > 0) {
      checklistItems
        .slice(0, 5)
        .forEach((item) => technicalRequirements.push(item));
    }
    if (codeRefs.length > 0) {
      technicalRequirements.push(
        `Inspect and update components: ${codeRefs.slice(0, 4).join(", ")}`,
      );
    }
    if (isBug) {
      technicalRequirements.push(
        "Identify root-cause and replicate with an automated regression test",
      );
      technicalRequirements.push(
        "Implement minimal, non-breaking fix preserving existing API compatibility",
      );
    } else {
      technicalRequirements.push(
        "Design interface conforming to existing repository architecture",
      );
      technicalRequirements.push(
        "Implement core functional logic with comprehensive test coverage",
      );
    }
    technicalRequirements.push(
      "Verify all existing project unit and integration test suites pass",
    );

    // Dependencies
    const dependencies: string[] = [];
    if (repo?.name) {
      dependencies.push(`${repo.owner.login}/${repo.name}`);
    }
    codeRefs.slice(0, 4).forEach((ref) => dependencies.push(ref));
    if (dependencies.length === 0) {
      dependencies.push("Node.js / JavaScript environment");
    }

    // Milestone Breakdown (2 to 3 logical phases)
    let weights: number[];
    let milestoneDrafts: {
      title: string;
      description: string;
      criteria: string[];
    }[];

    if (isBug) {
      // Bugfix lifecycle
      weights = [30, 50, 20];
      milestoneDrafts = [
        {
          title: "Milestone 1: Root-Cause Analysis & Regression Test Harness",
          description: `Investigate the failure condition reported in issue #${issue.number}. Author an isolated automated reproduction test that validates the defect in current code.`,
          criteria: [
            `Automated test harness replicating issue #${issue.number} created and failing on unpatched code`,
            "Identified affected modules and documented root cause",
            "Codebase linting and formatting rules satisfied",
          ],
        },
        {
          title: "Milestone 2: Core Defect Resolution & Error Handling",
          description: `Implement the corrective patch to resolve issue #${issue.number} without regressions or breaking public contracts.`,
          criteria: [
            "Reproduction test from Milestone 1 now passes cleanly",
            "Graceful edge-case handling for null, undefined, or malformed inputs",
            "Zero regressions across existing unit test suite",
          ],
        },
        {
          title: "Milestone 3: Verification, Documentation & CI Validation",
          description: `Validate end-to-end integration, update relevant technical documentation or type annotations, and ensure all CI check-runs pass.`,
          criteria: [
            "All continuous integration (CI) check-runs complete with green PASS status",
            "Documentation, README, or JSDoc updated where appropriate",
            "Pull request clean of merge conflicts against main branch",
          ],
        },
      ];
    } else {
      // Feature / Enhancement lifecycle
      weights = [35, 45, 20];
      milestoneDrafts = [
        {
          title: "Milestone 1: Architectural Scaffolding & Test Specifications",
          description: `Define TypeScript types, interface contracts, and author unit test specifications for the requested capability in issue #${issue.number}.`,
          criteria: [
            "Interface definitions and data contracts drafted and approved",
            "Unit test scaffolding covering expected feature behavior",
            "Codebase structure conforms to existing module conventions",
          ],
        },
        {
          title: "Milestone 2: Feature Implementation & Core Logic",
          description: `Implement the requested feature fulfilling all acceptance requirements described in issue #${issue.number}.`,
          criteria: [
            "Core functionality fully implemented and operational",
            "All newly authored unit tests pass with >90% coverage on new code",
            "Proper error handling and boundary safety checks incorporated",
          ],
        },
        {
          title: "Milestone 3: Integration Testing, Examples & Documentation",
          description: `Integrate the feature into the broader application workflow, author usage examples, and verify automated CI builds.`,
          criteria: [
            "All GitHub Actions and CI checks pass cleanly",
            "Public API documentation or usage guide updated",
            "Clean git commit history and PR ready for maintainer review",
          ],
        },
      ];
    }

    // Exact cent-balanced allocation
    const totalCents = toCents(totalRewardAmount);
    const centAllocations = distributeCents(totalCents, weights);

    const suggestedMilestones: SuggestedMilestone[] = milestoneDrafts.map(
      (draft, idx) => ({
        order: idx + 1,
        title: draft.title,
        description: draft.description,
        weightPercentage: weights[idx],
        suggestedAmount: centAllocations[idx] / 100,
        currency: "USD",
        acceptanceCriteria: draft.criteria,
      }),
    );

    const summary = synthesizeSummary(issue.title, rawBody);

    const finalOwner = repositoryOwner || repo?.owner.login || "unknown-owner";
    const finalRepo = repositoryName || repo?.name || "unknown-repo";

    return {
      issue: {
        owner: finalOwner,
        repo: finalRepo,
        issueNumber: issue.number,
        title: issue.title,
        url:
          issue.html_url ||
          `https://github.com/${finalOwner}/${finalRepo}/issues/${issue.number}`,
        state: issue.state,
        labels: labelNames,
        author: issue.user?.login,
      },
      summary,
      complexity,
      technicalRequirements: technicalRequirements.slice(0, 6),
      dependencies: dependencies.slice(0, 6),
      suggestedMilestones,
      totalRewardAmount: totalCents / 100,
      confidence,
      provider: "heuristic-semantic",
      analyzedAt: new Date().toISOString(),
    };
  }
}
