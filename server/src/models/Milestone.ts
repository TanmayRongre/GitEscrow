import mongoose, { Document, Schema, Model } from 'mongoose';

export type MilestoneStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED';

export type MilestonePayoutStatus =
  | 'UNPAID'
  | 'AWAITING_PAYOUT_INFO'
  | 'QUEUED'
  | 'PROCESSING'
  | 'UNCERTAIN'
  | 'SUCCESS'
  | 'FAILED'
  | 'UNCLAIMED';

export interface IMilestone extends Document {
  _id: mongoose.Types.ObjectId;
  bountyId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  order: number;
  rewardAmount: mongoose.Types.Decimal128;
  currency: 'USD';
  acceptanceCriteria: string[];
  status: MilestoneStatus;
  dueDate?: Date;
  completedAt?: Date;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  decisionNotes?: string;
  submittedAt?: Date;
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
    submittedAt: Date;
    prUrl: string;
    prNumber: number;
    notes?: string;
    headSha?: string;
    assessment?: string;
  }>;
  latestVerification?: any;
  rejectionReason?: string;

  // Payout Lifecycle (Task 2D)
  payoutStatus: MilestonePayoutStatus;
  payoutBatchId?: string;
  payoutSenderBatchId?: string;
  payoutItemId?: string;
  payoutTransactionId?: string;
  payoutReceiverEmail?: string;
  payoutDisbursedAt?: Date;
  payoutAttempts?: number;
  payoutError?: {
    name?: string;
    message?: string;
    debugId?: string;
    timestamp?: Date;
    details?: any;
  };
  idempotencyKey?: string;

  createdAt: Date;
  updatedAt: Date;
}

const MilestoneSchema = new Schema<IMilestone>(
  {
    bountyId: {
      type: Schema.Types.ObjectId,
      ref: 'Bounty',
      required: [true, 'Bounty reference is required'],
      index: true
    },
    title: {
      type: String,
      required: [true, 'Milestone title is required'],
      trim: true,
      minlength: [2, 'Title must be at least 2 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    description: {
      type: String,
      required: [true, 'Milestone description is required'],
      trim: true,
      maxlength: [5000, 'Description cannot exceed 5000 characters']
    },
    order: {
      type: Number,
      required: [true, 'Milestone order is required'],
      min: [1, 'Order must be 1 or greater']
    },
    rewardAmount: {
      type: Schema.Types.Decimal128,
      required: [true, 'Milestone reward amount is required'],
      validate: {
        validator(v: mongoose.Types.Decimal128) {
          if (!v) return false;
          return parseFloat(v.toString()) > 0;
        },
        message: 'Milestone reward amount must be a positive number'
      }
    },
    currency: {
      type: String,
      enum: ['USD'],
      default: 'USD',
      required: true
    },
    acceptanceCriteria: {
      type: [String],
      required: [true, 'At least one acceptance criterion is required'],
      validate: [
        {
          validator(arr: string[]) {
            return Array.isArray(arr) && arr.length > 0 && arr.some((item) => item.trim().length > 0);
          },
          message: 'Acceptance criteria must contain at least one meaningful requirement'
        }
      ]
    },
    status: {
      type: String,
      enum: ['PENDING', 'IN_PROGRESS', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      index: true
    },
    dueDate: {
      type: Date,
      default: undefined
    },
    completedAt: {
      type: Date,
      default: undefined
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: undefined
    },
    approvedAt: {
      type: Date,
      default: undefined
    },
    decisionNotes: {
      type: String,
      trim: true,
      maxlength: [2000, 'Decision notes cannot exceed 2000 characters']
    },
    submittedAt: {
      type: Date,
      default: undefined
    },
    submissionDetails: {
      type: String,
      trim: true,
      maxlength: [2000, 'Submission details cannot exceed 2000 characters']
    },
    prUrl: {
      type: String,
      trim: true
    },
    prNumber: {
      type: Number
    },
    prTitle: {
      type: String,
      trim: true
    },
    prState: {
      type: String,
      enum: ['open', 'closed'],
      default: undefined
    },
    isMerged: {
      type: Boolean,
      default: false
    },
    headSha: {
      type: String,
      trim: true
    },
    baseBranch: {
      type: String,
      trim: true
    },
    headBranch: {
      type: String,
      trim: true
    },
    submissionHistory: [
      {
        submittedAt: { type: Date, default: Date.now },
        prUrl: { type: String, required: true },
        prNumber: { type: Number, required: true },
        notes: { type: String },
        headSha: { type: String },
        assessment: { type: String }
      }
    ],
    latestVerification: {
      type: Schema.Types.Mixed,
      default: undefined
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: [2000, 'Rejection reason cannot exceed 2000 characters']
    },
    payoutStatus: {
      type: String,
      enum: [
        'UNPAID',
        'AWAITING_PAYOUT_INFO',
        'QUEUED',
        'PROCESSING',
        'UNCERTAIN',
        'SUCCESS',
        'FAILED',
        'UNCLAIMED'
      ],
      default: 'UNPAID',
      index: true
    },
    payoutBatchId: {
      type: String,
      trim: true,
      index: true
    },
    payoutSenderBatchId: {
      type: String,
      trim: true,
      index: true
    },
    payoutItemId: {
      type: String,
      trim: true,
      index: true
    },
    payoutTransactionId: {
      type: String,
      trim: true,
      index: true
    },
    payoutReceiverEmail: {
      type: String,
      trim: true
    },
    payoutDisbursedAt: {
      type: Date,
      default: undefined
    },
    payoutAttempts: {
      type: Number,
      default: 0
    },
    payoutError: {
      type: Schema.Types.Mixed,
      default: undefined
    },
    idempotencyKey: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: any) {
        delete ret.__v;
        ret.id = ret._id;
        if (ret.rewardAmount) {
          ret.rewardAmount = parseFloat(ret.rewardAmount.toString());
        }
        return ret;
      }
    },
    toObject: {
      transform(_doc, ret: any) {
        delete ret.__v;
        ret.id = ret._id;
        if (ret.rewardAmount) {
          ret.rewardAmount = parseFloat(ret.rewardAmount.toString());
        }
        return ret;
      }
    }
  }
);

// Milestone order must be unique within a bounty
MilestoneSchema.index({ bountyId: 1, order: 1 }, { unique: true });
MilestoneSchema.index({ bountyId: 1, status: 1 });
MilestoneSchema.index({ bountyId: 1, payoutStatus: 1 });

export const Milestone: Model<IMilestone> =
  mongoose.models.Milestone || mongoose.model<IMilestone>('Milestone', MilestoneSchema);

