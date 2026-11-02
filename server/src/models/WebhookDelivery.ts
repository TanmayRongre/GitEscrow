import mongoose, { Document, Schema } from 'mongoose';

export interface IWebhookDelivery extends Document {
  deliveryId: string;
  event: string;
  action?: string;
  repository?: string;
  sender?: string;
  receivedAt: Date;
  processed: boolean;
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
    default: true
  },
  payloadSummary: {
    type: Schema.Types.Mixed,
    required: false
  }
});

export const WebhookDelivery = mongoose.models.WebhookDelivery ||
  mongoose.model<IWebhookDelivery>('WebhookDelivery', WebhookDeliverySchema);

