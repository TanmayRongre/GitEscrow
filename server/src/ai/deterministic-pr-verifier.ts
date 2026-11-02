import { IPREvidence } from "../github/pr-evidence.service";
import {
  AcceptanceVerificationResult,
  CriterionEvaluation,
  CIStatusSummary,
  OverallAssessment,
  SubmittedPRMetadata,
} from "./pr-verification.types";

interface IMilestoneInput {
  id: string;
  bountyId: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
}

export class DeterministicPRVerifier {
  /**
   * Evaluates PR evidence against milestone acceptance criteria deterministically
   */
  public static verify(
    milestone: IMilestoneInput,
    evidence: IPREvidence
  ): AcceptanceVerificationResult {
    const { pr, files, diff, checkRuns, combinedStatus, isOversizedDiff } = evidence;

    // 1. Compile PR Metadata
    const prMetadata: SubmittedPRMetadata = {
      owner: pr.head?.user?.login || pr.base?.user?.login || "unknown",
      repo: pr.base?.repo?.name || "unknown",
      pullNumber: pr.number,
      url: pr.html_url,
      title: pr.title,
      state: pr.state === "closed" ? "closed" : "open",
      isMerged: Boolean(pr.merged || pr.merged_at),
      headSha: pr.head?.sha || "",
      baseBranch: pr.base?.ref || "main",
      headBranch: pr.head?.ref || "",
      changedFilesCount: files?.length || 0,
      additions: files?.reduce((acc, f) => acc + (f.additions || 0), 0) || 0,
      deletions: files?.reduce((acc, f) => acc + (f.deletions || 0), 0) || 0,
    };

    // 2. Check for empty evidence / insufficient data
    if ((!files || files.length === 0) && (!diff || diff.trim().length === 0)) {
      const emptyEvaluations: CriterionEvaluation[] = milestone.acceptanceCriteria.map(
        (criterion) => ({
          criterion,
          status: "UNVERIFIABLE",
          evidence: "No modified files or diff content was available from GitHub to inspect.",
          confidence: "LOW",
          matchedFiles: [],
        })
      );

      return {
        milestoneId: milestone.id,
        bountyId: milestone.bountyId,
        pr: prMetadata,
        overallAssessment: "INSUFFICIENT_EVIDENCE",
        summary: `PR #${pr.number} contains no inspectable file changes or diff data. Acceptance criteria cannot be verified.`,
        criteriaEvaluations: emptyEvaluations,
        codeReferences: [],
        missingRequirements: [...milestone.acceptanceCriteria],
        potentialRisks: ["Zero changed files detected in pull request."],
        ciStatusSummary: {
          totalChecks: 0,
          passed: 0,
          failed: 0,
          pending: 0,
          state: "NO_CHECKS",
          details: ["No GitHub check-runs reported."],
        },
        suggestedChanges: [
          "Push commits containing implementation code to the pull request branch.",
        ],
        confidence: {
          level: "LOW",
          explanation: "Insufficient diff data available to verify implementation against specifications.",
        },
        facts: [`PR #${pr.number} has 0 changed files reported by GitHub.`],
        interpretations: ["No code changes present to evaluate."],
        provider: "deterministic-pr-verifier",
        verifiedAt: new Date().toISOString(),
      };
    }

    // 3. Analyze CI Check Runs & Commit Status
    let passedChecks = 0;
    let failedChecks = 0;
    let pendingChecks = 0;
    const checkDetails: string[] = [];

    if (checkRuns && checkRuns.length > 0) {
      for (const run of checkRuns) {
        if (run.status === "completed") {
          if (run.conclusion === "success" || run.conclusion === "neutral") {
            passedChecks++;
            checkDetails.push(`[PASS] ${run.name}`);
          } else {
            failedChecks++;
            checkDetails.push(`[FAIL] ${run.name} (${run.conclusion || "failed"})`);
          }
        } else {
          pendingChecks++;
          checkDetails.push(`[PENDING] ${run.name} (${run.status})`);
        }
      }
    }

    if (combinedStatus && combinedStatus.statuses) {
      for (const s of combinedStatus.statuses) {
        if (s.state === "success") {
          passedChecks++;
          checkDetails.push(`[PASS] ${s.context || "Commit Status"}`);
        } else if (s.state === "pending") {
          pendingChecks++;
          checkDetails.push(`[PENDING] ${s.context || "Commit Status"}`);
        } else {
          failedChecks++;
          checkDetails.push(`[FAIL] ${s.context || "Commit Status"}`);
        }
      }
    }

    const totalChecks = passedChecks + failedChecks + pendingChecks;
    const ciState =
      failedChecks > 0
        ? "FAILED"
        : pendingChecks > 0
        ? "PENDING"
        : totalChecks > 0
        ? "PASSED"
        : "NO_CHECKS";

    const ciStatusSummary: CIStatusSummary = {
      totalChecks,
      passed: passedChecks,
      failed: failedChecks,
      pending: pendingChecks,
      state: ciState,
      details: checkDetails,
    };

    // 4. Evaluate Acceptance Criteria against Changed Files & Diffs
    const fileNames = files.map((f) => f.filename);
    const testFiles = fileNames.filter(
      (f) =>
        f.toLowerCase().includes("test") ||
        f.toLowerCase().includes("spec") ||
        f.includes("__tests__")
    );
    const codeDiffLower = diff.toLowerCase();

    const criteriaEvaluations: CriterionEvaluation[] = [];
    const codeReferencesSet = new Set<string>();
    const missingRequirements: string[] = [];
    const suggestedChanges: string[] = [];

    for (const criterion of milestone.acceptanceCriteria) {
      const criterionLower = criterion.toLowerCase();

      // Extract significant keywords (length > 3, exclude stopwords)
      const words = criterionLower
        .replace(/[^a-z0-9_\-\s]/g, " ")
        .split(/\s+/)
        .filter(
          (w) =>
            w.length > 3 &&
            !["must", "should", "with", "that", "this", "each", "have", "from", "when", "then"].includes(w)
        );

      const matchedFiles: string[] = [];
      for (const file of files) {
        const fileContentLower = (file.filename + " " + (file.patch || "")).toLowerCase();
        const matchesWord = words.some((w) => fileContentLower.includes(w));
        if (matchesWord) {
          matchedFiles.push(file.filename);
          codeReferencesSet.add(file.filename);
        }
      }

      // Special handling for test-related criteria
      const isTestCriterion =
        criterionLower.includes("test") ||
        criterionLower.includes("coverage") ||
        criterionLower.includes("spec") ||
        criterionLower.includes("assert");

      let status: "MET" | "PARTIALLY_MET" | "NOT_MET" | "UNVERIFIABLE";
      let evidenceStr = "";
      let confidence: "HIGH" | "MEDIUM" | "LOW" = "MEDIUM";

      if (isTestCriterion) {
        if (ciState === "FAILED") {
          status = "NOT_MET";
          evidenceStr = `CI test suites reported failures (${failedChecks} check(s) failed).`;
          confidence = "HIGH";
          missingRequirements.push(`Fix failing CI test runs for: ${criterion}`);
          suggestedChanges.push("Resolve automated test failures before requesting milestone approval.");
        } else if (testFiles.length > 0) {
          status = "MET";
          evidenceStr = `Test modifications detected in ${testFiles.join(", ")} with CI status ${ciState}.`;
          confidence = "HIGH";
          matchedFiles.push(...testFiles);
        } else if (words.some((w) => codeDiffLower.includes(w))) {
          status = "PARTIALLY_MET";
          evidenceStr = "Code modifications reference criteria keywords, but no dedicated test files were changed.";
          confidence = "MEDIUM";
          missingRequirements.push(`Missing test specifications for: ${criterion}`);
          suggestedChanges.push("Add automated unit or integration tests to verify the behavior.");
        } else {
          status = "NOT_MET";
          evidenceStr = "No test files were created or modified in this pull request.";
          confidence = "HIGH";
          missingRequirements.push(criterion);
          suggestedChanges.push(`Implement test coverage to satisfy: "${criterion}"`);
        }
      } else {
        // Standard feature/requirement criterion
        const matchCount = words.filter((w) => codeDiffLower.includes(w)).length;
        const matchRatio = words.length > 0 ? matchCount / words.length : 0;

        if (matchedFiles.length > 0 && matchRatio >= 0.5) {
          status = "MET";
          evidenceStr = `Matching implementation found in ${matchedFiles.join(", ")} satisfying criterion requirements.`;
          confidence = "HIGH";
        } else if (matchedFiles.length > 0 || matchRatio > 0.2) {
          status = "PARTIALLY_MET";
          evidenceStr = `Partial keyword matches identified in ${matchedFiles.join(", ") || "diff"}, but complete evidence is inconclusive.`;
          confidence = "MEDIUM";
          missingRequirements.push(`Incomplete evidence for criterion: "${criterion}"`);
          suggestedChanges.push(`Review implementation against criterion: "${criterion}"`);
        } else {
          status = "NOT_MET";
          evidenceStr = "No matching code changes or diff evidence detected for this requirement.";
          confidence = "HIGH";
          missingRequirements.push(criterion);
          suggestedChanges.push(`Provide implementation for: "${criterion}"`);
        }
      }

      criteriaEvaluations.push({
        criterion,
        status,
        evidence: evidenceStr,
        confidence,
        matchedFiles: Array.from(new Set(matchedFiles)),
      });
    }

    // 5. Determine Overall Assessment
    const metCount = criteriaEvaluations.filter((c) => c.status === "MET").length;
    const partialCount = criteriaEvaluations.filter((c) => c.status === "PARTIALLY_MET").length;
    const totalCriteria = criteriaEvaluations.length;

    let overallAssessment: OverallAssessment;
    if (failedChecks > 0) {
      overallAssessment = metCount > 0 ? "PARTIAL" : "FAIL";
    } else if (metCount === totalCriteria) {
      overallAssessment = "PASS";
    } else if (metCount > 0 || partialCount > 0) {
      overallAssessment = "PARTIAL";
    } else {
      overallAssessment = "FAIL";
    }

    // 6. Compile Facts vs Interpretations
    const facts: string[] = [
      `PR #${pr.number} modifies ${files.length} file(s) (+${prMetadata.additions}/-${prMetadata.deletions} lines).`,
      `Pull Request state: ${pr.state.toUpperCase()} (Merged: ${prMetadata.isMerged ? "Yes" : "No"}).`,
      `GitHub CI checks: ${totalChecks} total (${passedChecks} passed, ${failedChecks} failed, ${pendingChecks} pending).`,
      `Head commit: ${pr.head?.sha?.substring(0, 8) || "N/A"} on branch "${pr.head?.ref || "unknown"}".`,
    ];

    if (testFiles.length > 0) {
      facts.push(`Test files modified: ${testFiles.join(", ")}`);
    }

    const interpretations: string[] = [
      `Algorithmic criterion matching resolved ${metCount}/${totalCriteria} requirements as MET.`,
    ];
    if (overallAssessment === "PASS") {
      interpretations.push("The pull request provides sufficient verifiable evidence to satisfy milestone specifications.");
    } else if (overallAssessment === "PARTIAL") {
      interpretations.push("The pull request fulfills several requirements, but requires additional evidence or test fixes.");
    } else {
      interpretations.push("The pull request does not satisfy the required acceptance criteria or exhibits failing CI checks.");
    }

    // 7. Potential Risks
    const potentialRisks: string[] = [];
    if (failedChecks > 0) {
      potentialRisks.push(`${failedChecks} automated CI check-run(s) failed.`);
    }
    if (pendingChecks > 0) {
      potentialRisks.push(`${pendingChecks} CI check-run(s) remain in progress.`);
    }
    if (!prMetadata.isMerged && pr.state === "closed") {
      potentialRisks.push("The pull request is closed without being merged.");
    }
    if (isOversizedDiff) {
      potentialRisks.push("The pull request diff exceeded 100KB and was truncated for verification analysis.");
    }
    if (testFiles.length === 0) {
      potentialRisks.push("No dedicated test files were changed in this pull request.");
    }

    const summary =
      overallAssessment === "PASS"
        ? `PR #${pr.number} successfully satisfies all ${totalCriteria} milestone criteria. CI checks are green and changes match specifications.`
        : overallAssessment === "PARTIAL"
        ? `PR #${pr.number} partially fulfills milestone specifications (${metCount}/${totalCriteria} criteria met). CI state is ${ciState}.`
        : `PR #${pr.number} does not satisfy milestone criteria. Missing implementation or failing CI checks were detected.`;

    return {
      milestoneId: milestone.id,
      bountyId: milestone.bountyId,
      pr: prMetadata,
      overallAssessment,
      summary,
      criteriaEvaluations,
      codeReferences: Array.from(codeReferencesSet),
      missingRequirements,
      potentialRisks,
      ciStatusSummary,
      suggestedChanges,
      confidence: {
        level: isOversizedDiff ? "MEDIUM" : "HIGH",
        explanation: isOversizedDiff
          ? "Large diff was truncated; criteria verified against modified file list and available patches."
          : "Direct analysis of GitHub file diffs, commit changes, and automated CI check runs.",
      },
      facts,
      interpretations,
      provider: "deterministic-pr-verifier",
      verifiedAt: new Date().toISOString(),
    };
  }
}

