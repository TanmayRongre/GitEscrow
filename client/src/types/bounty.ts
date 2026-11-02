export type BountyStatus =
  | "DRAFT"
  | "OPEN"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "COMPLETED"
  | "CANCELLED"
  | "EXPIRED";

export type MilestoneStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED";

export type MilestonePayoutStatus =
  | "UNPAID"
  | "AWAITING_PAYOUT_INFO"
  | "QUEUED"
  | "PROCESSING"
  | "UNCERTAIN"
  | "SUCCESS"
  | "FAILED"
  | "UNCLAIMED";

export type FundingStatus =
  | "UNFUNDED"
  | "FUNDING_INITIATED"
  | "FUNDED"
  | "PARTIALLY_DISBURSED"
  | "FULLY_DISBURSED"
  | "REFUNDED";

export type LedgerEventType =
  | "FUNDING_INITIATED"
  | "FUNDING_CAPTURED"
  | "FUNDING_REFUNDED"
  | "REFUND_INITIATED"
  | "REFUND_COMPLETED"
  | "MILESTONE_APPROVED"
  | "PAYOUT_INITIATED"
  | "PAYOUT_COMPLETED"
  | "PAYMENT_FAILED"
  | "PAYMENT_REVERSED"
  | "MANUAL_ADJUSTMENT";

export interface IBountyStatusHistory {
  fromStatus?: BountyStatus;
  toStatus: BountyStatus;
  changedBy: string;
  reason?: string;
  changedAt?: string;
  timestamp?: string | Date;
  createdAt?: string | Date;
}

export interface IBounty {
  _id: string;
  id?: string;
  title: string;
  slug: string;
  description: string;
  organizationId:
    | {
        _id: string;
        name: string;
        slug: string;
        logoUrl?: string;
        description?: string;
      }
    | string;
  createdBy:
    | {
        _id: string;
        name: string;
        username: string;
      }
    | string;
  updatedBy?: string;
  repositoryOwner: string;
  repositoryName: string;
  repositoryFullName: string;
  repositoryUrl: string;
  repositoryId: number;
  issueNumber: number;
  issueUrl: string;
  issueTitle: string;
  issueState: "open" | "closed";
  rewardAmount: number;
  currency: "USD";
  rewardDescription?: string;
  fundingStatus?: FundingStatus;
  fundedAmount?: number;
  disbursedAmount?: number;
  reservedAmount?: number;
  inboundCaptureId?: string;
  status: BountyStatus;
  statusHistory: IBountyStatusHistory[];
  assignedContributorId?:
    | {
        _id: string;
        name: string;
        username: string;
        avatarUrl?: string;
      }
    | string;
  assignedAt?: string;
  acceptedAt?: string;
  submissionNotes?: string;
  prUrl?: string;
  prNumber?: number;
  createdAt: string;
  updatedAt: string;
}

export interface IMilestone {
  _id: string;
  id?: string;
  bountyId: string;
  title: string;
  description?: string;
  order: number;
  rewardAmount: number;
  currency: "USD";
  acceptanceCriteria: string[];
  status: MilestoneStatus;
  approvedBy?:
    | {
        _id: string;
        name: string;
        username: string;
      }
    | string;
  approvedAt?: string;
  decisionNotes?: string;
  submittedAt?: string;
  submissionDetails?: string;
  prUrl?: string;
  prNumber?: number;
  prTitle?: string;
  prState?: 'open' | 'closed';
  isMerged?: boolean;
  headSha?: string;
  baseBranch?: string;
  headBranch?: string;
  submissionHistory?: Array<{
    submittedAt: string;
    prUrl: string;
    prNumber: number;
    notes?: string;
    headSha?: string;
    assessment?: string;
  }>;
  latestVerification?: any;
  rejectionReason?: string;
  payoutStatus?: MilestonePayoutStatus;
  payoutBatchId?: string;
  payoutSenderBatchId?: string;
  payoutItemId?: string;
  payoutTransactionId?: string;
  payoutReceiverEmail?: string;
  payoutDisbursedAt?: string;
  payoutAttempts?: number;
  payoutError?: {
    name?: string;
    message?: string;
    debugId?: string;
    timestamp?: string;
    details?: any;
  };
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IEscrowLedger {
  _id: string;
  id?: string;
  bountyId: string;
  organizationId: string;
  eventType: LedgerEventType;
  amount: number;
  currency: "USD";
  status: "PENDING" | "COMPLETED" | "FAILED" | "REVERSED";
  paypalOrderId?: string;
  paypalCaptureId?: string;
  paypalRefundId?: string;
  relatedMilestoneId?: string;
  idempotencyKey: string;
  description: string;
  metadata?: Record<string, any>;
  createdBy?:
    | {
        _id: string;
        username: string;
      }
    | string;
  createdAt: string;
}

export interface IOrganization {
  _id: string;
  id?: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  ownerId: string;
  members: Array<{
    userId: string;
    role: "OWNER" | "SPONSOR" | "MEMBER";
    joinedAt: string;
  }>;
}
