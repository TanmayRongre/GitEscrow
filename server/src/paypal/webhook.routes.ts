import { Router } from 'express';
import { PayPalWebhookController } from './webhook.controller';

export const paypalWebhookRouter = Router();

// Endpoint for PayPal incoming webhooks
paypalWebhookRouter.post('/', PayPalWebhookController.handleWebhook);

