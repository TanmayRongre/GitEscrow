/**
 * GitEscrow PayPal API Types
 * Based on official PayPal REST API v1 & v2 specifications.
 */

export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  baseUrl?: string; // Defaults to https://api-m.sandbox.paypal.com
  enableLogging?: boolean;
}

export interface PayPalOAuthToken {
  access_token: string;
  token_type: string;
  app_id: string;
  expires_in: number;
  scope: string;
  nonce?: string;
  obtained_at?: number; // Internal timestamp (epoch ms)
}

export interface PayPalApiIssue {
  field?: string;
  value?: string;
  issue?: string;
  description?: string;
  location?: string;
}

export interface PayPalApiErrorPayload {
  name?: string;
  message?: string;
  debug_id?: string;
  information_link?: string;
  details?: PayPalApiIssue[];
  links?: Array<{
    href: string;
    rel: string;
    method?: string;
  }>;
}

export class PayPalError extends Error {
  public readonly status: number;
  public readonly debugId?: string;
  public readonly details?: PayPalApiIssue[];
  public readonly rawBody?: unknown;

  constructor(status: number, debugId: string | undefined, message: string, rawBody?: unknown, details?: PayPalApiIssue[]) {
    super(`PayPal API Error [${status}] (debug_id: ${debugId ?? 'unknown'}): ${message}`);
    this.name = 'PayPalError';
    this.status = status;
    this.debugId = debugId;
    this.details = details;
    this.rawBody = rawBody;
    Object.setPrototypeOf(this, PayPalError.prototype);
  }
}

export interface PayPalMoney {
  currency_code: string;
  value: string;
}

export interface PayPalLinkDescription {
  href: string;
  rel: string;
  method?: string;
  title?: string;
}

// ---------------- Orders v2 Types ----------------

export type OrderIntent = 'CAPTURE' | 'AUTHORIZE';

export interface CreateOrderPayload {
  intent: OrderIntent;
  purchase_units: Array<{
    reference_id?: string;
    description?: string;
    custom_id?: string;
    invoice_id?: string;
    amount: PayPalMoney;
  }>;
  application_context?: {
    brand_name?: string;
    landing_page?: 'LOGIN' | 'BILLING' | 'NO_PREFERENCE';
    shipping_preference?: 'GET_FROM_FILE' | 'NO_SHIPPING' | 'SET_PROVIDED_ADDRESS';
    user_action?: 'PAY_NOW' | 'CONTINUE';
    return_url?: string;
    cancel_url?: string;
  };
}

export interface OrderResponse {
  id: string;
  status: 'CREATED' | 'SAVED' | 'APPROVED' | 'VOIDED' | 'COMPLETED' | 'PAYER_ACTION_REQUIRED';
  intent: OrderIntent;
  links: PayPalLinkDescription[];
  purchase_units?: Array<{
    reference_id?: string;
    amount?: PayPalMoney;
    payments?: {
      captures?: Array<{
        id: string;
        status: 'COMPLETED' | 'DECLINED' | 'PARTIALLY_REFUNDED' | 'PENDING' | 'REFUNDED';
        amount: PayPalMoney;
        create_time?: string;
        update_time?: string;
      }>;
      authorizations?: Array<{
        id: string;
        status: 'CREATED' | 'CAPTURED' | 'DENIED' | 'PARTIALLY_CAPTURED' | 'VOIDED' | 'PENDING';
        amount: PayPalMoney;
        expiration_time?: string;
      }>;
      refunds?: Array<{
        id: string;
        status: 'COMPLETED' | 'CANCELLED' | 'PENDING';
        amount: PayPalMoney;
      }>;
    };
  }>;
}

// ---------------- Payments v2 Types ----------------

