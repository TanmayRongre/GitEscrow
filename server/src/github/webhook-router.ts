import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { verifyGitHubWebhookSignature } from './webhook';
import { WebhookDelivery } from '../models/WebhookDelivery';

export const webhookRouter = Router();

// In-memory cache of recent delivery IDs (fallback when MongoDB is offline)
const recentDeliveryIds = new Set<string>();

export interface GitHubWebhookRequest extends Request {
  rawBody?: Buffer;
}

webhookRouter.post('/github', async (req: GitHubWebhookRequest, res: Response) => {
  const signatureHeader = req.headers['x-hub-signature-256'] as string | undefined;
  const event = (req.headers['x-github-event'] as string | undefined) || 'unknown';
  const deliveryId = (req.headers['x-github-delivery'] as string | undefined) || `local-${Date.now()}`;
  const secret = process.env.GITHUB_WEBHOOK_SECRET || '';

  // 1. Validate secret presence
  if (!secret) {
    console.error('[GitHub Webhook] Error: GITHUB_WEBHOOK_SECRET is not configured on server.');
    res.status(500).json({ error: 'Server misconfiguration: GITHUB_WEBHOOK_SECRET not set' });
    return;
  }

  // 2. Validate signature presence
  if (!signatureHeader) {
    res.status(401).json({ error: 'Missing X-Hub-Signature-256 header' });
    return;
  }

  // 3. Verify signature against exact raw body bytes
  const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
  const isValid = verifyGitHubWebhookSignature(rawBody, signatureHeader, secret);

  if (!isValid) {
    res.status(401).json({ error: 'Invalid X-Hub-Signature-256 signature' });
    return;
  }

  // 4. Duplicate delivery detection
  let isDuplicate = false;
  if (recentDeliveryIds.has(deliveryId)) {
    isDuplicate = true;
  } else if (mongoose.connection.readyState === 1) {
    try {
      const existing = await WebhookDelivery.findOne({ deliveryId });
      if (existing) {
        isDuplicate = true;
      }
    } catch (err: any) {
      console.warn(`[GitHub Webhook] Warning querying delivery ID: ${err.message}`);
    }
  }

  if (isDuplicate) {
    console.log(`[GitHub Webhook] Duplicate delivery ignored: ${deliveryId} (event: ${event})`);
    res.status(200).json({
      status: 'ignored',
      reason: 'duplicate delivery ID',
      deliveryId,
      event
    });
    return;
  }

  // Track delivery ID in memory (capped at 5000 entries)
  recentDeliveryIds.add(deliveryId);
  if (recentDeliveryIds.size > 5000) {
    const firstItem = recentDeliveryIds.values().next().value;
    if (firstItem) recentDeliveryIds.delete(firstItem);
  }

  // 5. Handle supported event types
  const supportedEvents = ['issues', 'pull_request', 'check_run', 'check_suite'];
  const payload = req.body || {};
  const action = payload.action;
  const repository = payload.repository?.full_name;
  const sender = payload.sender?.login;

  console.log(`[GitHub Webhook] Valid event received: ${event}${action ? `.${action}` : ''} | Repo: ${repository || 'N/A'} | Delivery: ${deliveryId}`);

  // 6. Store event metadata in MongoDB if connected
  if (mongoose.connection.readyState === 1) {
    try {
      await WebhookDelivery.create({
        deliveryId,
        event,
        action,
        repository,
        sender,
        receivedAt: new Date(),
        processed: true,
        payloadSummary: {
          issueNumber: payload.issue?.number,
          prNumber: payload.pull_request?.number,
          merged: payload.pull_request?.merged,
          checkRunName: payload.check_run?.name,
          checkRunConclusion: payload.check_run?.conclusion,
          checkSuiteStatus: payload.check_suite?.status
        }
      });
    } catch (dbErr: any) {
      console.warn(`[GitHub Webhook] Warning saving delivery to MongoDB: ${dbErr.message}`);
    }
  }

  res.status(200).json({
    status: 'received',
    supported: supportedEvents.includes(event),
    event,
    action,
    deliveryId
  });
});

