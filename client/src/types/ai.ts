export type IssueComplexity = "LOW" | "MEDIUM" | "HIGH";
export type AnalysisConfidence = "HIGH" | "MEDIUM" | "LOW";

export type AnalysisStatus =
  | "READY_FOR_REVIEW"
  | "NEEDS_MORE_INFORMATION"
  | "INSUFFICIENT_EVIDENCE"
  | "ANALYSIS_FAILED";

export type EvidenceSourceType =
  | "issue_title"
  | "issue_body"
  | "issue_comment"
  | "label"
  | "code_reference"
  | "repo_context";

export type EvidenceSufficiency = "DIRECT" | "INFERRED" | "UNVERIFIED";

export interface IGroundedEvidence {
  item: string;
  source: EvidenceSourceType;
  evidenceExcerpt: string;
  evidenceSufficiency: EvidenceSufficiency;
}

export interface ISuggestedMilestone {
  order: number;
  title: string;
  description: string;
  weightPercentage: number;
  suggestedAmount: number;
  currency: "USD";
  acceptanceCriteria: string[];
  criteriaEvidence?: IGroundedEvidence[];
}

export interface IIssueAnalysisResult {
  issue: {
    owner: string;
    repo: string;
    issueNumber: number;
    title: string;
    url: string;
    state: "open" | "closed";
    labels: string[];
    author?: string;
  };
  summary: string;
  complexity: IssueComplexity;
  technicalRequirements: string[];
  dependencies: string[];
  suggestedMilestones: ISuggestedMilestone[];
  totalRewardAmount: number;
  confidence: AnalysisConfidence;
  provider: string;
  analyzedAt: string;
  status?: AnalysisStatus;
  insufficientReason?: string;
  missingInformation?: string[];
  sponsorQuestions?: string[];
  improvementSuggestions?: string[];
  evidenceCoverage?: number;
  groundedRequirements?: IGroundedEvidence[];
  model?: string;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface IIssueAnalysisResponse {
  success: boolean;
  message: string;
  analysis: IIssueAnalysisResult;
}

