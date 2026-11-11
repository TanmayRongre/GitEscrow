import { GitHubIssue, GitHubIssueComment, GitHubRepo } from "../github/types";
import {
  IssueAnalysisResult,
  SuggestedMilestone,
  IssueComplexity,
  AnalysisConfidence,
  GroundedEvidence,
} from "./types";
import { IssueValidator } from "./issue-validator";

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
  if (sumWeights === 0) return weights.map(() => 0);
  const normalizedWeights = weights.map((w) => w / sumWeights);

  const centShares: number[] = [];
  let allocated = 0;

  for (let i = 0; i < normalizedWeights.length; i++) {
    if (i === normalizedWeights.length - 1) {
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
function assessComplexity(
  issue: GitHubIssue,
  evidenceCoverage: number,
): {
  complexity: IssueComplexity;
  confidence: AnalysisConfidence;
} {
  const text = `${issue.title} ${issue.body || ""}`.toLowerCase();
  const labelNames = (issue.labels || []).map((l) =>
    (typeof l === "string" ? l : l.name).toLowerCase(),
  );

  let score = 1;

  if (
    labelNames.some((l) =>
      /complex|architecture|epic|refactor|migration|performance|security/i.test(
        l,
      ),
    )
  ) {
    score += 3;
  }
  if (labelNames.some((l) => /good first issue|easy|trivial|minor/i.test(l))) {
    score -= 1;
  }

  if (text.includes("```") || text.includes("stack trace") || text.includes("error:")) {
    score += 1;
  }
  if ((issue.body || "").length > 800) {
    score += 1;
  }

  let complexity: IssueComplexity = "MEDIUM";
  if (score <= 1) complexity = "LOW";
  else if (score >= 4) complexity = "HIGH";

  let confidence: AnalysisConfidence = "LOW";
  if (evidenceCoverage >= 60) confidence = "HIGH";
  else if (evidenceCoverage >= 35) confidence = "MEDIUM";

  return { complexity, confidence };
}

/**
 * Synthesizes a clean issue summary
 */
function synthesizeSummary(title: string, body: string): string {
  const cleanedTitle = title.replace(/\s+/g, " ").trim();
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const firstParagraph =
    paragraphs.find(
      (p) => p.length > 20 && !p.startsWith("#") && !p.startsWith("```"),
    ) || "";

  if (firstParagraph) {
    const trimmedP = firstParagraph.replace(/[\r\n]+/g, " ").substring(0, 300);
    return `${cleanedTitle}: ${trimmedP}${trimmedP.length === 300 ? "..." : ""}`;
  }

  return cleanedTitle;
}

/**
 * Deterministic Semantic Fallback Analyzer
 * Strictly grounded in real GitHub issue evidence; never invents requirements or milestones
 * when evidence is insufficient.
 */
export class SemanticFallbackAnalyzer {
  public static analyze(
    issue: GitHubIssue,
    repo: GitHubRepo | null,
    totalRewardAmount: number = 100,
    repositoryOwner?: string,
    repositoryName?: string,
    comments?: GitHubIssueComment[],
  ): IssueAnalysisResult {
    const finalOwner = repositoryOwner || repo?.owner?.login || "unknown-owner";
    const finalRepo = repositoryName || repo?.name || "unknown-repo";
    const labelNames = (issue.labels || []).map((l) =>
      typeof l === "string" ? l : l.name,
    );

    // 1. Strict issue-quality validation before generating anything
    const validation = IssueValidator.evaluate(issue, repo, comments);

    // 2. If insufficient information or non-technical, return explicit insufficient status with 0 milestones
    if (!validation.isValid || validation.status !== "READY_FOR_REVIEW") {
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
        summary:
          validation.insufficientReason ||
          `Issue #${issue.number} does not provide sufficient technical context to decompose into verifiable milestones.`,
        complexity: "LOW",
        technicalRequirements: [],
        dependencies: repo?.name ? [`${repo.owner?.login || finalOwner}/${repo.name}`] : [],
        suggestedMilestones: [],
        totalRewardAmount,
        confidence: "LOW",
        provider: "deterministic",
        analyzedAt: new Date().toISOString(),
        status: validation.status,
        insufficientReason: validation.insufficientReason,
        missingInformation: validation.missingInformation,
        sponsorQuestions: validation.sponsorQuestions,
        improvementSuggestions: validation.improvementSuggestions,
        evidenceCoverage: validation.evidenceCoverage,
        groundedRequirements: [],
      };
    }

    // 3. Evidence-grounded generation for valid issues
    const rawBody = issue.body || "";
    const isBug =
      labelNames.some((l) =>
        /bug|fix|defect|regression|panic|crash/i.test(l),
      ) || /fix|bug|broken|error|fails|crash|regression/i.test(issue.title);

    const { complexity, confidence } = assessComplexity(
      issue,
      validation.evidenceCoverage,
    );
    const codeRefs = extractCodeReferences(rawBody);
    const checklistItems = extractChecklistItems(rawBody);

    const groundedRequirements: GroundedEvidence[] = [];
    const technicalRequirements: string[] = [];

    // Map direct checklist items
    if (checklistItems.length > 0) {
      for (const item of checklistItems.slice(0, 4)) {
        technicalRequirements.push(item);
        groundedRequirements.push({
          item,
          source: "issue_body",
          evidenceExcerpt: item,
          evidenceSufficiency: "DIRECT",
        });
      }
    }

    // Map direct code references
    if (codeRefs.length > 0) {
      const codeItem = `Update and verify affected components: ${codeRefs.slice(0, 3).join(", ")}`;
      technicalRequirements.push(codeItem);
      groundedRequirements.push({
        item: codeItem,
        source: "code_reference",
        evidenceExcerpt: codeRefs.slice(0, 3).join(", "),
        evidenceSufficiency: "DIRECT",
      });
    }

    // Map technical comments if available
    const { technical: techComments } = IssueValidator.filterTechnicalComments(comments || []);
    if (techComments.length > 0) {
      const topComment = techComments[0];
      const commentExcerpt = (topComment.body || "").substring(0, 100).replace(/[\r\n]+/g, " ");
      const commentItem = `Implement technical approach from issue comment discussion`;
      technicalRequirements.push(commentItem);
      groundedRequirements.push({
        item: commentItem,
        source: "issue_comment",
        evidenceExcerpt: commentExcerpt,
        evidenceSufficiency: "DIRECT",
      });
    }

    // Map title-grounded core goal
    const titleItem = `Resolve reported ${isBug ? "defect" : "requirement"}: ${issue.title.trim()}`;
    technicalRequirements.push(titleItem);
    groundedRequirements.push({
      item: titleItem,
      source: "issue_title",
      evidenceExcerpt: issue.title,
      evidenceSufficiency: "INFERRED",
    });

    // Dependencies
    const dependencies: string[] = [];
    if (repo?.name) {
      dependencies.push(`${repo.owner?.login || finalOwner}/${repo.name}`);
    }
    codeRefs.slice(0, 3).forEach((ref) => dependencies.push(ref));

    // Milestone Breakdown (grounded in actual evidence)
    let weights: number[];
    let milestoneDrafts: {
      title: string;
      description: string;
      criteria: string[];
      criteriaEvidence: GroundedEvidence[];
    }[];

    if (isBug) {
      weights = [40, 60];
      milestoneDrafts = [
        {
          title: "Milestone 1: Automated Regression Test & Root-Cause Isolation",
          description: `Author an automated regression test reproducing the failure described in #${issue.number} ("${issue.title}").`,
          criteria: [
            `Regression test reproducing issue #${issue.number} added and failing on unpatched code`,
            "Root-cause module isolated without regressions in unrelated suites",
          ],
          criteriaEvidence: [
            {
              item: `Regression test reproducing issue #${issue.number}`,
              source: "issue_title",
              evidenceExcerpt: issue.title,
              evidenceSufficiency: "INFERRED",
            },
            {
              item: "Root-cause module isolated",
              source: codeRefs.length > 0 ? "code_reference" : "issue_body",
              evidenceExcerpt: codeRefs[0] || (issue.body || "").substring(0, 80),
              evidenceSufficiency: codeRefs.length > 0 ? "DIRECT" : "INFERRED",
            },
          ],
        },
        {
          title: "Milestone 2: Fix Implementation & Verification",
          description: `Implement the corrective fix for #${issue.number} so that reproduction tests and existing test suites pass cleanly.`,
          criteria: [
            "Reproduction test from Milestone 1 passes cleanly with new patch",
            "Continuous integration (CI) tests and lint checks pass cleanly",
          ],
          criteriaEvidence: [
            {
              item: "Reproduction test passes cleanly",
              source: "issue_title",
              evidenceExcerpt: issue.title,
              evidenceSufficiency: "INFERRED",
            },
            {
              item: "CI checks pass cleanly",
              source: "repo_context",
              evidenceExcerpt: `${finalOwner}/${finalRepo}`,
              evidenceSufficiency: "INFERRED",
            },
          ],
        },
      ];
    } else {
      weights = [40, 60];
      milestoneDrafts = [
        {
          title: "Milestone 1: Specification & Core Implementation",
          description: `Implement core logic for issue #${issue.number} ("${issue.title}").`,
          criteria: [
            checklistItems[0] || `Core functionality for "${issue.title.substring(0, 60)}" implemented`,
            "Unit tests covering newly added code",
          ],
          criteriaEvidence: [
            {
              item: checklistItems[0] || issue.title,
              source: checklistItems.length > 0 ? "issue_body" : "issue_title",
              evidenceExcerpt: checklistItems[0] || issue.title,
              evidenceSufficiency: checklistItems.length > 0 ? "DIRECT" : "INFERRED",
            },
          ],
        },
        {
          title: "Milestone 2: Integration & Verification",
          description: `Integrate with existing repository components and verify automated test coverage.`,
          criteria: [
            checklistItems[1] || "All existing and new test suites pass with zero regressions",
            "Documentation or type annotations updated as needed",
          ],
          criteriaEvidence: [
            {
              item: checklistItems[1] || "Automated test verification",
              source: checklistItems.length > 1 ? "issue_body" : "repo_context",
              evidenceExcerpt: checklistItems[1] || `${finalOwner}/${finalRepo}`,
              evidenceSufficiency: checklistItems.length > 1 ? "DIRECT" : "INFERRED",
            },
          ],
        },
      ];
    }

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
        criteriaEvidence: draft.criteriaEvidence,
      }),
    );

    const summary = synthesizeSummary(issue.title, rawBody);

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
      provider: "deterministic",
      analyzedAt: new Date().toISOString(),
      status: "READY_FOR_REVIEW",
      evidenceCoverage: validation.evidenceCoverage,
      groundedRequirements,
      missingInformation: [],
      sponsorQuestions: [],
      improvementSuggestions: [],
    };
  }
}
