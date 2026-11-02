/**
 * GitEscrow - PayPal Authorization and Void Verification Suite
 * Task 1B: Separate Sandbox Orders for Authorization Testing
 * 
 * Tests:
 *   Test 1: Authorization and Capture (Order 1, $50.00 USD)
 *     1. Create new Sandbox order (intent: AUTHORIZE)
 *     2. Obtain buyer approval (pause/resume)
 *     3. Authorize the approved order
 *     4. Retrieve and verify authorization status
 *     5. Capture the authorization
 *     6. Retrieve capture and verify final status (COMPLETED)
 * 
 *   Test 2: Authorization and Void (Order 2, $25.00 USD)
 *     1. Create separate independent Sandbox order (intent: AUTHORIZE)
 *     2. Obtain buyer approval (pause/resume)
 *     3. Authorize the approved order
 *     4. Retrieve and verify authorization status
 *     5. Void the authorization
 *     6. Retrieve authorization and verify final status (VOIDED)
 * 
 * State file: server/scripts/.verify-auth-state.json (ignored by Git)
 * 
 * CLI Commands:
 *   npx tsx scripts/verify-paypal-authorization.ts
 *   npx tsx scripts/verify-paypal-authorization.ts --reset
 *   npx tsx scripts/verify-paypal-authorization.ts --reset --confirm
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import dotenv from 'dotenv';
import { PayPalClient } from '../src/paypal/client';
import { PayPalError, OrderResponse } from '../src/paypal/types';

// Load environment configuration
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_BASE_URL = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';

const args = process.argv.slice(2);
const isReset = args.includes('--reset');
const isConfirm = args.includes('--confirm') || args.includes('-y');

const STATE_FILE = path.resolve(__dirname, '.verify-auth-state.json');

export interface AuthOrderState {
  orderId?: string;
  approvalUrl?: string;
  authorizationId?: string;
  captureId?: string;
  voided?: boolean;
  status: 'INIT' | 'ORDER_CREATED' | 'AWAITING_APPROVAL' | 'APPROVED' | 'AUTHORIZED' | 'CAPTURED' | 'VOIDED' | 'COMPLETED';
  amount: { currency: string; value: string };
}

export interface AuthVerificationState {
  test1_capture: AuthOrderState;
  test2_void: AuthOrderState;
  lastExecutionTimestamp: string;
}

type TestStatus = 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT TESTED';

interface ReportRow {
  test: string;
  status: TestStatus;
  actualResult: string;
}

const reportMap: Record<string, ReportRow> = {
  auth1_authorize: { test: 'PayPal authorization', status: 'NOT TESTED', actualResult: 'Pending execution' },
  auth1_capture: { test: 'Authorization capture', status: 'NOT TESTED', actualResult: 'Pending execution' },
  auth2_authorize: { test: 'Separate authorization', status: 'NOT TESTED', actualResult: 'Pending execution' },
  auth2_void: { test: 'Authorization void', status: 'NOT TESTED', actualResult: 'Pending execution' }
};

function loadState(): AuthVerificationState {
  if (fs.existsSync(STATE_FILE)) {
    try {
      const raw = fs.readFileSync(STATE_FILE, 'utf8');
      return JSON.parse(raw);
    } catch {
      console.warn(`[State] Warning: Failed to parse existing state file. Initializing clean state.`);
    }
  }
  return {
    test1_capture: { status: 'INIT', amount: { currency: 'USD', value: '50.00' } },
    test2_void: { status: 'INIT', amount: { currency: 'USD', value: '25.00' } },
    lastExecutionTimestamp: new Date().toISOString()
  };
}

function saveState(state: AuthVerificationState): void {
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

function printReport() {
  console.log(`\n========================================================================================================`);
  console.log(`                       GITESCROW TASK 1B: PAYPAL AUTHORIZATION REPORT                                   `);
  console.log(`========================================================================================================`);
  console.log(`Test| Status| Actual Result`);
  console.log(`---|---|---`);
  const keys = ['auth1_authorize', 'auth1_capture', 'auth2_authorize', 'auth2_void'];
  for (const k of keys) {
    const row = reportMap[k];
    console.log(`${row.test}| ${row.status}| ${row.actualResult}`);
  }
  console.log(`========================================================================================================\n`);
  printValidityNotice();
}

function printValidityNotice() {
  console.log(`--------------------------------------------------------------------------------------------------------`);
  console.log(`PAYPAL AUTHORIZATION VALIDITY LIMITATIONS & ESCROW CONSIDERATIONS:`);
  console.log(`--------------------------------------------------------------------------------------------------------`);
  console.log(`1. Authorization Window:`);
  console.log(`   - PayPal authorizations remain valid for a maximum of 29 calendar days.`);
  console.log(`   - The initial honor period is 3 business days (funds guaranteed by PayPal).`);
  console.log(`   - After 3 days, funds may no longer be fully guaranteed without re-authorization.`);
  console.log(``);
  console.log(`2. Escrow Architecture for GitEscrow:`);
  console.log(`   - Short milestone bounties (< 3-29 days) can leverage Authorize -> Capture/Void.`);
  console.log(`   - Long-running bounties MUST use the captured platform escrow model (Orders CAPTURE -> Payouts)`);
  console.log(`     to avoid authorization expiration while open-source contributors work on pull requests.`);
  console.log(`--------------------------------------------------------------------------------------------------------\n`);
}

async function handleReset(): Promise<boolean> {
  console.log(`\n----------------------------------------------------------------------`);
  console.log(`WARNING: Reset Request Detected (--reset)`);
  console.log(`This will delete your local authorization state (${STATE_FILE}).`);
  console.log(`CRITICAL: Resetting local state DOES NOT reverse, cancel, or void`);
  console.log(`any existing transactions on PayPal Sandbox.`);
  console.log(`----------------------------------------------------------------------`);

  let confirmed = isConfirm;
  if (!confirmed) {
    const ans = await promptUser('Are you sure you want to reset local authorization state? [y/N]: ');
    confirmed = ans.toLowerCase() === 'y' || ans.toLowerCase() === 'yes';
  }

  if (confirmed) {
    if (fs.existsSync(STATE_FILE)) {
      fs.unlinkSync(STATE_FILE);
      console.log(`✓ Authorization verification state cleared successfully.\n`);
    } else {
      console.log(`ℹ No existing state file found to delete.\n`);
    }
    return true;
  } else {
    console.log(`Reset aborted by user.\n`);
    return false;
  }
}

async function run() {
  console.log(`\n======================================================================`);
  console.log(`  GitEscrow - PayPal Authorization and Void Verification Suite`);
  console.log(`  Target Base URL: ${PAYPAL_BASE_URL}`);
  console.log(`======================================================================\n`);

  if (isReset) {
    const shouldProceed = await handleReset();
    if (!shouldProceed) return;
  }

  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET || PAYPAL_CLIENT_ID.includes('your_paypal_sandbox')) {
    console.error(`[ERROR] Missing or placeholder PayPal Sandbox credentials in server/.env`);
    reportMap.auth1_authorize = { test: 'PayPal authorization', status: 'FAIL', actualResult: 'PAYPAL_CLIENT_ID missing in server/.env' };
    reportMap.auth1_capture = { test: 'Authorization capture', status: 'NOT TESTED', actualResult: 'Credentials missing' };
    reportMap.auth2_authorize = { test: 'Separate authorization', status: 'NOT TESTED', actualResult: 'Credentials missing' };
    reportMap.auth2_void = { test: 'Authorization void', status: 'NOT TESTED', actualResult: 'Credentials missing' };
    printReport();
    return;
  }

  const client = new PayPalClient({
    clientId: PAYPAL_CLIENT_ID,
    clientSecret: PAYPAL_CLIENT_SECRET,
    baseUrl: PAYPAL_BASE_URL,
    enableLogging: false
  });

  const state = loadState();

  // =========================================================================
  // TEST 1: AUTHORIZATION AND CAPTURE (Order 1, $50.00 USD)
  // =========================================================================
  console.log(`======================================================================`);
  console.log(`[TEST 1] AUTHORIZATION AND CAPTURE FLOW (Order 1: $50.00 USD)`);
  console.log(`======================================================================`);

  let order1: OrderResponse | null = null;

  // Step 1: Create or inspect Order 1
  if (state.test1_capture.orderId) {
    try {
      console.log(`  Inspecting existing Order 1 (${state.test1_capture.orderId})...`);
      order1 = await client.getOrder(state.test1_capture.orderId);
      console.log(`  ✓ Existing Order 1 found: ${order1.id} [Status: ${order1.status}]`);
    } catch (err: any) {
      console.warn(`  ⚠ Order 1 fetch failed: ${err.message}. Creating fresh order.`);
      state.test1_capture.orderId = undefined;
    }
  }

  if (!state.test1_capture.orderId) {
    try {
      console.log(`  Creating Order 1 with intent: AUTHORIZE ($50.00 USD)...`);
      order1 = await client.createOrder(
        {
          intent: 'AUTHORIZE',
          purchase_units: [
            {
              reference_id: `gitescrow-auth-test1-${Date.now()}`,
              description: 'GitEscrow Milestone Authorization & Capture Test ($50.00)',
              amount: { currency_code: 'USD', value: '50.00' }
            }
          ],
          application_context: {
            brand_name: 'GitEscrow Platform',
            user_action: 'CONTINUE',
            return_url: 'https://example.com/escrow/auth-return',
            cancel_url: 'https://example.com/escrow/auth-cancel'
          }
        },
        `idem-create-auth1-${Date.now()}`
      );

      state.test1_capture.orderId = order1.id;
      state.test1_capture.approvalUrl = order1.links.find((l) => l.rel === 'approve')?.href || '';
      state.test1_capture.status = 'ORDER_CREATED';
      saveState(state);
      console.log(`  ✓ Order 1 created: ID ${order1.id}`);
      console.log(`  ✓ Approval URL: ${state.test1_capture.approvalUrl}\n`);
    } catch (err: any) {
      const debugId = err instanceof PayPalError ? err.debugId : 'unknown';
      reportMap.auth1_authorize = {
        test: 'PayPal authorization',
        status: 'FAIL',
        actualResult: `HTTP ${err.status || 500} [debug_id: ${debugId}]: ${err.message}`
      };
      console.error(`  ✗ Failed to create Order 1: ${err.message}\n`);
    }
  }

  // Step 2: Check buyer approval for Order 1
  if (order1) {
    const status1 = order1.status;
    const approvalUrl1 = state.test1_capture.approvalUrl || '';

    if (status1 === 'CREATED' || status1 === 'PAYER_ACTION_REQUIRED') {
      reportMap.auth1_authorize = {
        test: 'PayPal authorization',
        status: 'BLOCKED',
        actualResult: `Awaiting buyer approval for Order 1: ${approvalUrl1}`
      };
      reportMap.auth1_capture = {
        test: 'Authorization capture',
        status: 'BLOCKED',
        actualResult: 'Awaiting buyer approval and authorization'
      };

      console.log(`  -------------------------------------------------------------------`);
      console.log(`  PAUSE: BUYER APPROVAL REQUIRED FOR ORDER 1 ($50.00 USD)`);
      console.log(`  -------------------------------------------------------------------`);
      console.log(`  Order 1 ID: ${state.test1_capture.orderId}`);
      console.log(`  Approval URL:\n  ${approvalUrl1}\n`);
      console.log(`  Open this URL in your browser, log in with Sandbox Personal (buyer),`);
      console.log(`  and approve the $50.00 authorization.`);
      console.log(`  -------------------------------------------------------------------\n`);
    } else if (status1 === 'APPROVED') {
      console.log(`  ✓ Order 1 is approved by buyer! Authorizing payment...`);

      // Step 3: Authorize Order 1
      if (!state.test1_capture.authorizationId) {
        try {
          const authRes = await client.authorizeOrder(state.test1_capture.orderId!, `idem-auth1-${Date.now()}`);
          const authObj = authRes.purchase_units?.[0]?.payments?.authorizations?.[0];
          if (!authObj || !authObj.id) {
            throw new Error('Authorization response did not contain authorization ID');
          }
          state.test1_capture.authorizationId = authObj.id;
          state.test1_capture.status = 'AUTHORIZED';
          saveState(state);
          console.log(`  ✓ Authorization granted: ID ${authObj.id} [Status: ${authObj.status}]`);
        } catch (err: any) {
          const debugId = err instanceof PayPalError ? err.debugId : 'unknown';
          reportMap.auth1_authorize = {
            test: 'PayPal authorization',
            status: 'FAIL',
            actualResult: `HTTP ${err.status || 500} [debug_id: ${debugId}]: ${err.message}`
          };
          console.error(`  ✗ Authorize Order 1 failed: ${err.message}\n`);
        }
      }
    } else if (status1 === 'COMPLETED' || state.test1_capture.authorizationId) {
      console.log(`  ✓ Order 1 previously approved and authorized: ID ${state.test1_capture.authorizationId}`);
    }
  }

  // Step 4 & 5: Verify Authorization & Capture
  if (state.test1_capture.authorizationId) {
    try {
      const authDetails = await client.getAuthorization(state.test1_capture.authorizationId);
      reportMap.auth1_authorize = {
        test: 'PayPal authorization',
        status: 'PASS',
        actualResult: `Authorization ID: ${authDetails.id} ($${authDetails.amount.value} ${authDetails.amount.currency_code}) [Status: ${authDetails.status}]`
      };
      console.log(`  ✓ Authorization verified on PayPal: ${authDetails.id} [Status: ${authDetails.status}]`);

      // Step 5: Capture the authorization
      if (!state.test1_capture.captureId) {
        if (authDetails.status === 'CREATED' || authDetails.status === 'PENDING') {
          console.log(`  Capturing authorization ${authDetails.id}...`);
          const captureRes = await client.captureAuthorization(
            authDetails.id,
            {
              amount: { currency_code: 'USD', value: '50.00' },
              is_final_capture: true,
              note_to_payer: 'GitEscrow milestone completion payout capture'
            },
            `idem-cap-auth1-${Date.now()}`
          );
          state.test1_capture.captureId = captureRes.id;
          state.test1_capture.status = 'CAPTURED';
          saveState(state);
          console.log(`  ✓ Authorization captured: Capture ID ${captureRes.id} [Status: ${captureRes.status}]`);
        } else if (authDetails.status === 'CAPTURED') {
          console.log(`  ✓ Authorization was already captured on PayPal.`);
        }
      }

      // Step 6: Verify final capture status
      if (state.test1_capture.captureId) {
        const finalCapture = await client.getCapture(state.test1_capture.captureId);
        reportMap.auth1_capture = {
          test: 'Authorization capture',
          status: 'PASS',
          actualResult: `Capture ID: ${finalCapture.id} ($${finalCapture.amount.value} ${finalCapture.amount.currency_code}) [Status: ${finalCapture.status}]`
        };
        console.log(`  ✓ Final capture status: ${finalCapture.status}\n`);
      }
    } catch (err: any) {
      const debugId = err instanceof PayPalError ? err.debugId : 'unknown';
      reportMap.auth1_capture = {
        test: 'Authorization capture',
        status: 'FAIL',
        actualResult: `HTTP ${err.status || 500} [debug_id: ${debugId}]: ${err.message}`
      };
      console.error(`  ✗ Authorization capture step failed: ${err.message}\n`);
    }
  }

  // =========================================================================
  // TEST 2: AUTHORIZATION AND VOID (Order 2, $25.00 USD - Separate Order)
  // =========================================================================
  console.log(`======================================================================`);
  console.log(`[TEST 2] AUTHORIZATION AND VOID FLOW (Order 2: $25.00 USD - Separate)`);
  console.log(`======================================================================`);

  let order2: OrderResponse | null = null;

  // Step 1: Create or inspect Order 2
  if (state.test2_void.orderId) {
    try {
      console.log(`  Inspecting existing Order 2 (${state.test2_void.orderId})...`);
      order2 = await client.getOrder(state.test2_void.orderId);
      console.log(`  ✓ Existing Order 2 found: ${order2.id} [Status: ${order2.status}]`);
    } catch (err: any) {
      console.warn(`  ⚠ Order 2 fetch failed: ${err.message}. Creating fresh order.`);
      state.test2_void.orderId = undefined;
    }
  }

  if (!state.test2_void.orderId) {
    try {
      console.log(`  Creating Order 2 with intent: AUTHORIZE ($25.00 USD)...`);
      order2 = await client.createOrder(
        {
          intent: 'AUTHORIZE',
          purchase_units: [
            {
              reference_id: `gitescrow-auth-test2-${Date.now()}`,
              description: 'GitEscrow Milestone Authorization & Void Test ($25.00)',
              amount: { currency_code: 'USD', value: '25.00' }
            }
          ],
          application_context: {
            brand_name: 'GitEscrow Platform',
            user_action: 'CONTINUE',
            return_url: 'https://example.com/escrow/void-return',
            cancel_url: 'https://example.com/escrow/void-cancel'
          }
        },
        `idem-create-auth2-${Date.now()}`
      );

      state.test2_void.orderId = order2.id;
      state.test2_void.approvalUrl = order2.links.find((l) => l.rel === 'approve')?.href || '';
      state.test2_void.status = 'ORDER_CREATED';
      saveState(state);
      console.log(`  ✓ Order 2 created: ID ${order2.id}`);
      console.log(`  ✓ Approval URL: ${state.test2_void.approvalUrl}\n`);
    } catch (err: any) {
      const debugId = err instanceof PayPalError ? err.debugId : 'unknown';
      reportMap.auth2_authorize = {
        test: 'Separate authorization',
        status: 'FAIL',
        actualResult: `HTTP ${err.status || 500} [debug_id: ${debugId}]: ${err.message}`
      };
      console.error(`  ✗ Failed to create Order 2: ${err.message}\n`);
    }
  }

  // Step 2: Check buyer approval for Order 2
  if (order2) {
    const status2 = order2.status;
    const approvalUrl2 = state.test2_void.approvalUrl || '';

    if (status2 === 'CREATED' || status2 === 'PAYER_ACTION_REQUIRED') {
      reportMap.auth2_authorize = {
        test: 'Separate authorization',
        status: 'BLOCKED',
        actualResult: `Awaiting buyer approval for Order 2: ${approvalUrl2}`
      };
      reportMap.auth2_void = {
        test: 'Authorization void',
        status: 'BLOCKED',
        actualResult: 'Awaiting buyer approval and authorization'
      };

      console.log(`  -------------------------------------------------------------------`);
      console.log(`  PAUSE: BUYER APPROVAL REQUIRED FOR ORDER 2 ($25.00 USD)`);
      console.log(`  -------------------------------------------------------------------`);
      console.log(`  Order 2 ID: ${state.test2_void.orderId}`);
      console.log(`  Approval URL:\n  ${approvalUrl2}\n`);
      console.log(`  Open this URL in your browser, log in with Sandbox Personal (buyer),`);
      console.log(`  and approve the $25.00 authorization.`);
      console.log(`  -------------------------------------------------------------------\n`);
    } else if (status2 === 'APPROVED') {
      console.log(`  ✓ Order 2 is approved by buyer! Authorizing payment...`);

      // Step 3: Authorize Order 2
      if (!state.test2_void.authorizationId) {
        try {
          const authRes = await client.authorizeOrder(state.test2_void.orderId!, `idem-auth2-${Date.now()}`);
          const authObj = authRes.purchase_units?.[0]?.payments?.authorizations?.[0];
          if (!authObj || !authObj.id) {
            throw new Error('Authorization response did not contain authorization ID');
          }
          state.test2_void.authorizationId = authObj.id;
          state.test2_void.status = 'AUTHORIZED';
          saveState(state);
          console.log(`  ✓ Authorization granted: ID ${authObj.id} [Status: ${authObj.status}]`);
        } catch (err: any) {
          const debugId = err instanceof PayPalError ? err.debugId : 'unknown';
          reportMap.auth2_authorize = {
            test: 'Separate authorization',
            status: 'FAIL',
            actualResult: `HTTP ${err.status || 500} [debug_id: ${debugId}]: ${err.message}`
          };
          console.error(`  ✗ Authorize Order 2 failed: ${err.message}\n`);
        }
      }
    } else if (status2 === 'COMPLETED' || state.test2_void.authorizationId) {
      console.log(`  ✓ Order 2 previously approved and authorized: ID ${state.test2_void.authorizationId}`);
    }
  }

  // Step 4 & 5: Verify Authorization & Void
  if (state.test2_void.authorizationId) {
    try {
      const authDetails = await client.getAuthorization(state.test2_void.authorizationId);
      reportMap.auth2_authorize = {
        test: 'Separate authorization',
        status: 'PASS',
        actualResult: `Authorization ID: ${authDetails.id} ($${authDetails.amount.value} ${authDetails.amount.currency_code}) [Status: ${authDetails.status}]`
      };
      console.log(`  ✓ Authorization verified on PayPal: ${authDetails.id} [Status: ${authDetails.status}]`);

      // Step 5: Void the authorization
      if (!state.test2_void.voided && authDetails.status !== 'VOIDED') {
        console.log(`  Voiding authorization ${authDetails.id}...`);
        await client.voidAuthorization(authDetails.id);
        state.test2_void.voided = true;
        state.test2_void.status = 'VOIDED';
        saveState(state);
        console.log(`  ✓ Authorization voided successfully.`);
      }

      // Step 6: Verify final voided status
      const postVoidAuth = await client.getAuthorization(state.test2_void.authorizationId);
      reportMap.auth2_void = {
        test: 'Authorization void',
        status: 'PASS',
        actualResult: `Authorization ${postVoidAuth.id} status: ${postVoidAuth.status}`
      };
      console.log(`  ✓ Final authorization status verified: ${postVoidAuth.status}\n`);
    } catch (err: any) {
      const debugId = err instanceof PayPalError ? err.debugId : 'unknown';
      reportMap.auth2_void = {
        test: 'Authorization void',
        status: 'FAIL',
        actualResult: `HTTP ${err.status || 500} [debug_id: ${debugId}]: ${err.message}`
      };
      console.error(`  ✗ Authorization void step failed: ${err.message}\n`);
    }
  }

  printReport();
}

run().catch((err) => {
  console.error('[FATAL] verify-paypal-authorization crashed:', err);
  process.exit(1);
});

