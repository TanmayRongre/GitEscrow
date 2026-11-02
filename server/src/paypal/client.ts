import {
  PayPalConfig,
  PayPalOAuthToken,
  PayPalError,
  PayPalApiErrorPayload,
  CreateOrderPayload,
  OrderResponse,
  RefundCapturePayload,
  RefundResponse,
  CaptureAuthorizationPayload,
  AuthorizationResponse,
  CaptureDetailsResponse,
  CreatePayoutPayload,
  CreatePayoutResponse,
  PayoutBatchResponse,
  BalancesResponse,
  VerifyWebhookSignaturePayload,
  VerifyWebhookSignatureResponse
} from './types';

export class PayPalClient {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl: string;
  private readonly enableLogging: boolean;

  // Cached OAuth token with expiry
  private cachedToken: PayPalOAuthToken | null = null;
  private tokenPromise: Promise<string> | null = null;

  constructor(config: PayPalConfig) {
    if (!config.clientId || !config.clientSecret) {
      throw new Error('PayPalClient requires clientId and clientSecret');
    }
    this.clientId = config.clientId.trim();
    this.clientSecret = config.clientSecret.trim();
    this.baseUrl = (config.baseUrl || 'https://api-m.sandbox.paypal.com').replace(/\/+$/, '');
    this.enableLogging = config.enableLogging ?? true;
  }

