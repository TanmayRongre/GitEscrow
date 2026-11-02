/**
 * GitEscrow - Task 2A Comprehensive Authentication, User Management & RBAC Automated Test Suite
 *
 * Verifies:
 *   A. User Registration (valid, duplicates, validation, role injection prevention)
 *   B. User Login (credentials, anti-enumeration, account status, rate limiting)
 *   C. JWT & Auth Middleware (valid token, expired token, signature tampering, malformed headers)
 *   D. Refresh Token Rotation & Token Family Reuse Detection
 *   E. Role-Based Access Control (Global ADMIN vs USER, Org OWNER vs MEMBER, tenant isolation)
 *   F. Organization Management (creation, listing, member addition, slug uniqueness, ownership transfer)
 *   G. One-Time Secure Admin Bootstrap Mechanism & Permanent Lockout
 */

import http from 'http';
import path from 'path';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

// Ensure test environment
process.env.NODE_ENV = 'test';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Fallback secrets for local testing if not loaded from .env
if (!process.env.JWT_ACCESS_SECRET) {
  process.env.JWT_ACCESS_SECRET = 'gitescrow_test_jwt_access_secret_32bytes_min';
}
if (!process.env.JWT_REFRESH_SECRET) {
  process.env.JWT_REFRESH_SECRET = 'gitescrow_test_jwt_refresh_secret_32bytes_min';
}
if (!process.env.ADMIN_SETUP_SECRET) {
  process.env.ADMIN_SETUP_SECRET = 'gitescrow_test_admin_bootstrap_secret_2026';
}

import app, { connectDB } from '../src/index';
import { User } from '../src/models/User';
import { Organization } from '../src/models/Organization';
import { RefreshToken } from '../src/models/RefreshToken';

interface TestResult {
  category: string;
  name: string;
  expectedStatus: number;
  actualStatus: number;
  passed: boolean;
  notes: string;
}

const results: TestResult[] = [];
// Short 7-char prefix ensuring all usernames remain well within 3-30 chars constraint
const RUN_ID = 't' + Math.random().toString(36).substring(2, 8);

function record(category: string, name: string, expectedStatus: number, actualStatus: number, passed: boolean, notes: string) {
  results.push({ category, name, expectedStatus, actualStatus, passed, notes });
  const icon = passed ? '✓ PASS' : '✗ FAIL';
  console.log(`  ${icon} [${category}] ${name} (Expected: ${expectedStatus}, Actual: ${actualStatus}) - ${notes}`);
}

function extractCookie(res: Response, cookieName: string): string | null {
  const headers = res.headers as any;
  const rawCookies: string[] = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : [res.headers.get('set-cookie')].filter(Boolean);

  for (const c of rawCookies) {
    const match = c.match(new RegExp(`(?:^|;\\s*)${cookieName}=([^;]+)`));
    if (match) return match[1];
  }
  return null;
}

async function cleanupTestData() {
  try {
    const userFilter = {
      $or: [
        { email: { $regex: new RegExp(`^${RUN_ID}`) } },
        { username: { $regex: new RegExp(`^${RUN_ID}`) } },
        { email: { $regex: /^t[a-z0-9]{4,8}_/ } },
        { username: { $regex: /^t[a-z0-9]{4,8}_/ } },
        { email: { $regex: /^test_auth_/ } },
        { username: { $regex: /^test_auth_/ } }
      ]
    };
    const testUsers = await User.find(userFilter);
    const testUserIds = testUsers.map((u) => u._id);

    await RefreshToken.deleteMany({ userId: { $in: testUserIds } });
    await Organization.deleteMany({
      $or: [
        { slug: { $regex: new RegExp(`^${RUN_ID}`) } },
        { slug: { $regex: /^t[a-z0-9]{4,8}-/ } },
        { slug: { $regex: /^test-auth-/ } }
      ]
    });
    await User.deleteMany(userFilter);
  } catch (err: any) {
    console.warn(`[Cleanup Warning] Non-fatal cleanup issue: ${err.message}`);
  }
}

