import { Request, Response } from 'express';
import { PayPalWebhookService, PayPalWebhookError } from './webhook.service';

export class PayPalWebhookController {
  public static async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const result = await PayPalWebhookService.processWebhook(req);
      if (result.status === 'DUPLICATE') {
        res.status(200).json({
          status: 'ok',
          message: 'Webhook duplicate already processed',
          eventType: result.eventType
        });
        return;
      }
      res.status(200).json({
        status: 'ok',
        message: 'Webhook processed successfully',
        eventType: result.eventType
      });
    } catch (err: any) {
      if (err instanceof PayPalWebhookError) {
        res.status(err.status).json({ error: err.message, code: err.code });
        return;
      }
      res.status(500).json({ error: `Webhook processing error: ${err.message}` });
    }
  }
}

