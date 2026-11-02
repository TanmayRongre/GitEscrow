export type IssueComplexity = 'LOW' | 'MEDIUM' | 'HIGH';
export type AnalysisConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ISuggestedMilestone {
  order: number;
  title: string;
  description: string;
  weightPercentage: number;
  suggestedAmount: number;
  currency: 'USD';
  acceptanceCriteria: string[];
}

export interface IIssueAnalysisResult {
  issue: {
    owner: string;
    repo: string;
    issueNumber: number;
    title: string;
    url: string;
    state: 'open' | 'closed';
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
}

export interface IIssueAnalysisResponse {
  success: boolean;
  message: string;
  analysis: IIssueAnalysisResult;
}

