import mongoose, { Document, Schema } from 'mongoose';

export interface IWebhookDelivery extends Document {
  deliveryId: string;
  event: string;
  action?: string;
  repository?: string;
  sender?: string;
  receivedAt: Date;
  processed: boolean;
  status: 'PROCESSING' | 'PROCESSED' | 'FAILED';
  processingStartedAt?: Date;
  completedAt?: Date;
  error?: string;
  attempts?: number;
  sideEffectInitiated?: boolean;
  sideEffectCompleted?: boolean;
  payloadSummary?: Record<string, unknown>;
}

const WebhookDeliverySchema = new Schema<IWebhookDelivery>({
  deliveryId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  event: {
    type: String,
    required: true,
    index: true
  },
  action: {
    type: String,
    required: false
  },
  repository: {
    type: String,
    required: false
  },
  sender: {
    type: String,
    required: false
  },
  receivedAt: {
    type: Date,
    default: Date.now
  },
  processed: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['PROCESSING', 'PROCESSED', 'FAILED'],
    default: function (this: any) {
      return this.processed ? 'PROCESSED' : 'PROCESSING';
    },
    index: true
  },
  processingStartedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    required: false
  },
  error: {
    type: String,
    required: false
  },
  attempts: {
    type: Number,
    default: 1
  },
  sideEffectInitiated: {
    type: Boolean,
    default: false
  },
  sideEffectCompleted: {
    type: Boolean,
    default: false
  },
  payloadSummary: {
    type: Schema.Types.Mixed,
    required: false
  }
});

export const WebhookDelivery = mongoose.models.WebhookDelivery ||
  mongoose.model<IWebhookDelivery>('WebhookDelivery', WebhookDeliverySchema);

