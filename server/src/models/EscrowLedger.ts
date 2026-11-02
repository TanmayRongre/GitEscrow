import mongoose, { Document, Schema, Model } from 'mongoose';

export type LedgerEventType =
  | 'FUNDING_INITIATED'
  | 'FUNDING_CAPTURED'
  | 'REFUND_INITIATED'
  | 'REFUND_COMPLETED'
  | 'MILESTONE_APPROVED'
  | 'PAYOUT_INITIATED'
  | 'PAYOUT_COMPLETED'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_REVERSED'
  | 'MANUAL_ADJUSTMENT';

export type LedgerEventStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED';
export type LedgerDirection = 'CREDIT' | 'DEBIT' | 'INTERNAL';

export interface IEscrowLedger extends Document {
  _id: mongoose.Types.ObjectId;
  bountyId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  eventType: LedgerEventType;
  amount: mongoose.Types.Decimal128;
  currency: 'USD';
  direction: LedgerDirection;
  status: LedgerEventStatus;
  paypalOrderId?: string;
  paypalCaptureId?: string;
  paypalRefundId?: string;
  relatedMilestoneId?: mongoose.Types.ObjectId;
  idempotencyKey: string;
  description: string;
  metadata: Record<string, any>;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const EscrowLedgerSchema = new Schema<IEscrowLedger>(
  {
    bountyId: {
      type: Schema.Types.ObjectId,
      ref: 'Bounty',
      required: [true, 'Bounty reference is required'],
      index: true
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization reference is required'],
      index: true
    },
    eventType: {
      type: String,
      enum: [
        'FUNDING_INITIATED',
        'FUNDING_CAPTURED',
        'REFUND_INITIATED',
        'REFUND_COMPLETED',
        'MILESTONE_APPROVED',
        'PAYOUT_INITIATED',
        'PAYOUT_COMPLETED',
        'PAYMENT_FAILED',
        'PAYMENT_REVERSED',
        'MANUAL_ADJUSTMENT'
      ],
      required: [true, 'Event type is required'],
      index: true
    },
    amount: {
      type: Schema.Types.Decimal128,
      required: [true, 'Amount is required'],
      validate: {
        validator(v: mongoose.Types.Decimal128) {
          if (!v) return false;
          return parseFloat(v.toString()) >= 0;
        },
        message: 'Ledger amount must be non-negative'
      }
    },
    currency: {
      type: String,
      enum: ['USD'],
      default: 'USD',
      required: true
    },
    direction: {
      type: String,
      enum: ['CREDIT', 'DEBIT', 'INTERNAL'],
      required: [true, 'Direction is required']
    },
    status: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'FAILED', 'REVERSED'],
      default: 'COMPLETED',
      index: true
    },
    paypalOrderId: {
      type: String,
      trim: true,
      index: true
    },
    paypalCaptureId: {
      type: String,
      trim: true,
      index: true
    },
    paypalRefundId: {
      type: String,
      trim: true,
      index: true
    },
    relatedMilestoneId: {
      type: Schema.Types.ObjectId,
      ref: 'Milestone',
      default: undefined
    },
    idempotencyKey: {
      type: String,
      required: [true, 'Idempotency key is required'],
      unique: true,
      trim: true
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: undefined
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Explicitly append-only, no updatedAt
    toJSON: {
      transform(_doc, ret: any) {
        delete ret.__v;
        ret.id = ret._id;
        if (ret.amount) {
          ret.amount = parseFloat(ret.amount.toString());
        }
        return ret;
      }
    },
    toObject: {
      transform(_doc, ret: any) {
        delete ret.__v;
        ret.id = ret._id;
        if (ret.amount) {
          ret.amount = parseFloat(ret.amount.toString());
        }
        return ret;
      }
    }
  }
);

// Append-only guards: Block updates and deletions
const blockMutation = function (this: any, next: (err?: Error) => void) {
  next(new Error('EscrowLedger is strictly append-only. Updates and deletions are prohibited.'));
};

EscrowLedgerSchema.pre('updateOne', blockMutation);
EscrowLedgerSchema.pre('updateMany', blockMutation);
EscrowLedgerSchema.pre('findOneAndUpdate', blockMutation);
EscrowLedgerSchema.pre('replaceOne', blockMutation);
EscrowLedgerSchema.pre('deleteOne', blockMutation);
EscrowLedgerSchema.pre('deleteMany', blockMutation);
EscrowLedgerSchema.pre('findOneAndDelete', blockMutation);

// Indexes for reconciliation, audit trails, and reporting
EscrowLedgerSchema.index({ bountyId: 1, createdAt: -1 });
EscrowLedgerSchema.index({ organizationId: 1, createdAt: -1 });
EscrowLedgerSchema.index({ eventType: 1, createdAt: -1 });

export const EscrowLedger: Model<IEscrowLedger> =
  mongoose.models.EscrowLedger || mongoose.model<IEscrowLedger>('EscrowLedger', EscrowLedgerSchema);

