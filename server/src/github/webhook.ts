import crypto from 'crypto';

/**
 * Validates a GitHub webhook payload against an HMAC SHA-256 signature header.
 * 
 * GitHub computes this as:
 *   X-Hub-Signature-256: sha256=<hex_digest>
 * where hex_digest = hmac_sha256(secret, rawPayload)
 * 
 * Uses crypto.timingSafeEqual to prevent timing attacks.
 */
export function verifyGitHubWebhookSignature(
  rawPayload: string | Buffer,
  signatureHeader: string | undefined | null,
  secret: string
): boolean {
  if (!signatureHeader || !secret) {
    return false;
  }

  // Header should be formatted as "sha256=<hex_hash>"
  const parts = signatureHeader.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') {
    return false;
  }

  const expectedSignature = parts[1];
  const payloadBuffer = typeof rawPayload === 'string' ? Buffer.from(rawPayload, 'utf8') : rawPayload;

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payloadBuffer);
  const actualSignature = hmac.digest('hex');

  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  const actualBuffer = Buffer.from(actualSignature, 'hex');

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

/**
 * Helper to compute an X-Hub-Signature-256 header value for tests or mock dispatches.
 */
export function computeGitHubWebhookSignature(payload: string | Buffer, secret: string): string {
  const payloadBuffer = typeof payload === 'string' ? Buffer.from(payload, 'utf8') : payload;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payloadBuffer);
  return `sha256=${hmac.digest('hex')}`;
}

export interface GitHubWebhookPullRequestEvent {
  action: 'opened' | 'closed' | 'reopened' | 'synchronize' | 'labeled' | 'unlabeled';
  number: number;
  pull_request: {
    id: number;
    number: number;
    state: 'open' | 'closed';
    title: string;
    body: string | null;
    merged: boolean;
    merged_at: string | null;
    merge_commit_sha: string | null;
    html_url: string;
    user: {
      login: string;
    };
    head: {
      ref: string;
      sha: string;
      repo: {
        full_name: string;
      };
    };
    base: {
      ref: string;
      sha: string;
      repo: {
        full_name: string;
      };
    };
  };
  repository: {
    id: number;
    name: string;
    full_name: string;
    owner: {
      login: string;
    };
  };
  sender: {
    login: string;
  };
}
