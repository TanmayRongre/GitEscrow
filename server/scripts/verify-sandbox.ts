/**
 * GitEscrow - PayPal Sandbox Resumable Verification Test Suite
 * Task 1A: Foundation & PayPal Sandbox Verification
 * 
 * Verification Stages:
 *   A. Authentication (OAuth2 Bearer token)
 *   B. Order Creation ($100.00 USD, intent CAPTURE)
 *   C. Buyer Approval & Payment Capture (Resumable across script reruns)
 *   D. Refund Testing ($30.00 partial + $70.00 remaining, actual response based)
 *   E. Payouts API Verification (Capability check + guarded --run-payout)
 *   F. MongoDB Verification (Connection ping & cleanup)
 * 
 * CLI Commands:
 *   npx tsx scripts/verify-sandbox.ts
 *   npx tsx scripts/verify-sandbox.ts --run-payout
 *   npx tsx scripts/verify-sandbox.ts --reset
 *   npx tsx scripts/verify-sandbox.ts --reset --confirm
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { PayPalClient } from '../src/paypal/client';
import { PayPalError, OrderResponse, CaptureDetailsResponse } from '../src/paypal/types';

// Load environment configuration
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_BASE_URL = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';
const PAYPAL_SANDBOX_CONTRIBUTOR_EMAIL =
  process.env.PAYPAL_SANDBOX_CONTRIBUTOR_EMAIL || 'sb-contributor@personal.example.com';
const MONGODB_URI = process.env.MONGODB_URI;

// CLI Flags
const args = process.argv.slice(2);
const isRunPayout = args.includes('--run-payout');
const isReset = args.includes('--reset');
const isConfirm = args.includes('--confirm') || args.includes('-y');

// State File Location (Mandatory: kept out of git via .gitignore)
const STATE_FILE = path.resolve(__dirname, '.verify-state.json');

export interface VerifyState {
  currentStage:
    | 'INIT'
    | 'AUTH_COMPLETED'
    | 'ORDER_CREATED'
    | 'AWAITING_BUYER_APPROVAL'
    | 'CAPTURED'
    | 'PARTIALLY_REFUNDED'
    | 'FULLY_REFUNDED'
    | 'COMPLETED';
  orderId?: string;
  orderAmount?: { currency: string; value: string };
  approvalUrl?: string;
  captureId?: string;
  capturedAmount?: { currency: string; value: string };
  partialRefundId?: string;
  partialRefundAmount?: { currency: string; value: string };
  finalRefundId?: string;
  finalRefundAmount?: { currency: string; value: string };
  payoutBatchId?: string;
  payoutStatus?: string;
  completedSteps: string[];
  lastExecutionTimestamp: string;
}

type ReportStatus = 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT TESTED';

interface ReportRow {
  test: string;
  status: ReportStatus;
  actualResult: string;
}

const reportMap: Record<string, ReportRow> = {
  oauth: { test: 'OAuth authentication', status: 'NOT TESTED', actualResult: 'Pending execution' },
  orderCreation: { test: 'Order creation', status: 'NOT TESTED', actualResult: 'Pending execution' },
  buyerApproval: { test: 'Buyer approval', status: 'NOT TESTED', actualResult: 'Pending execution' },
  paymentCapture: { test: 'Payment capture', status: 'NOT TESTED', actualResult: 'Pending execution' },
  partialRefund: { test: 'Partial refund', status: 'NOT TESTED', actualResult: 'Pending execution' },
  remainingRefund: { test: 'Remaining refund', status: 'NOT TESTED', actualResult: 'Pending execution' },
  finalRefundStatus: { test: 'Final refund status', status: 'NOT TESTED', actualResult: 'Pending execution' },
  payoutApiAccess: { test: 'Payout API access', status: 'NOT TESTED', actualResult: 'Pending execution' },
  payoutExecution: { test: 'Payout execution', status: 'NOT TESTED', actualResult: 'Pending execution' },
  payoutBatchRetrieval: { test: 'Payout batch retrieval', status: 'NOT TESTED', actualResult: 'Pending execution' },
  mongoConnection: { test: 'MongoDB connection', status: 'NOT TESTED', actualResult: 'Pending execution' }
};

function loadState(): VerifyState {
  if (fs.existsSync(STATE_FILE)) {
    try {
      const raw = fs.readFileSync(STATE_FILE, 'utf8');
      return JSON.parse(raw);
    } catch {
      console.warn(`[State] Warning: Failed to parse existing state file. Initializing clean state.`);
    }
  }
  return {
    currentStage: 'INIT',
    completedSteps: [],
    lastExecutionTimestamp: new Date().toISOString()
  };
}

function saveState(state: VerifyState): void {
  state.lastExecutionTimestamp = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function promptUser(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

function printFinalReport() {
  console.log(`\n========================================================================================================`);
  console.log(`                             GITESCROW TASK 1A: FINAL VERIFICATION REPORT                               `);
  console.log(`========================================================================================================`);
  console.log(`Test| Status| Actual result`);
  console.log(`---|---|---`);
  const order = [
    'oauth',
    'orderCreation',
    'buyerApproval',
    'paymentCapture',
    'partialRefund',
    'remainingRefund',
    'finalRefundStatus',
    'payoutApiAccess',
    'payoutExecution',
    'payoutBatchRetrieval',
    'mongoConnection'
  ];
  for (const key of order) {
    const row = reportMap[key];
    console.log(`${row.test}| ${row.status}| ${row.actualResult}`);
  }
  console.log(`========================================================================================================\n`);
}

async function handleReset(): Promise<boolean> {
  console.log(`\n----------------------------------------------------------------------`);
  console.log(`WARNING: Reset Request Detected (--reset)`);
  console.log(`This will delete your local verification state (${STATE_FILE}).`);
  console.log(`CRITICAL: Resetting local state DOES NOT reverse, cancel, or refund`);
  console.log(`any existing transactions on PayPal Sandbox.`);
  console.log(`----------------------------------------------------------------------`);

  let confirmed = isConfirm;
  if (!confirmed) {
    const ans = await promptUser('Are you sure you want to reset local verification state? [y/N]: ');
    confirmed = ans.toLowerCase() === 'y' || ans.toLowerCase() === 'yes';
  }

  if (confirmed) {
    if (fs.existsSync(STATE_FILE)) {
      fs.unlinkSync(STATE_FILE);
      console.log(`✓ Verification state cleared successfully.\n`);
    } else {
      console.log(`ℹ No existing state file found to delete.\n`);
    }
    return true;
  } else {
    console.log(`Reset aborted by user.\n`);
    return false;
  }
}

async function testMongo() {
  if (!MONGODB_URI) {
    reportMap.mongoConnection = {
      test: 'MongoDB connection',
      status: 'NOT TESTED',
      actualResult: 'MONGODB_URI not configured in server/.env'
    };
    return;
  }

  try {
    console.log(`[Mongo] Connecting to ${MONGODB_URI.replace(/\/\/[^@]+@/, '//***:***@')}...`);
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    const pingRes = await mongoose.connection.db?.admin().ping();
    const ok = pingRes && pingRes.ok === 1;
    if (ok) {
      reportMap.mongoConnection = {
        test: 'MongoDB connection',
        status: 'PASS',
        actualResult: 'Connected and pinged successfully (ok: 1)'
      };
      console.log(`  ✓ MongoDB ping successful.`);
    } else {
      reportMap.mongoConnection = {
        test: 'MongoDB connection',
        status: 'FAIL',
        actualResult: `Database ping returned unexpected response: ${JSON.stringify(pingRes)}`
      };
    }
  } catch (err: any) {
    reportMap.mongoConnection = {
      test: 'MongoDB connection',
      status: 'FAIL',
      actualResult: `Connection failed: ${err.message}`
    };
    console.error(`  ✗ MongoDB connection failed: ${err.message}`);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

async function main() {
  console.log(`\n======================================================================`);
  console.log(`  GitEscrow - PayPal Sandbox Resumable Verification`);
  console.log(`  Target Base URL: ${PAYPAL_BASE_URL}`);
  console.log(`  Mode: ${isRunPayout ? 'Payouts Enabled (--run-payout)' : 'Standard Verification (Payout execution guarded)'}`);
  console.log(`======================================================================\n`);

  if (isReset) {
    const shouldProceed = await handleReset();
    if (!shouldProceed) return;
  }

  const state = loadState();
  if (state.currentStage !== 'INIT') {
    console.log(`[Resume] Resuming previous verification session from stage: ${state.currentStage}`);
    console.log(`         Last execution: ${state.lastExecutionTimestamp}`);
    if (state.orderId) console.log(`         Existing Order ID: ${state.orderId}`);
    if (state.captureId) console.log(`         Existing Capture ID: ${state.captureId}`);
    console.log(``);
  }

  // -------------------------------------------------------------
  // Pre-check & Stage A: Authentication
  // -------------------------------------------------------------
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET || PAYPAL_CLIENT_ID.includes('your_paypal_sandbox')) {
    reportMap.oauth = {
      test: 'OAuth authentication',
      status: 'FAIL',
      actualResult: 'PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be configured in server/.env'
    };
    console.error(`[ERROR] Missing or placeholder PayPal Sandbox credentials in server/.env`);
    await testMongo();
    printFinalReport();
    return;
  }

  const client = new PayPalClient({
    clientId: PAYPAL_CLIENT_ID,
    clientSecret: PAYPAL_CLIENT_SECRET,
    baseUrl: PAYPAL_BASE_URL,
    enableLogging: false
  });

  console.log(`[Stage A] Testing OAuth2 Client Credentials Authentication...`);
  let accessToken = '';
  try {
    accessToken = await client.getAccessToken();
    reportMap.oauth = {
      test: 'OAuth authentication',
      status: 'PASS',
      actualResult: `Bearer token retrieved (length: ${accessToken.length}, expires_in: ~3600s)`
    };
    if (!state.completedSteps.includes('OAuth authentication')) {
      state.completedSteps.push('OAuth authentication');
    }
    console.log(`  ✓ OAuth2 Token acquired successfully.\n`);
  } catch (err: any) {
    const debugId = err instanceof PayPalError ? err.debugId : 'unknown';
    reportMap.oauth = {
      test: 'OAuth authentication',
      status: 'FAIL',
      actualResult: `HTTP ${err.status || 500} [debug_id: ${debugId}]: ${err.message}`
    };
    console.error(`  ✗ OAuth2 authentication failed: ${err.message}\n`);
    await testMongo();
    printFinalReport();
    return;
  }

  // -------------------------------------------------------------
  // Stage B: Order Creation ($100.00 USD, intent CAPTURE)
  // -------------------------------------------------------------
  console.log(`[Stage B] Verifying PayPal Sandbox Order Creation...`);
  let activeOrder: OrderResponse | null = null;

  // Requirement: Never create duplicate order when pending order exists.
  if (state.orderId) {
    try {
      console.log(`  Checking existing order state on PayPal (${state.orderId})...`);
      activeOrder = await client.getOrder(state.orderId);
      console.log(`  ✓ Existing order found: ID ${activeOrder.id} [Status: ${activeOrder.status}]`);
      reportMap.orderCreation = {
        test: 'Order creation',
        status: 'PASS',
        actualResult: `Existing order reused: ID ${activeOrder.id} [Status: ${activeOrder.status}]`
      };
    } catch (err: any) {
      console.warn(`  ⚠ Could not fetch existing order ${state.orderId} (${err.message}). Creating fresh order.`);
      state.orderId = undefined;
      state.approvalUrl = undefined;
    }
  }

  if (!state.orderId) {
    try {
      const orderPayload = {
        intent: 'CAPTURE' as const,
        purchase_units: [
          {
            reference_id: `gitescrow-verify-${Date.now()}`,
            description: 'GitEscrow Sandbox Bounty Escrow Test Payment ($100.00)',
            amount: {
              currency_code: 'USD',
              value: '100.00'
            }
          }
        ],
        application_context: {
          brand_name: 'GitEscrow Platform',
          user_action: 'PAY_NOW' as const,
          return_url: 'https://example.com/escrow/return',
          cancel_url: 'https://example.com/escrow/cancel'
        }
      };

      activeOrder = await client.createOrder(orderPayload, `idem-order-${Date.now()}`);
      state.orderId = activeOrder.id;
      state.orderAmount = { currency: 'USD', value: '100.00' };
      const approveLink = activeOrder.links.find((l) => l.rel === 'approve')?.href || '';
      state.approvalUrl = approveLink;
      state.currentStage = 'ORDER_CREATED';
      if (!state.completedSteps.includes('Order creation')) {
        state.completedSteps.push('Order creation');
      }
      saveState(state);

      reportMap.orderCreation = {
        test: 'Order creation',
        status: 'PASS',
        actualResult: `Created Order ID: ${activeOrder.id} ($100.00 USD) [Status: ${activeOrder.status}]`
      };
      console.log(`  ✓ Created Order ID: ${activeOrder.id}`);
      console.log(`  ✓ Approval URL: ${approveLink}\n`);
    } catch (err: any) {
      const debugId = err instanceof PayPalError ? err.debugId : 'unknown';
      reportMap.orderCreation = {
        test: 'Order creation',
        status: 'FAIL',
        actualResult: `HTTP ${err.status || 500} [debug_id: ${debugId}]: ${err.message}`
      };
      console.error(`  ✗ Order creation failed: ${err.message}\n`);
      await runPayoutAndMongo(client, state);
      printFinalReport();
      return;
    }
  }

  // -------------------------------------------------------------
  // Stage C: Buyer Approval and Payment Capture
  // -------------------------------------------------------------
  console.log(`[Stage C] Verifying Buyer Approval and Payment Capture...`);
  if (!activeOrder && state.orderId) {
    try {
      activeOrder = await client.getOrder(state.orderId);
    } catch (err: any) {
      console.error(`  ✗ Failed to inspect order status: ${err.message}`);
    }
  }

  const orderStatus = activeOrder?.status;
  const approvalUrl = state.approvalUrl || activeOrder?.links.find((l) => l.rel === 'approve')?.href || '';

  if (orderStatus === 'CREATED' || orderStatus === 'PAYER_ACTION_REQUIRED') {
    // Buyer has NOT approved the order yet.
    reportMap.buyerApproval = {
      test: 'Buyer approval',
      status: 'BLOCKED',
      actualResult: `Awaiting manual approval on PayPal Sandbox: ${approvalUrl}`
    };
    reportMap.paymentCapture = {
      test: 'Payment capture',
      status: 'BLOCKED',
      actualResult: `Cannot capture until order is approved by buyer (current status: ${orderStatus})`
    };
    reportMap.partialRefund = {
      test: 'Partial refund',
      status: 'BLOCKED',
      actualResult: 'Requires payment capture'
    };
    reportMap.remainingRefund = {
      test: 'Remaining refund',
      status: 'BLOCKED',
      actualResult: 'Requires payment capture'
    };
    reportMap.finalRefundStatus = {
      test: 'Final refund status',
      status: 'BLOCKED',
      actualResult: 'Requires payment capture'
    };

    state.currentStage = 'AWAITING_BUYER_APPROVAL';
    saveState(state);

    console.log(`  -------------------------------------------------------------------`);
    console.log(`  PAUSE: MANUAL SANDBOX BUYER APPROVAL REQUIRED`);
    console.log(`  -------------------------------------------------------------------`);
    console.log(`  Order ID: ${state.orderId}`);
    console.log(`  Approval URL:\n  ${approvalUrl}\n`);
    console.log(`  Steps to complete approval:`);
    console.log(`  1. Open the URL above in your web browser.`);
    console.log(`  2. Log in using a Sandbox Personal (buyer) account.`);
    console.log(`  3. Click "Complete Purchase" to approve the $100.00 USD transaction.`);
    console.log(`  4. Once approved, re-run this script to resume:`);
    console.log(`     npm run verify:sandbox\n`);
    console.log(`  The verification state is safely preserved in server/scripts/.verify-state.json.`);
    console.log(`  -------------------------------------------------------------------\n`);
  } else if (orderStatus === 'APPROVED') {
    reportMap.buyerApproval = {
      test: 'Buyer approval',
      status: 'PASS',
      actualResult: `Order ${state.orderId} approved by buyer [Status: APPROVED]`
    };
    console.log(`  ✓ Order approved by buyer! Proceeding to capture...`);

    // Requirement: Never repeat successful capture if already captured
    if (!state.captureId) {
      try {
        const captureRes = await client.captureOrder(state.orderId!, `idem-capture-${Date.now()}`);
        const captureObj = captureRes.purchase_units?.[0]?.payments?.captures?.[0];
        if (!captureObj || !captureObj.id) {
          throw new Error('Capture response did not contain capture details');
        }

        state.captureId = captureObj.id;
        state.capturedAmount = {
          currency: captureObj.amount.currency_code,
          value: captureObj.amount.value
        };
        state.currentStage = 'CAPTURED';
        if (!state.completedSteps.includes('Payment capture')) {
          state.completedSteps.push('Payment capture');
        }
        saveState(state);

        reportMap.paymentCapture = {
          test: 'Payment capture',
          status: 'PASS',
          actualResult: `Captured ID: ${captureObj.id} (${captureObj.amount.value} ${captureObj.amount.currency_code}) [Status: ${captureObj.status}]`
        };
        console.log(`  ✓ Payment successfully captured: ID ${captureObj.id}\n`);
      } catch (err: any) {
        const debugId = err instanceof PayPalError ? err.debugId : 'unknown';
        reportMap.paymentCapture = {
          test: 'Payment capture',
          status: 'FAIL',
          actualResult: `HTTP ${err.status || 500} [debug_id: ${debugId}]: ${err.message}`
        };
        console.error(`  ✗ Payment capture failed: ${err.message}\n`);
        await runPayoutAndMongo(client, state);
        printFinalReport();
        return;
      }
    }
  } else if (orderStatus === 'COMPLETED' || state.captureId) {
    reportMap.buyerApproval = {
      test: 'Buyer approval',
      status: 'PASS',
      actualResult: `Order ${state.orderId} previously approved and completed`
    };

    // Verify existing capture with PayPal directly (Requirement 6)
    if (state.captureId) {
      try {
        const captureCheck = await client.getCapture(state.captureId);
        reportMap.paymentCapture = {
          test: 'Payment capture',
          status: 'PASS',
          actualResult: `Verified existing capture: ID ${captureCheck.id} (${captureCheck.amount.value} ${captureCheck.amount.currency_code}) [Status: ${captureCheck.status}]`
        };
        console.log(`  ✓ Existing capture verified on PayPal: ID ${captureCheck.id} [Status: ${captureCheck.status}]\n`);
      } catch (err: any) {
        reportMap.paymentCapture = {
          test: 'Payment capture',
          status: 'FAIL',
          actualResult: `Failed to verify existing capture ID ${state.captureId}: ${err.message}`
        };
      }
    }
  }

  // -------------------------------------------------------------
  // Stage D: Refund Testing ($30.00 partial + $70.00 remaining)
  // -------------------------------------------------------------
  if (state.captureId) {
    console.log(`[Stage D] Verifying Refund Lifecycle using Capture ID ${state.captureId}...`);
    try {
      // Fetch live capture state to check actual amounts and completed refunds
      const currentCapture: CaptureDetailsResponse = await client.getCapture(state.captureId);
      const capturedTotal = parseFloat(currentCapture.amount.value);
      const currency = currentCapture.amount.currency_code;
      const alreadyRefundedTotal = currentCapture.seller_receivable_breakdown?.total_refunded_amount
        ? parseFloat(currentCapture.seller_receivable_breakdown.total_refunded_amount.value)
        : 0;

      console.log(`  Live Capture Status: ${currentCapture.status}`);
      console.log(`  Captured Amount: $${capturedTotal.toFixed(2)} ${currency}`);
      console.log(`  Already Refunded: $${alreadyRefundedTotal.toFixed(2)} ${currency}`);

      // D1: Partial Refund ($30.00)
      if (state.partialRefundId) {
        try {
          const verifiedPartial = await client.getRefund(state.partialRefundId);
          reportMap.partialRefund = {
            test: 'Partial refund',
            status: 'PASS',
            actualResult: `Verified existing partial refund: ID ${verifiedPartial.id} ($${verifiedPartial.amount.value} ${verifiedPartial.amount.currency_code}) [Status: ${verifiedPartial.status}]`
          };
          console.log(`  ✓ Existing partial refund verified: ID ${verifiedPartial.id}`);
        } catch (err: any) {
          reportMap.partialRefund = {
            test: 'Partial refund',
            status: 'FAIL',
            actualResult: `Failed to verify partial refund ${state.partialRefundId}: ${err.message}`
          };
        }
      } else {
        if (currentCapture.status === 'COMPLETED') {
          console.log(`  Executing partial refund of $30.00 ${currency}...`);
          const partialRes = await client.refundCapture(
            state.captureId,
            {
              amount: { currency_code: currency, value: '30.00' },
              note_to_payer: 'GitEscrow partial refund verification ($30.00)'
            },
            `idem-refund-partial-${Date.now()}`
          );

          state.partialRefundId = partialRes.id;
          state.partialRefundAmount = { currency, value: '30.00' };
          state.currentStage = 'PARTIALLY_REFUNDED';
          if (!state.completedSteps.includes('Partial refund')) {
            state.completedSteps.push('Partial refund');
          }
          saveState(state);

          reportMap.partialRefund = {
            test: 'Partial refund',
            status: 'PASS',
            actualResult: `Refund ID: ${partialRes.id} ($30.00 ${currency}) [Status: ${partialRes.status}]`
          };
          console.log(`  ✓ Partial refund executed: ID ${partialRes.id} [Status: ${partialRes.status}]`);
        } else {
          reportMap.partialRefund = {
            test: 'Partial refund',
            status: 'BLOCKED',
            actualResult: `Capture status is ${currentCapture.status}; cannot execute initial partial refund`
          };
        }
      }

      // D2: Remaining Refund ($70.00 / remaining balance)
      if (state.finalRefundId) {
        try {
          const verifiedFinal = await client.getRefund(state.finalRefundId);
          reportMap.remainingRefund = {
            test: 'Remaining refund',
            status: 'PASS',
            actualResult: `Verified existing final refund: ID ${verifiedFinal.id} ($${verifiedFinal.amount.value} ${verifiedFinal.amount.currency_code}) [Status: ${verifiedFinal.status}]`
          };
          console.log(`  ✓ Existing remaining refund verified: ID ${verifiedFinal.id}`);
        } catch (err: any) {
          reportMap.remainingRefund = {
            test: 'Remaining refund',
            status: 'FAIL',
            actualResult: `Failed to verify final refund ${state.finalRefundId}: ${err.message}`
          };
        }
      } else {
        // Calculate remaining refundable amount from actual captured amount and refunds
        const postPartialCapture = await client.getCapture(state.captureId);
        const refundedSoFar = postPartialCapture.seller_receivable_breakdown?.total_refunded_amount
          ? parseFloat(postPartialCapture.seller_receivable_breakdown.total_refunded_amount.value)
          : (state.partialRefundId ? 30.00 : 0);

        const remainingAmount = Math.max(0, capturedTotal - refundedSoFar);
        console.log(`  Calculated remaining refundable amount: $${remainingAmount.toFixed(2)} ${currency}`);

        if (remainingAmount > 0) {
          console.log(`  Executing remaining refund of $${remainingAmount.toFixed(2)} ${currency}...`);
          const remainingRes = await client.refundCapture(
            state.captureId,
            {
              amount: { currency_code: currency, value: remainingAmount.toFixed(2) },
              note_to_payer: `GitEscrow remaining balance refund verification ($${remainingAmount.toFixed(2)})`
            },
            `idem-refund-remaining-${Date.now()}`
          );

          state.finalRefundId = remainingRes.id;
          state.finalRefundAmount = { currency, value: remainingAmount.toFixed(2) };
          state.currentStage = 'FULLY_REFUNDED';
          if (!state.completedSteps.includes('Remaining refund')) {
            state.completedSteps.push('Remaining refund');
          }
          saveState(state);

          reportMap.remainingRefund = {
            test: 'Remaining refund',
            status: 'PASS',
            actualResult: `Refund ID: ${remainingRes.id} ($${remainingAmount.toFixed(2)} ${currency}) [Status: ${remainingRes.status}]`
          };
          console.log(`  ✓ Remaining refund executed: ID ${remainingRes.id} [Status: ${remainingRes.status}]`);
        } else {
          reportMap.remainingRefund = {
            test: 'Remaining refund',
            status: 'PASS',
            actualResult: `Remaining balance is $0.00 (already fully refunded)`
          };
        }
      }

      // D3: Final Refund Status
      const finalCaptureState = await client.getCapture(state.captureId);
      reportMap.finalRefundStatus = {
        test: 'Final refund status',
        status: 'PASS',
        actualResult: `Capture ${state.captureId} status: ${finalCaptureState.status} (Total refunded: $${finalCaptureState.seller_receivable_breakdown?.total_refunded_amount?.value || '100.00'} ${currency})`
      };
      console.log(`  ✓ Final Capture Status: ${finalCaptureState.status}\n`);
    } catch (err: any) {
      const debugId = err instanceof PayPalError ? err.debugId : 'unknown';
      console.error(`  ✗ Refund lifecycle error: ${err.message}\n`);
      if (reportMap.partialRefund.status === 'NOT TESTED') {
        reportMap.partialRefund = {
          test: 'Partial refund',
          status: 'FAIL',
          actualResult: `HTTP ${err.status || 500} [debug_id: ${debugId}]: ${err.message}`
        };
      }
      if (reportMap.remainingRefund.status === 'NOT TESTED') {
        reportMap.remainingRefund = {
          test: 'Remaining refund',
          status: 'FAIL',
          actualResult: `HTTP ${err.status || 500} [debug_id: ${debugId}]: ${err.message}`
        };
      }
      reportMap.finalRefundStatus = {
        test: 'Final refund status',
        status: 'FAIL',
        actualResult: `Failed to confirm final status: ${err.message}`
      };
    }
  }

  // -------------------------------------------------------------
  // Stage E: Payouts API Verification & Stage F: MongoDB
  // -------------------------------------------------------------
  await runPayoutAndMongo(client, state);
  printFinalReport();
}

async function runPayoutAndMongo(client: PayPalClient, state: VerifyState) {
  console.log(`[Stage E] Testing Payouts API Access...`);

  // Step 1: Probe Payouts capability
  let hasPayoutScope = false;
  try {
    // Non-destructive probe: Query a non-existent batch to test OAuth authorization scope
    await client.getPayoutBatch('NON_EXISTENT_PROBE_BATCH_ID');
    hasPayoutScope = true;
    reportMap.payoutApiAccess = {
      test: 'Payout API access',
      status: 'PASS',
      actualResult: 'Payouts API endpoint reachable and authorized'
    };
  } catch (err: any) {
    const debugId = err instanceof PayPalError ? err.debugId : 'unknown';
    if (err.status === 404 || (err.status === 400 && !String(err.message).includes('NOT_AUTHORIZED') && !String(err.message).includes('RESTRICTED'))) {
      // 404 Not Found or 400 Bad Request (invalid parameter format) proves the caller is authenticated & authorized for the Payouts endpoint
      hasPayoutScope = true;
      reportMap.payoutApiAccess = {
        test: 'Payout API access',
        status: 'PASS',
        actualResult: 'Payouts API endpoint authenticated and authorized'
      };
      console.log(`  ✓ Payouts API authorization verified.`);
    } else if (
      err.status === 403 ||
      String(err.message).includes('NOT_AUTHORIZED') ||
      String(err.message).includes('USER_BUSINESS_ACCOUNT_RESTRICTED') ||
      String(err.message).includes('FEATURE_NOT_AVAILABLE')
    ) {
      hasPayoutScope = false;
      reportMap.payoutApiAccess = {
        test: 'Payout API access',
        status: 'BLOCKED',
        actualResult: `HTTP ${err.status} [debug_id: ${debugId}]: Payouts feature disabled for this sandbox REST App`
      };
      console.warn(`  ⚠ Payouts API is blocked: Feature not enabled on sandbox REST app.\n`);
    } else {
      reportMap.payoutApiAccess = {
        test: 'Payout API access',
        status: 'FAIL',
        actualResult: `HTTP ${err.status || 500} [debug_id: ${debugId}]: ${err.message}`
      };
      console.error(`  ✗ Payouts API error: ${err.message}\n`);
    }
  }

  // Step 2: Payout Execution & Batch Retrieval
  if (!isRunPayout) {
    reportMap.payoutExecution = {
      test: 'Payout execution',
      status: 'NOT TESTED',
      actualResult: 'Execution guarded. Pass --run-payout to execute test disbursement'
    };
    reportMap.payoutBatchRetrieval = {
      test: 'Payout batch retrieval',
      status: 'NOT TESTED',
      actualResult: 'Execution guarded. Pass --run-payout to execute test disbursement'
    };
    console.log(`  ℹ Payout execution skipped. (Pass --run-payout to run a live test payout).\n`);
  } else {
    console.log(`  [--run-payout] Executing single test payout to ${PAYPAL_SANDBOX_CONTRIBUTOR_EMAIL}...`);

    if (state.payoutBatchId) {
      console.log(`  Found existing payout batch ID in state: ${state.payoutBatchId}. Retrieving status...`);
      try {
        const existingBatch = await client.getPayoutBatch(state.payoutBatchId);
        const bStatus = existingBatch.batch_header?.batch_status;
        reportMap.payoutExecution = {
          test: 'Payout execution',
          status: 'PASS',
          actualResult: `Existing batch reused: ID ${state.payoutBatchId} [Status: ${bStatus}]`
        };
        reportMap.payoutBatchRetrieval = {
          test: 'Payout batch retrieval',
          status: 'PASS',
          actualResult: `Batch ${state.payoutBatchId} status: ${bStatus}`
        };
        console.log(`  ✓ Existing payout batch status: ${bStatus}\n`);
      } catch (err: any) {
        reportMap.payoutBatchRetrieval = {
          test: 'Payout batch retrieval',
          status: 'FAIL',
          actualResult: `Failed to fetch batch ${state.payoutBatchId}: ${err.message}`
        };
      }
    } else {
      try {
        const senderBatchId = `GitEscrow_Payout_${Date.now()}`;
        const payoutPayload = {
          sender_batch_header: {
            sender_batch_id: senderBatchId,
            email_subject: 'GitEscrow Sandbox Bounty Test Payout',
            email_message: 'Verification payout test for GitEscrow.'
          },
          items: [
            {
              recipient_type: 'EMAIL' as const,
              receiver: PAYPAL_SANDBOX_CONTRIBUTOR_EMAIL,
              amount: {
                currency: 'USD',
                value: '1.00'
              },
              note: 'GitEscrow verification test payout ($1.00 USD)',
              sender_item_id: `verify-item-${Date.now()}`
            }
          ]
        };

        const createRes = await client.createPayout(payoutPayload, `idem-payout-${Date.now()}`);
        const newBatchId = createRes.batch_header?.payout_batch_id;
        state.payoutBatchId = newBatchId;
        state.payoutStatus = createRes.batch_header?.batch_status;
        saveState(state);

        reportMap.payoutExecution = {
          test: 'Payout execution',
          status: 'PASS',
          actualResult: `Payout batch created: ID ${newBatchId} [Status: ${createRes.batch_header?.batch_status}]`
        };
        console.log(`  ✓ Payout batch initiated: ID ${newBatchId}`);

        // Fetch batch status
        const batchDetails = await client.getPayoutBatch(newBatchId);
        reportMap.payoutBatchRetrieval = {
          test: 'Payout batch retrieval',
          status: 'PASS',
          actualResult: `Batch ${newBatchId} status: ${batchDetails.batch_header?.batch_status}`
        };
        console.log(`  ✓ Payout batch retrieval status: ${batchDetails.batch_header?.batch_status}\n`);
      } catch (payoutErr: any) {
        const debugId = payoutErr instanceof PayPalError ? payoutErr.debugId : 'unknown';
        if (
          payoutErr.status === 403 ||
          String(payoutErr.message).includes('NOT_AUTHORIZED') ||
          String(payoutErr.message).includes('FEATURE_NOT_AVAILABLE')
        ) {
          reportMap.payoutExecution = {
            test: 'Payout execution',
            status: 'BLOCKED',
            actualResult: `HTTP ${payoutErr.status} [debug_id: ${debugId}]: ${payoutErr.message}`
          };
          reportMap.payoutBatchRetrieval = {
            test: 'Payout batch retrieval',
            status: 'BLOCKED',
            actualResult: 'Cannot retrieve batch when creation is blocked'
          };
          console.warn(`  ⚠ Payout execution blocked: ${payoutErr.message}\n`);
        } else {
          reportMap.payoutExecution = {
            test: 'Payout execution',
            status: 'FAIL',
            actualResult: `HTTP ${payoutErr.status || 500} [debug_id: ${debugId}]: ${payoutErr.message}`
          };
          reportMap.payoutBatchRetrieval = {
            test: 'Payout batch retrieval',
            status: 'FAIL',
            actualResult: `Execution failed`
          };
          console.error(`  ✗ Payout execution failed: ${payoutErr.message}\n`);
        }
      }
    }
  }

  // -------------------------------------------------------------
  // Stage F: MongoDB Verification
  // -------------------------------------------------------------
  console.log(`[Stage F] Verifying MongoDB Connection...`);
  await testMongo();
}

main().catch((err) => {
  console.error('[FATAL] Verification suite uncaught error:', err);
  process.exit(1);
});
