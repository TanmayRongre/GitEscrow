export type OverallAssessment = 'PASS' | 'PARTIAL' | 'FAIL' | 'INSUFFICIENT_EVIDENCE';
export type CriterionStatus = 'MET' | 'PARTIALLY_MET' | 'NOT_MET' | 'UNVERIFIABLE';
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type CIStatusState = 'PASSED' | 'FAILED' | 'PENDING' | 'NO_CHECKS';

export interface ICriterionEvaluation {
  criterion: string;
  status: CriterionStatus;
  evidence: string;
  confidence: ConfidenceLevel;
  matchedFiles?: string[];
}

export interface ICIStatusSummary {
  totalChecks: number;
  passed: number;
  failed: number;
  pending: number;
  state: CIStatusState;
  details: string[];
}

export interface ISubmittedPRMetadata {
  owner: string;
  repo: string;
  pullNumber: number;
  url: string;
  title: string;
  state: 'open' | 'closed';
  isMerged: boolean;
  headSha: string;
  baseBranch: string;
  headBranch: string;
  changedFilesCount: number;
  additions?: number;
  deletions?: number;
}

export interface IAcceptanceVerificationResult {
  milestoneId: string;
  bountyId: string;
  pr: ISubmittedPRMetadata;
  overallAssessment: OverallAssessment;
  summary: string;
  criteriaEvaluations: ICriterionEvaluation[];
  codeReferences: string[];
  missingRequirements: string[];
  potentialRisks: string[];
  ciStatusSummary: ICIStatusSummary;
  suggestedChanges: string[];
  confidence: {
    level: ConfidenceLevel;
    explanation: string;
  };
  facts: string[];
  interpretations: string[];
  provider: string;
  verifiedAt: string;
}