async function run() {
  console.log(`\n======================================================================`);
  console.log(`  GitEscrow - Task 2A Authentication & RBAC Automated Test Suite`);
  console.log(`  Run ID: ${RUN_ID}`);
  console.log(`  Testing: Registration, Login, JWT, Refresh Rotation, RBAC, Orgs, Admin`);
  console.log(`======================================================================\n`);

  // Connect to database
  await connectDB();
  await cleanupTestData();

  // Start ephemeral HTTP server on random free port
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind ephemeral test server');
  }
  const port = address.port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Ephemeral test server active on ${baseUrl}...\n`);

  try {
    // -------------------------------------------------------------
    // Category A: Registration Tests
    // -------------------------------------------------------------
    console.log(`--- [Category A: User Registration Tests] ---`);

    const validUserPayload = {
      name: 'Alice Developer',
      username: `${RUN_ID}_alice`,
      email: `${RUN_ID}_alice@example.com`,
      password: 'SecurePassword123!'
    };

    // A1: Valid Registration
    const regRes1 = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validUserPayload)
    });
    const regBody1 = (await regRes1.json()) as any;
    const regRefreshToken1 = extractCookie(regRes1, 'refresh_token') || extractCookie(regRes1, 'refreshToken');

    const a1Pass =
      regRes1.status === 201 &&
      regBody1.user?.email === validUserPayload.email &&
      regBody1.user?.passwordHash === undefined &&
      typeof regBody1.accessToken === 'string' &&
      Boolean(regRefreshToken1);

    record(
      'Registration',
      'Valid registration returns 201, access token, and HttpOnly refresh cookie',
      201,
      regRes1.status,
      a1Pass,
      `User created: @${regBody1.user?.username}, passwordHash omitted, refresh cookie set`
    );

    // A2: Duplicate Email
    const regRes2 = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validUserPayload,
        username: `${RUN_ID}_alice2` // different username, same email
      })
    });
    const regBody2 = (await regRes2.json()) as any;
    record(
      'Registration',
      'Duplicate email is rejected with 409 Conflict',
      409,
      regRes2.status,
      regRes2.status === 409 && regBody2.code === 'EMAIL_EXISTS',
      `Duplicate email correctly blocked (${regBody2.error})`
    );

    // A3: Duplicate Username
    const regRes3 = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validUserPayload,
        email: `${RUN_ID}_different@example.com` // different email, same username
      })
    });
    const regBody3 = (await regRes3.json()) as any;
    record(
      'Registration',
      'Duplicate username is rejected with 409 Conflict',
      409,
      regRes3.status,
      regRes3.status === 409 && regBody3.code === 'USERNAME_TAKEN',
      `Duplicate username correctly blocked (${regBody3.error})`
    );

    // A4: Invalid Email Format
    const regRes4 = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bob Dev',
        username: `${RUN_ID}_bob`,
        email: 'invalid-email-string',
        password: 'ValidPassword123!'
      })
    });
    record(
      'Registration',
      'Invalid email format is rejected with 400 Bad Request',
      400,
      regRes4.status,
      regRes4.status === 400,
      'Zod validation rejected malformed email address'
    );

    // A5: Password Too Short (< 8 chars)
    const regRes5 = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Charlie Dev',
        username: `${RUN_ID}_charlie`,
        email: `${RUN_ID}_charlie@example.com`,
        password: 'short'
      })
    });
    record(
      'Registration',
      'Password shorter than 8 characters is rejected with 400 Bad Request',
      400,
      regRes5.status,
      regRes5.status === 400,
      'Zod validation rejected password < 8 characters'
    );

    // A6: Role Escalation Prevention (attempt to inject role: 'ADMIN')
    const regRes6 = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Escalation Attacker',
        username: `${RUN_ID}_atk`,
        email: `${RUN_ID}_atk@example.com`,
        password: 'AttackerPassword123!',
        role: 'ADMIN' // Injected role attempt
      })
    });
    const regBody6 = (await regRes6.json()) as any;
    const dbUser6 = await User.findOne({ email: `${RUN_ID}_atk@example.com` });
    const a6Pass =
      regRes6.status === 201 &&
      regBody6.user?.role === 'USER' &&
      dbUser6?.role === 'USER';

    record(
      'Registration',
      'Role escalation attempt is ignored and forced to USER in response and DB',
      201,
      regRes6.status,
      a6Pass,
      `Injected ADMIN role suppressed; database persisted role is: ${dbUser6?.role}`
    );

    // -------------------------------------------------------------
    // Category B: Login Tests
    // -------------------------------------------------------------
    console.log(`\n--- [Category B: User Login Tests] ---`);

    // B1: Valid Login
    const loginRes1 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: validUserPayload.email,
        password: validUserPayload.password
      })
    });
    const loginBody1 = (await loginRes1.json()) as any;
    const loginRefreshToken1 = extractCookie(loginRes1, 'refresh_token') || extractCookie(loginRes1, 'refreshToken');

    const b1Pass =
      loginRes1.status === 200 &&
      loginBody1.user?.email === validUserPayload.email &&
      typeof loginBody1.accessToken === 'string' &&
      Boolean(loginRefreshToken1);

    record(
      'Login',
      'Valid login returns 200, user profile, access token, and refresh cookie',
      200,
      loginRes1.status,
      b1Pass,
      `Authenticated @${loginBody1.user?.username} with valid JWT access token`
    );

    // B2: Invalid Password
    const loginRes2 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: validUserPayload.email,
        password: 'IncorrectPassword999!'
      })
    });
    const loginBody2 = (await loginRes2.json()) as any;
    record(
      'Login',
      'Invalid password returns 401 Unauthorized with generic message',
      401,
      loginRes2.status,
      loginRes2.status === 401 && loginBody2.code === 'INVALID_CREDENTIALS',
      `Rejected with error: "${loginBody2.error}"`
    );

    // B3: Non-existent User (Anti-Enumeration Verification)
    const loginRes3 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `nonexistent_${RUN_ID}@example.com`,
        password: 'SomePassword123!'
      })
    });
    const loginBody3 = (await loginRes3.json()) as any;
    const antiEnumerationMatch =
      loginRes3.status === 401 &&
      loginBody3.error === loginBody2.error &&
      loginBody3.code === loginBody2.code;

    record(
      'Login',
      'Non-existent user returns EXACT SAME 401 message (anti-enumeration check)',
      401,
      loginRes3.status,
      antiEnumerationMatch,
      `Identical generic response ("${loginBody3.error}") prevents email probing`
    );

    // B4: Suspended Account Login
    await User.updateOne({ email: validUserPayload.email }, { accountStatus: 'SUSPENDED' });
    const loginRes4 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: validUserPayload.email,
        password: validUserPayload.password
      })
    });
    const loginBody4 = (await loginRes4.json()) as any;
    // Restore account status
    await User.updateOne({ email: validUserPayload.email }, { accountStatus: 'ACTIVE' });

    record(
      'Login',
      'Suspended account login is rejected with 403 Forbidden',
      403,
      loginRes4.status,
      loginRes4.status === 403 && loginBody4.code === 'ACCOUNT_SUSPENDED',
      `Suspended account blocked with: "${loginBody4.error}"`
    );

    // B5: Rate Limiting Verification (Real HTTP requests)
    await fetch(`${baseUrl}/api/auth/test-rate-limit`); // req 1: ok
    await fetch(`${baseUrl}/api/auth/test-rate-limit`); // req 2: ok
    const rlRes3 = await fetch(`${baseUrl}/api/auth/test-rate-limit`); // req 3: should be 429
    record(
      'Login',
      'Rate limiter responds with 429 Too Many Requests upon exceeding threshold',
      429,
      rlRes3.status,
      rlRes3.status === 429,
      'Express rate limiter returns HTTP 429 on abuse'
    );

    // -------------------------------------------------------------
    // Category C: JWT & Auth Middleware Tests
    // -------------------------------------------------------------
    console.log(`\n--- [Category C: JWT & Auth Middleware Tests] ---`);

    const validAccessToken = loginBody1.accessToken;

    // C1: Protected route with valid token
    const jwtRes1 = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${validAccessToken}` }
    });
    const jwtBody1 = (await jwtRes1.json()) as any;
    record(
      'JWT & Middleware',
      'Valid JWT access token in Authorization header returns 200 OK',
      200,
      jwtRes1.status,
      jwtRes1.status === 200 && jwtBody1.user?.email === validUserPayload.email,
      `Resolved authenticated user: @${jwtBody1.user?.username}`
    );

    // C2: Expired access token
    const expiredToken = jwt.sign(
      { sub: loginBody1.user.id, email: validUserPayload.email, role: 'USER' },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: '-10s' }
    );
    const jwtRes2 = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${expiredToken}` }
    });
    record(
      'JWT & Middleware',
      'Expired access token returns 401 Unauthorized',
      401,
      jwtRes2.status,
      jwtRes2.status === 401,
      'JWT expiration verified and rejected'
    );

    // C3: Tampered signature / invalid secret
    const tamperedToken = jwt.sign(
      { sub: loginBody1.user.id, email: validUserPayload.email, role: 'USER' },
      'wrong_secret_signature_key',
      { expiresIn: '15m' }
    );
    const jwtRes3 = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${tamperedToken}` }
    });
    record(
      'JWT & Middleware',
      'Token with tampered/invalid signature returns 401 Unauthorized',
      401,
      jwtRes3.status,
      jwtRes3.status === 401,
      'Invalid signature rejected by verifyAccessToken'
    );

    // C4: Missing Authorization header
    const jwtRes4 = await fetch(`${baseUrl}/api/auth/me`);
    record(
      'JWT & Middleware',
      'Missing Authorization header and cookies returns 401 Unauthorized',
      401,
      jwtRes4.status,
      jwtRes4.status === 401,
      'Unauthenticated request blocked'
    );

    // C5: Malformed Authorization header
    const jwtRes5 = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: 'Basic dXNlcjpwYXNz' }
    });
    record(
      'JWT & Middleware',
      'Malformed Authorization scheme (e.g. Basic instead of Bearer) returns 401',
      401,
      jwtRes5.status,
      jwtRes5.status === 401,
      'Non-Bearer authorization scheme rejected'
    );

    // -------------------------------------------------------------
    // Category D: Refresh Token Rotation & Reuse Detection Tests
    // -------------------------------------------------------------
    console.log(`\n--- [Category D: Refresh Token Rotation & Family Reuse Detection] ---`);

    // D1: Valid refresh token rotation
    const refreshRes1 = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `refresh_token=${loginRefreshToken1}; refreshToken=${loginRefreshToken1}`
      },
      body: JSON.stringify({ refreshToken: loginRefreshToken1 })
    });
    const refreshBody1 = (await refreshRes1.json()) as any;
    const rotatedRefreshToken = extractCookie(refreshRes1, 'refresh_token') || extractCookie(refreshRes1, 'refreshToken') || refreshBody1.refreshToken;

    const d1Pass =
      refreshRes1.status === 200 &&
      typeof refreshBody1.accessToken === 'string' &&
      Boolean(rotatedRefreshToken) &&
      rotatedRefreshToken !== loginRefreshToken1;

    record(
      'Token Rotation',
      'Valid refresh token issues new access token AND new rotated refresh token',
      200,
      refreshRes1.status,
      d1Pass,
      `Rotated refresh token verified (Old: ${loginRefreshToken1?.slice(0, 8)}..., New: ${rotatedRefreshToken?.slice(0, 8)}...)`
    );

    // D2: Replaying the PREVIOUS (now invalidated) refresh token -> REUSE DETECTION
    const reuseRes = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `refresh_token=${loginRefreshToken1}; refreshToken=${loginRefreshToken1}`
      },
      body: JSON.stringify({ refreshToken: loginRefreshToken1 })
    });
    const reuseBody = (await reuseRes.json()) as any;

    // Verify token family was completely invalidated in database
    const decodedRefresh = jwt.decode(loginRefreshToken1 || '') as any;
    const familyTokensInDb = await RefreshToken.find({ familyId: decodedRefresh?.familyId });
    const allFamilyRevoked = familyTokensInDb.length > 0 && familyTokensInDb.every((t) => Boolean(t.revokedAt));

    const d2Pass =
      (reuseRes.status === 401 || reuseRes.status === 403) &&
      reuseBody.code === 'TOKEN_REUSE_DETECTED' &&
      allFamilyRevoked;

    record(
      'Token Rotation',
      'Token reuse detected: immediately revokes entire token family',
      401,
      reuseRes.status,
      d2Pass,
      `Reuse caught! Code: ${reuseBody.code}, all family tokens revoked in DB`
    );

    // D3: Expired refresh token
    const expiredRefreshToken = jwt.sign(
      { sub: loginBody1.user.id, jti: 'test-jti', familyId: 'test-fam' },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: '-10s' }
    );
    const refreshRes3 = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: expiredRefreshToken })
    });
    record(
      'Token Rotation',
      'Expired refresh token returns 401 Unauthorized',
      401,
      refreshRes3.status,
      refreshRes3.status === 401,
      'Expired refresh token rejected'
    );

    // -------------------------------------------------------------
    // Category E: Role-Based Access Control (RBAC) Tests
    // -------------------------------------------------------------
    console.log(`\n--- [Category E: Role-Based Access Control (RBAC) Tests] ---`);

    // Create a regular user and an admin user for RBAC verification
    const standardUserPayload = {
      name: 'Standard User',
      username: `${RUN_ID}_std`,
      email: `${RUN_ID}_std@example.com`,
      password: 'StandardUserPassword123!'
    };
    const regStd = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(standardUserPayload)
    });
    const stdData = (await regStd.json()) as any;
    const stdToken = stdData.accessToken;

    // Create admin user directly in DB
    const adminUser = await User.create({
      name: 'Global Administrator',
      username: `${RUN_ID}_adm`,
      email: `${RUN_ID}_adm@example.com`,
      passwordHash: '$2a$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
      role: 'ADMIN',
      accountStatus: 'ACTIVE',
      emailVerified: true
    });
    const adminToken = jwt.sign(
      { sub: adminUser._id.toString(), email: adminUser.email, username: adminUser.username, role: 'ADMIN' },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: '15m' }
    );

    // E1: Standard USER accessing GET /api/admin/test -> 403 Forbidden
    const rbacRes1 = await fetch(`${baseUrl}/api/admin/test`, {
      headers: { Authorization: `Bearer ${stdToken}` }
    });
    record(
      'RBAC',
      'User with role USER accessing GET /api/admin/test returns 403 Forbidden',
      403,
      rbacRes1.status,
      rbacRes1.status === 403,
      'Non-admin globally blocked by requireGlobalRole("ADMIN")'
    );

    // E2: ADMIN accessing GET /api/admin/test -> 200 OK
    const rbacRes2 = await fetch(`${baseUrl}/api/admin/test`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const rbacBody2 = (await rbacRes2.json()) as any;
    record(
      'RBAC',
      'User with role ADMIN accessing GET /api/admin/test returns 200 OK',
      200,
      rbacRes2.status,
      rbacRes2.status === 200 && rbacBody2.admin?.role === 'ADMIN',
      `Admin access granted: "${rbacBody2.message}"`
    );

    // Create a secondary user to test Org RBAC
    const memberUserPayload = {
      name: 'Org Member',
      username: `${RUN_ID}_mem`,
      email: `${RUN_ID}_mem@example.com`,
      password: 'MemberPassword123!'
    };
    const regMember = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(memberUserPayload)
    });
    const memberData = (await regMember.json()) as any;
    const memberToken = memberData.accessToken;
    const memberUserId = memberData.user.id;

    // Create third user (stranger, not in org)
    const strangerPayload = {
      name: 'Stranger User',
      username: `${RUN_ID}_str`,
      email: `${RUN_ID}_str@example.com`,
      password: 'StrangerPassword123!'
    };
    const regStranger = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(strangerPayload)
    });
    const strangerData = (await regStranger.json()) as any;
    const strangerToken = strangerData.accessToken;

    // Std user creates organization -> is OWNER
    const orgCreateRes = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${stdToken}`
      },
      body: JSON.stringify({
        name: 'GitEscrow Core Team',
        slug: `${RUN_ID}-core-org`
      })
    });
    const orgCreateBody = (await orgCreateRes.json()) as any;
    const orgId = orgCreateBody.organization._id || orgCreateBody.organization.id;

    // Add memberUser as role 'MEMBER'
    await fetch(`${baseUrl}/api/organizations/${orgId}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${stdToken}`
      },
      body: JSON.stringify({
        userId: memberUserId,
        role: 'MEMBER'
      })
    });

    // E3: MEMBER attempting to add another member -> 403 Forbidden
    const rbacRes3 = await fetch(`${baseUrl}/api/organizations/${orgId}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberToken}`
      },
      body: JSON.stringify({
        userId: strangerData.user.id,
        role: 'MEMBER'
      })
    });
    record(
      'RBAC',
      'Organization MEMBER attempting OWNER/SPONSOR action returns 403 Forbidden',
      403,
      rbacRes3.status,
      rbacRes3.status === 403,
      'Member disallowed from managing organization members'
    );

    // E4: OWNER adding another member -> 200 OK
    const rbacRes4 = await fetch(`${baseUrl}/api/organizations/${orgId}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${stdToken}`
      },
      body: JSON.stringify({
        userId: strangerData.user.id,
        role: 'SPONSOR'
      })
    });
    record(
      'RBAC',
      'Organization OWNER adding a member returns 200 OK',
      200,
      rbacRes4.status,
      rbacRes4.status === 200,
      'Owner successfully added new member with role SPONSOR'
    );

    // E5: User not in org attempting org-scoped action -> 403 Forbidden
    const outsiderPayload = {
      name: 'Outsider User',
      username: `${RUN_ID}_out`,
      email: `${RUN_ID}_out@example.com`,
      password: 'OutsiderPassword123!'
    };
    const regOutsider = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(outsiderPayload)
    });
    const outsiderData = (await regOutsider.json()) as any;
    const outsiderToken = outsiderData.accessToken;

    const rbacRes5 = await fetch(`${baseUrl}/api/organizations/${orgId}`, {
      headers: { Authorization: `Bearer ${outsiderToken}` }
    });
    record(
      'RBAC',
      'User not belonging to organization is rejected with 403 Forbidden',
      403,
      rbacRes5.status,
      rbacRes5.status === 403,
      'Cross-organization tenant isolation verified'
    );

    // -------------------------------------------------------------
    // Category F: Organization Management Tests
    // -------------------------------------------------------------
    console.log(`\n--- [Category F: Organization Management Tests] ---`);

    // F1: Create organization assigns creator as OWNER
    const f1Pass =
      orgCreateRes.status === 201 &&
      orgCreateBody.organization.members.some(
        (m: any) => m.userId.toString() === stdData.user.id && m.role === 'OWNER'
      );
    record(
      'Organization',
      'Create organization sets creator as OWNER and returns 201',
      201,
      orgCreateRes.status,
      f1Pass,
      `Org "${orgCreateBody.organization.name}" created with creator as OWNER`
    );

    // F2: List user organizations
    const listRes = await fetch(`${baseUrl}/api/organizations`, {
      headers: { Authorization: `Bearer ${stdToken}` }
    });
    const listBody = (await listRes.json()) as any;
    const foundCreatedOrg = listBody.organizations?.some((o: any) => o._id === orgId || o.id === orgId);
    record(
      'Organization',
      'GET /api/organizations returns all organizations the user belongs to',
      200,
      listRes.status,
      listRes.status === 200 && foundCreatedOrg,
      `User belongs to ${listBody.organizations?.length} organization(s)`
    );

    // F3: Duplicate org slug rejected
    const dupSlugRes = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${stdToken}`
      },
      body: JSON.stringify({
        name: 'Duplicate Org Name',
        slug: `${RUN_ID}-core-org` // Identical slug
      })
    });
    record(
      'Organization',
      'Duplicate organization slug returns 409 Conflict',
      409,
      dupSlugRes.status,
      dupSlugRes.status === 409,
      'Unique slug constraint enforced'
    );

    // F4: Transfer ownership (Original owner becomes SPONSOR, new user becomes OWNER)
    const transferRes = await fetch(`${baseUrl}/api/organizations/${orgId}/members/${memberUserId}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${stdToken}`
      },
      body: JSON.stringify({ role: 'OWNER' })
    });
    const transferBody = (await transferRes.json()) as any;

    const newOwnerMember = transferBody.organization?.members?.find((m: any) => m.userId.toString() === memberUserId);
    const oldOwnerMember = transferBody.organization?.members?.find((m: any) => m.userId.toString() === stdData.user.id);

    const f4Pass =
      transferRes.status === 200 &&
      transferBody.organization?.ownerId === memberUserId &&
      newOwnerMember?.role === 'OWNER' &&
      oldOwnerMember?.role === 'SPONSOR';

    record(
      'Organization',
      'Transfer ownership updates primary ownerId, new owner to OWNER, prior owner to SPONSOR',
      200,
      transferRes.status,
      f4Pass,
      `New owner: ${newOwnerMember?.userId} (OWNER), Previous owner: ${oldOwnerMember?.userId} (${oldOwnerMember?.role})`
    );

    // -------------------------------------------------------------
    // Category G: Admin Bootstrap Tests
    // -------------------------------------------------------------
    console.log(`\n--- [Category G: Admin Bootstrap Tests] ---`);

    // Temporarily clean up any test admin accounts to test pristine bootstrap
    await User.deleteMany({ role: 'ADMIN' });

    // G1: Invalid setup secret returns 403
    const bootRes1 = await fetch(`${baseUrl}/api/auth/bootstrap-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        setupSecret: 'invalid_secret_key_123',
        name: 'Boot Admin',
        username: `${RUN_ID}_bta`,
        email: `${RUN_ID}_bta@example.com`,
        password: 'AdminSuperPassword123!'
      })
    });
    record(
      'Admin Bootstrap',
      'Invalid ADMIN_SETUP_SECRET returns 403 Forbidden',
      403,
      bootRes1.status,
      bootRes1.status === 403,
      'Bootstrap rejected without valid setup secret'
    );

    // G2: Valid setup secret creates first admin user
    const bootRes2 = await fetch(`${baseUrl}/api/auth/bootstrap-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        setupSecret: process.env.ADMIN_SETUP_SECRET!,
        name: 'Root Administrator',
        username: `${RUN_ID}_rta`,
        email: `${RUN_ID}_rta@example.com`,
        password: 'AdminSuperPassword123!'
      })
    });
    const bootBody2 = (await bootRes2.json()) as any;
    const g2Pass =
      bootRes2.status === 201 &&
      bootBody2.user?.role === 'ADMIN' &&
      typeof bootBody2.accessToken === 'string';

    record(
      'Admin Bootstrap',
      'Valid ADMIN_SETUP_SECRET bootstraps initial ADMIN user and returns 201',
      201,
      bootRes2.status,
      g2Pass,
      `Admin @${bootBody2.user?.username} created with role ${bootBody2.user?.role}`
    );

    // G3: Second bootstrap attempt after admin exists returns 409 Conflict (permanently locked)
    const bootRes3 = await fetch(`${baseUrl}/api/auth/bootstrap-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        setupSecret: process.env.ADMIN_SETUP_SECRET!,
        name: 'Second Admin Attempter',
        username: `${RUN_ID}_2nd`,
        email: `${RUN_ID}_2nd@example.com`,
        password: 'AdminSuperPassword123!'
      })
    });
    const bootBody3 = (await bootRes3.json()) as any;
    record(
      'Admin Bootstrap',
      'Second bootstrap attempt returns 409 Conflict (permanently locked)',
      409,
      bootRes3.status,
      bootRes3.status === 409 && bootBody3.code === 'ADMIN_ALREADY_EXISTS',
      `Endpoint permanently locked: "${bootBody3.error}"`
    );

  } finally {
    // Teardown ephemeral server and clean up test data
    server.close();
    await cleanupTestData();
    await mongoose.disconnect();
    console.log(`\nEphemeral test server stopped. Test data safely cleaned up.\n`);
  }

  // -------------------------------------------------------------
  // Test Results Report
  // -------------------------------------------------------------
  console.log(`========================================================================================================`);
  console.log(`                      TASK 2A: AUTHENTICATION & RBAC AUTOMATED TEST REPORT                              `);
  console.log(`========================================================================================================`);
  console.log(`Category | Test Name | Status | Notes`);
  console.log(`---|---|---|---`);
  for (const r of results) {
    console.log(`${r.category} | ${r.name} | ${r.passed ? 'PASS' : 'FAIL'} | ${r.notes}`);
  }
  console.log(`========================================================================================================`);

  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  console.log(`\nTotal Tests: ${totalCount} | Passed: ${passedCount} | Failed: ${totalCount - passedCount}`);

  if (passedCount !== totalCount) {
    console.error(`\n❌ Test suite failed with ${totalCount - passedCount} failing tests.\n`);
    process.exit(1);
  } else {
    console.log(`\n✓ All ${totalCount} authentication & RBAC tests passed successfully!\n`);
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