  /**
   * Sanitizes headers and bodies for safe console logging (secrets redacted).
   */
  private redactSensitive(data: unknown): unknown {
    if (data === null || data === undefined) return data;
    if (typeof data === 'string') {
      return data
        .replace(/(Bearer\s+)[A-Za-z0-9\-_.]+/gi, '$1[REDACTED_TOKEN]')
        .replace(/(Basic\s+)[A-Za-z0-9+/=]+/gi, '$1[REDACTED_CREDENTIALS]');
    }
    if (Array.isArray(data)) {
      return data.map((item) => this.redactSensitive(item));
    }
    if (typeof data === 'object') {
      const sanitized: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.includes('secret') ||
          lowerKey.includes('password') ||
          lowerKey === 'authorization' ||
          lowerKey === 'access_token'
        ) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = this.redactSensitive(val);
        }
      }
      return sanitized;
    }
    return data;
  }

  private log(message: string, meta?: unknown) {
    if (!this.enableLogging) return;
    if (meta !== undefined) {
      const sanitized = this.redactSensitive(meta);
      console.log(`[PayPalClient] ${message}`, JSON.stringify(sanitized, null, 2));
    } else {
      console.log(`[PayPalClient] ${message}`);
    }
  }

  /**
   * Retrieves a valid OAuth2 bearer token via client_credentials.
   * Caches the token and automatically refreshes 60 seconds before expiry.
   */
  public async getAccessToken(): Promise<string> {
    const now = Date.now();
    // Safety buffer of 60 seconds (60000ms)
    if (
      this.cachedToken &&
      this.cachedToken.obtained_at &&
      now < this.cachedToken.obtained_at + (this.cachedToken.expires_in - 60) * 1000
    ) {
      return this.cachedToken.access_token;
    }

    // Deduplicate in-flight token requests
    if (this.tokenPromise) {
      return this.tokenPromise;
    }

    this.tokenPromise = (async () => {
      try {
        const authHeader = `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`;
        const url = `${this.baseUrl}/v1/oauth2/token`;

        this.log(`Requesting OAuth2 access token from POST /v1/oauth2/token`);

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json'
          },
          body: 'grant_type=client_credentials'
        });

        const debugId = res.headers.get('paypal-debug-id') || undefined;
        const text = await res.text();
        let json: any = {};
        try {
          json = JSON.parse(text);
        } catch {
          json = { raw: text };
        }

        if (!res.ok) {
          this.log(`OAuth2 token error (${res.status}) [debug_id: ${debugId}]`, json);
          throw new PayPalError(
            res.status,
            debugId || json.debug_id,
            json.error_description || json.message || `OAuth token failure: ${res.statusText}`,
            json
          );
        }

        const tokenData: PayPalOAuthToken = {
          access_token: json.access_token,
          token_type: json.token_type,
          app_id: json.app_id,
          expires_in: Number(json.expires_in) || 3600,
          scope: json.scope,
          nonce: json.nonce,
          obtained_at: Date.now()
        };

        this.cachedToken = tokenData;
        this.log(`OAuth2 token acquired successfully (expires in ${tokenData.expires_in}s, app_id: ${tokenData.app_id})`);
        return tokenData.access_token;
      } finally {
        this.tokenPromise = null;
      }
    })();

    return this.tokenPromise;
  }

  /**
   * Dispatches an authenticated request to PayPal REST API.
   * Handles idempotency header (PayPal-Request-Id), parses debug_id, and redacts logs.
   */
  public async request<T = any>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
    headers: Record<string, string> = {}
  ): Promise<T> {
    const token = await this.getAccessToken();
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const url = `${this.baseUrl}${cleanPath}`;

    const reqHeaders: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...headers
    };

    if (body !== undefined && !reqHeaders['Content-Type']) {
      reqHeaders['Content-Type'] = 'application/json';
    }

    const sanitizedReqHeaders = this.redactSensitive(reqHeaders);
    this.log(`--> ${method} ${cleanPath}`, {
      headers: sanitizedReqHeaders,
      body: body !== undefined ? body : undefined
    });

    const res = await fetch(url, {
      method,
      headers: reqHeaders,
      body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined
    });

    const debugId = res.headers.get('paypal-debug-id') || undefined;
    const responseText = await res.text();
    let responseData: any = null;

    if (responseText && responseText.trim().length > 0) {
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = responseText;
      }
    }

    if (!res.ok) {
      const errPayload = (typeof responseData === 'object' && responseData !== null ? responseData : {}) as PayPalApiErrorPayload;
      const resolvedDebugId = debugId || errPayload.debug_id;
      const message =
        errPayload.message ||
        errPayload.name ||
        (typeof responseData === 'string' ? responseData : `Request failed with HTTP ${res.status}`);

      this.log(`<-- ${method} ${cleanPath} FAILED [${res.status}] debug_id: ${resolvedDebugId}`, responseData);
      throw new PayPalError(res.status, resolvedDebugId, message, responseData, errPayload.details);
    }

    this.log(`<-- ${method} ${cleanPath} SUCCESS [${res.status}] debug_id: ${debugId}`);
    return (responseData ?? {}) as T;
  }

  // ---------------- Convenience Methods ----------------

  /**
   * Create an order (CAPTURE or AUTHORIZE)
   */
  public async createOrder(payload: CreateOrderPayload, idempotencyKey?: string): Promise<OrderResponse> {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['PayPal-Request-Id'] = idempotencyKey;
    }
    return this.request<OrderResponse>('POST', '/v2/checkout/orders', payload, headers);
  }

  /**
   * Get order details
   */
  public async getOrder(orderId: string): Promise<OrderResponse> {
    return this.request<OrderResponse>('GET', `/v2/checkout/orders/${orderId}`);
  }

  /**
   * Capture an approved order
   */
  public async captureOrder(orderId: string, idempotencyKey?: string): Promise<OrderResponse> {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['PayPal-Request-Id'] = idempotencyKey;
    }
    return this.request<OrderResponse>('POST', `/v2/checkout/orders/${orderId}/capture`, {}, headers);
  }

  /**
   * Authorize payment for an approved order
   */
  public async authorizeOrder(orderId: string, idempotencyKey?: string): Promise<OrderResponse> {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['PayPal-Request-Id'] = idempotencyKey;
    }
    return this.request<OrderResponse>('POST', `/v2/checkout/orders/${orderId}/authorize`, {}, headers);
  }

  /**
   * Refund a captured payment (full or partial)
   */
  public async refundCapture(
    captureId: string,
    payload?: RefundCapturePayload,
    idempotencyKey?: string
  ): Promise<RefundResponse> {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['PayPal-Request-Id'] = idempotencyKey;
    }
    return this.request<RefundResponse>('POST', `/v2/payments/captures/${captureId}/refund`, payload || {}, headers);
  }

  /**
   * Get captured payment details (GET /v2/payments/captures/{capture_id})
   */
  public async getCapture(captureId: string): Promise<CaptureDetailsResponse> {
    return this.request<CaptureDetailsResponse>('GET', `/v2/payments/captures/${captureId}`);
  }

  /**
   * Get refund details (GET /v2/payments/refunds/{refund_id})
   */
  public async getRefund(refundId: string): Promise<RefundResponse> {
    return this.request<RefundResponse>('GET', `/v2/payments/refunds/${refundId}`);
  }

  /**
   * Get authorized payment details (GET /v2/payments/authorizations/{authorization_id})
   */
  public async getAuthorization(authorizationId: string): Promise<AuthorizationResponse> {
    return this.request<AuthorizationResponse>('GET', `/v2/payments/authorizations/${authorizationId}`);
  }

  /**
   * Capture an authorized payment
   */
  public async captureAuthorization(
    authorizationId: string,
    payload?: CaptureAuthorizationPayload,
    idempotencyKey?: string
  ): Promise<CaptureDetailsResponse> {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['PayPal-Request-Id'] = idempotencyKey;
    }
    return this.request<CaptureDetailsResponse>(
      'POST',
      `/v2/payments/authorizations/${authorizationId}/capture`,
      payload || {},
      headers
    );
  }

  /**
   * Void an authorized payment
   */
  public async voidAuthorization(authorizationId: string): Promise<AuthorizationResponse | void> {
    return this.request<AuthorizationResponse | void>(
      'POST',
      `/v2/payments/authorizations/${authorizationId}/void`,
      {}
    );
  }

  /**
   * Create a single or batch payout
   */
  public async createPayout(payload: CreatePayoutPayload, idempotencyKey?: string): Promise<CreatePayoutResponse> {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['PayPal-Request-Id'] = idempotencyKey;
    }
    return this.request<CreatePayoutResponse>('POST', '/v1/payments/payouts', payload, headers);
  }

  /**
   * Fetch status and items of a payout batch
   */
  public async getPayoutBatch(payoutBatchId: string): Promise<PayoutBatchResponse> {
    return this.request<PayoutBatchResponse>('GET', `/v1/payments/payouts/${payoutBatchId}`);
  }

  /**
   * Retrieve merchant balance reporting
   */
  public async getBalances(currencyCode: string = 'USD'): Promise<BalancesResponse> {
    const query = new URLSearchParams({ currency_code: currencyCode }).toString();
    return this.request<BalancesResponse>('GET', `/v1/reporting/balances?${query}`);
  }

  /**
   * Authoritatively verify PayPal webhook signature via PayPal REST API
   */
  public async verifyWebhookSignature(
    payload: VerifyWebhookSignaturePayload
  ): Promise<VerifyWebhookSignatureResponse> {
    return this.request<VerifyWebhookSignatureResponse>(
      'POST',
      '/v1/notifications/verify-webhook-signature',
      payload
    );
  }
}

let defaultPayPalClient: PayPalClient | null = null;

export function setPayPalClient(client: PayPalClient | null): void {
  defaultPayPalClient = client;
}

export function getPayPalClient(): PayPalClient {
  if (defaultPayPalClient) return defaultPayPalClient;
  const clientId = process.env.PAYPAL_CLIENT_ID || '';
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET || '';
  const baseUrl = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';

  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials missing: PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET not configured.');
  }

  defaultPayPalClient = new PayPalClient({
    clientId,
    clientSecret,
    baseUrl,
    enableLogging: process.env.NODE_ENV !== 'test'
  });
  return defaultPayPalClient;
}
