import mongoose, { Document, Schema, Model } from 'mongoose';

export type BountyStatus =
  | 'DRAFT'
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED';

export type BountyCurrency = 'USD';

export interface IBountyStatusHistory {
  fromStatus: BountyStatus;
  toStatus: BountyStatus;
  changedBy: mongoose.Types.ObjectId;
  timestamp: Date;
  reason?: string;
}

export interface IBounty extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  slug: string;
  description: string;
  organizationId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;

  // GitHub Reference
  repositoryOwner: string;
  repositoryName: string;
  repositoryFullName: string;
  repositoryUrl: string;
  repositoryId: number;
  issueNumber: number;
  issueUrl: string;
  issueTitle: string;
  issueState: 'open' | 'closed';

  // Reward Info (Stored as Decimal128)
  rewardAmount: mongoose.Types.Decimal128;
  currency: BountyCurrency;
  rewardDescription?: string;

  // Bounty Status
  status: BountyStatus;
  statusHistory: IBountyStatusHistory[];

  // Contributor Info
  assignedContributorId?: mongoose.Types.ObjectId;
  assignedAt?: Date;
  acceptedAt?: Date;
  submissionNotes?: string;
  prUrl?: string;
  prNumber?: number;

  // Dates
  publishedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BountyStatusHistorySchema = new Schema<IBountyStatusHistory>(
  {
    fromStatus: {
      type: String,
      required: true
    },
    toStatus: {
      type: String,
      required: true
    },
    changedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    reason: {
      type: String,
      trim: true,
      maxlength: [500, 'Reason cannot exceed 500 characters']
    }
  },
  { _id: false }
);

const BountySchema = new Schema<IBounty>(
  {
    title: {
      type: String,
      required: [true, 'Bounty title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    slug: {
      type: String,
      required: [true, 'Bounty slug is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens']
    },
    description: {
      type: String,
      required: [true, 'Bounty description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters'],
      maxlength: [10000, 'Description cannot exceed 10000 characters']
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization is required'],
      index: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator is required'],
      index: true
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Updated by is required']
    },

    // GitHub Reference
    repositoryOwner: {
      type: String,
      required: [true, 'Repository owner is required'],
      trim: true
    },
    repositoryName: {
      type: String,
      required: [true, 'Repository name is required'],
      trim: true
    },
    repositoryFullName: {
      type: String,
      required: [true, 'Repository full name is required'],
      trim: true
    },
    repositoryUrl: {
      type: String,
      required: [true, 'Repository URL is required'],
      trim: true
    },
    repositoryId: {
      type: Number,
      required: [true, 'Repository ID is required'],
      index: true
    },
    issueNumber: {
      type: Number,
      required: [true, 'Issue number is required'],
      index: true
    },
    issueUrl: {
      type: String,
      required: [true, 'Issue URL is required'],
      trim: true
    },
    issueTitle: {
      type: String,
      required: [true, 'Issue title is required'],
      trim: true
    },
    issueState: {
      type: String,
      enum: ['open', 'closed'],
      default: 'open'
    },

    // Reward Information (Exact decimal storage)
    rewardAmount: {
      type: Schema.Types.Decimal128,
      required: [true, 'Reward amount is required'],
      validate: {
        validator(v: mongoose.Types.Decimal128) {
          if (!v) return false;
          return parseFloat(v.toString()) > 0;
        },
        message: 'Reward amount must be a positive number'
      }
    },
    currency: {
      type: String,
      enum: ['USD'],
      default: 'USD',
      required: true
    },
    rewardDescription: {
      type: String,
      trim: true,
      maxlength: [500, 'Reward description cannot exceed 500 characters']
    },

    // Bounty Status
    status: {
      type: String,
      enum: [
        'DRAFT',
        'OPEN',
        'ASSIGNED',
        'IN_PROGRESS',
        'SUBMITTED',
        'UNDER_REVIEW',
        'COMPLETED',
        'CANCELLED',
        'EXPIRED'
      ],
      default: 'DRAFT',
      index: true
    },
    statusHistory: {
      type: [BountyStatusHistorySchema],
      default: []
    },

    // Contributor Information
    assignedContributorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: undefined,
      index: true
    },
    assignedAt: {
      type: Date,
      default: undefined
    },
    acceptedAt: {
      type: Date,
      default: undefined
    },
    submissionNotes: {
      type: String,
      trim: true,
      maxlength: [2000, 'Submission notes cannot exceed 2000 characters']
    },
    prUrl: {
      type: String,
      trim: true
    },
    prNumber: {
      type: Number
    },

    // Timestamps
    publishedAt: {
      type: Date,
      default: undefined
    },
    expiresAt: {
      type: Date,
      default: undefined
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

// Compound index to prevent duplicate active bounties for the same organization and GitHub issue
BountySchema.index(
  { organizationId: 1, repositoryId: 1, issueNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $nin: ['CANCELLED', 'EXPIRED'] } },
    name: 'unique_active_org_repo_issue_bounty'
  }
);

// Indexes for query performance and marketplace discovery
BountySchema.index({ status: 1, createdAt: -1 });
BountySchema.index({ organizationId: 1, status: 1 });
BountySchema.index({ assignedContributorId: 1, status: 1 });

export const Bounty: Model<IBounty> =
  mongoose.models.Bounty || mongoose.model<IBounty>('Bounty', BountySchema);