export interface CaptureDetailsResponse {
  id: string;
  status: 'COMPLETED' | 'DECLINED' | 'PARTIALLY_REFUNDED' | 'PENDING' | 'REFUNDED' | 'FAILED';
  status_details?: {
    reason?: string;
  };
  amount: PayPalMoney;
  final_capture?: boolean;
  seller_receivable_breakdown?: {
    gross_amount: PayPalMoney;
    paypal_fee?: PayPalMoney;
    net_amount?: PayPalMoney;
    receivable_amount?: PayPalMoney;
    total_refunded_amount?: PayPalMoney;
  };
  links?: PayPalLinkDescription[];
  create_time?: string;
  update_time?: string;
}

export interface RefundCapturePayload {
  amount?: PayPalMoney;
  invoice_id?: string;
  note_to_payer?: string;
}

export interface RefundResponse {
  id: string;
  status: 'COMPLETED' | 'CANCELLED' | 'PENDING' | 'FAILED';
  status_details?: {
    reason?: string;
  };
  amount: PayPalMoney;
  note_to_payer?: string;
  create_time?: string;
  update_time?: string;
  links?: PayPalLinkDescription[];
}

export interface CaptureAuthorizationPayload {
  amount?: PayPalMoney;
  is_final_capture?: boolean;
  invoice_id?: string;
  note_to_payer?: string;
}

export interface AuthorizationResponse {
  id: string;
  status: 'CREATED' | 'CAPTURED' | 'DENIED' | 'PARTIALLY_CAPTURED' | 'VOIDED' | 'PENDING';
  amount: PayPalMoney;
  expiration_time?: string;
  links?: PayPalLinkDescription[];
}

// ---------------- Payouts v1 Types ----------------

export interface PayoutItemAmount {
  currency: string; // Payouts v1 uses "currency", unlike Orders v2 which uses "currency_code"
  value: string;
}

export interface CreatePayoutPayload {
  sender_batch_header: {
    sender_batch_id: string;
    recipient_type?: 'EMAIL' | 'PHONE' | 'PAYPAL_ID';
    email_subject?: string;
    email_message?: string;
    note?: string;
  };
  items: Array<{
    recipient_type?: 'EMAIL' | 'PHONE' | 'PAYPAL_ID';
    amount: PayoutItemAmount;
    receiver: string;
    note?: string;
    sender_item_id?: string;
  }>;
}

export interface PayoutBatchHeader {
  payout_batch_id: string;
  batch_status: 'DENIED' | 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'CANCELED';
  time_created?: string;
  time_completed?: string;
  sender_batch_header: {
    sender_batch_id: string;
    email_subject?: string;
  };
  amount?: {
    currency: string;
    value: string;
  };
  fees?: {
    currency: string;
    value: string;
  };
}

export interface PayoutItemDetail {
  payout_item_id: string;
  transaction_id?: string;
  transaction_status?: 'SUCCESS' | 'FAILED' | 'PENDING' | 'UNCLAIMED' | 'RETURNED' | 'ONHOLD' | 'BLOCKED' | 'REFUNDED';
  payout_item_fee?: PayoutItemAmount;
  payout_batch_id: string;
  payout_item: {
    recipient_type: string;
    amount: PayoutItemAmount;
    receiver: string;
    note?: string;
    sender_item_id?: string;
  };
  time_processed?: string;
  errors?: unknown;
}

export interface CreatePayoutResponse {
  batch_header: PayoutBatchHeader;
  links: PayPalLinkDescription[];
}

export interface PayoutBatchResponse {
  batch_header: PayoutBatchHeader;
  items?: PayoutItemDetail[];
  links?: PayPalLinkDescription[];
}

// ---------------- Balances Reporting Types ----------------

export interface BalanceCurrencyAmount {
  currency: string;
  value: string;
}

export interface BalanceAccount {
  currency: string;
  primary?: boolean;
  total_balance: BalanceCurrencyAmount;
  available_balance?: BalanceCurrencyAmount;
  withheld_balance?: BalanceCurrencyAmount;
}

export interface BalancesResponse {
  balances?: BalanceAccount[];
  as_of_time?: string;
  last_refresh_time?: string;
}
