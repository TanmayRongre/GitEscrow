import { z } from "zod";

export type OverallAssessment = "PASS" | "PARTIAL" | "FAIL" | "INSUFFICIENT_EVIDENCE";
export type CriterionStatus = "MET" | "PARTIALLY_MET" | "NOT_MET" | "UNVERIFIABLE";
export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
export type CIStatusState = "PASSED" | "FAILED" | "PENDING" | "NO_CHECKS";

/**
 * Individual evaluation of an acceptance criterion
 */
export const CriterionEvaluationSchema = z.object({
  criterion: z.string().trim().min(1, "Criterion description is required"),
  status: z.enum(["MET", "PARTIALLY_MET", "NOT_MET", "UNVERIFIABLE"]),
  evidence: z.string().trim().min(1, "Evidence statement is required"),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  matchedFiles: z.array(z.string().trim()).default([]),
});

export type CriterionEvaluation = z.infer<typeof CriterionEvaluationSchema>;

/**
 * CI/test status summary from GitHub check-runs and commit status
 */
export const CIStatusSummarySchema = z.object({
  totalChecks: z.number().int().nonnegative(),
  passed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
  state: z.enum(["PASSED", "FAILED", "PENDING", "NO_CHECKS"]),
  details: z.array(z.string().trim()).default([]),
});

export type CIStatusSummary = z.infer<typeof CIStatusSummarySchema>;

/**
 * Metadata about the submitted pull request
 */
export const SubmittedPRMetadataSchema = z.object({
  owner: z.string().trim().min(1),
  repo: z.string().trim().min(1),
  pullNumber: z.number().int().positive(),
  url: z.string().url(),
  title: z.string().trim(),
  state: z.enum(["open", "closed"]),
  isMerged: z.boolean(),
  headSha: z.string().trim(),
  baseBranch: z.string().trim(),
  headBranch: z.string().trim(),
  changedFilesCount: z.number().int().nonnegative(),
  additions: z.number().int().nonnegative().optional(),
  deletions: z.number().int().nonnegative().optional(),
});

export type SubmittedPRMetadata = z.infer<typeof SubmittedPRMetadataSchema>;

/**
 * Complete AI Acceptance Criteria Verification Report
 */
export const AcceptanceVerificationResultSchema = z.object({
  milestoneId: z.string().trim(),
  bountyId: z.string().trim(),
  pr: SubmittedPRMetadataSchema,
  overallAssessment: z.enum(["PASS", "PARTIAL", "FAIL", "INSUFFICIENT_EVIDENCE"]),
  summary: z.string().trim().min(10, "Summary must be at least 10 characters"),
  criteriaEvaluations: z
    .array(CriterionEvaluationSchema)
    .min(1, "At least one criterion evaluation must be included"),
  codeReferences: z.array(z.string().trim()).default([]),
  missingRequirements: z.array(z.string().trim()).default([]),
  potentialRisks: z.array(z.string().trim()).default([]),
  ciStatusSummary: CIStatusSummarySchema,
  suggestedChanges: z.array(z.string().trim()).default([]),
  confidence: z.object({
    level: z.enum(["HIGH", "MEDIUM", "LOW"]),
    explanation: z.string().trim().min(5),
  }),
  facts: z.array(z.string().trim()).min(1, "At least one verified fact must be documented"),
  interpretations: z.array(z.string().trim()).default([]),
  provider: z.string().trim(),
  verifiedAt: z.string(),
});

export type AcceptanceVerificationResult = z.infer<typeof AcceptanceVerificationResultSchema>;

/**
 * Request payload for submitting a PR against a milestone
 */
export const SubmitMilestonePRRequestSchema = z.object({
  prUrl: z
    .string()
    .trim()
    .min(1, "GitHub Pull Request URL is required")
    .url("Must be a valid URL")
    .regex(
      /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/i,
      "Must be a valid GitHub Pull Request URL (e.g., https://github.com/owner/repo/pull/123)"
    ),
  notes: z.string().trim().max(2000, "Notes cannot exceed 2000 characters").optional(),
});

export type SubmitMilestonePRRequest = z.infer<typeof SubmitMilestonePRRequestSchema>;

/**
 * Request payload for sponsor milestone decision
 */
export const ReviewMilestoneRequestSchema = z.object({
  action: z.enum(["APPROVE", "REQUEST_CHANGES", "REJECT"], {
    error: "Action must be APPROVE, REQUEST_CHANGES, or REJECT",
  }),
  decisionNotes: z
    .string()
    .trim()
    .min(3, "Decision notes must be at least 3 characters")
    .max(2000, "Decision notes cannot exceed 2000 characters"),
});

export type ReviewMilestoneRequest = z.infer<typeof ReviewMilestoneRequestSchema>;

