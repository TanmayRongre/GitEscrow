# GitEscrow

> Trustless, milestone-based escrow platform for open-source GitHub bounties powered by PayPal, developed for the **PayPal AI Hackathon 2026**.

GitEscrow establishes an audited, milestone-based escrow lifecycle connecting sponsors, maintainers, and open-source contributors:

- **Sponsor Funds Bounty**: Sponsor creates a bounty linked to a verified GitHub issue. Funding is handled via PayPal Orders v2 (captured for platform escrow or authorized for short milestone holds).
- **AI-Powered Issue Analysis (Task 2B.2)**: Automatically deconstructs real GitHub issues into structured problem summaries, technical dependencies, logical phased milestones, and measurable acceptance criteria with integer-cent reward distribution.
- **Sponsor Review & Authority**: AI output is strictly consultative. Sponsors review, edit, and explicitly approve milestones before saving or publishing. AI never captures funds, executes payouts, or approves payments.
- **Contributor Solves Issue**: Contributor claims the issue, works on the implementation, and submits a pull request reference.
- **Audited Milestones & Release**: Sponsors inspect deliverables against predefined criteria and approve milestones, recording immutable audit events in an append-only ledger.
- **Identity & RBAC (Task 2A)**: Full authentication layer with JWT access tokens, rotating HttpOnly refresh cookies with token reuse family invalidation, global roles (`USER`, `ADMIN`), and organization roles (`OWNER`, `SPONSOR`, `MEMBER`).
- **Bounties, Milestones & Escrow Ledger (Task 2B.1)**: Atomic state machine, fractional milestone breakdown with integer-cent accuracy, live GitHub issue validation, and an append-only financial audit ledger.
- **Hallmark Modern-Minimal UI & GSAP Motion**: Polished developer-tool interface built with React 19, Tailwind CSS, Hallmark centralized OKLCH tokens (`tokens.css`), and GSAP lifecycle-safe transforms.

---

## 1. Architecture & System Overview

```text
GitEscrow (Monorepo)
├── client/                           # Frontend (React 19, Vite, TypeScript, Tailwind CSS, GSAP)
│   ├── src/
│   │   ├── api/client.ts             # Credentialed API client with automatic session restoration
│   │   ├── context/AuthContext.tsx   # React Auth context and hook (useAuth)
│   │   ├── motion/
│   │   │   ├── gsapSetup.ts          # Centralized GSAP plugin registration and motion tokens
│   │   │   └── transitions.ts        # Lifecycle-safe animations and reduced-motion fallback
│   │   ├── types/
│   │   │   ├── bounty.ts             # TypeScript interfaces for Bounties, Milestones, Ledger
│   │   │   └── ai.ts                 # TypeScript interfaces for AI Issue Analysis & Proposals
│   │   ├── components/
│   │   │   ├── BountyList.tsx        # Public marketplace view with status filter pills & search
│   │   │   ├── BountyDetails.tsx     # Full bounty view with milestone timeline, tabs, and actions
│   │   │   ├── CreateBountyForm.tsx  # Dynamic milestone builder with AI Assistant integration
│   │   │   ├── AIAnalysisReviewModal.tsx # Hallmark-styled sponsor review & approval modal
│   │   │   ├── LoginForm.tsx         # User authentication form
│   │   │   ├── RegisterForm.tsx      # Developer registration form
│   │   │   ├── UserProfile.tsx       # Profile management, RBAC verification, and org manager
│   │   │   └── ProtectedRoute.tsx    # Role-gated route component
│   │   ├── App.tsx                   # Main React component with responsive navigation
│   │   ├── tokens.css                # Hallmark centralized OKLCH design tokens
│   │   └── index.css                 # Hallmark Console modern-minimal design rules
│   ├── package.json
│   └── vite.config.ts
├── server/                           # Backend API & Ledger (Node.js, Express, TypeScript, MongoDB)
│   ├── src/
│   │   ├── index.ts                  # Express entry point with CORS, cookie-parser, and routing
│   │   ├── models/
│   │   │   ├── User.ts               # User schema (roles: USER, ADMIN; bcrypt work factor 12)
│   │   │   ├── Organization.ts       # Organization schema (roles: OWNER, SPONSOR, MEMBER)
│   │   │   ├── RefreshToken.ts       # Rotating hashed refresh tokens with family tracking & TTL
│   │   │   ├── WebhookDelivery.ts    # Webhook delivery deduplication schema
│   │   │   ├── Bounty.ts             # Bounty schema (Decimal128 amounts, GitHub issue references)
│   │   │   ├── Milestone.ts          # Milestone schema (criteria, order uniqueness, decision notes)
│   │   │   └── EscrowLedger.ts       # Append-only financial event ledger with mutation guards
│   │   ├── ai/                       # AI Analysis Subsystem (Task 2B.2)
│   │   │   ├── types.ts              # Zod schemas for request, milestones, and structured analysis
│   │   │   ├── semantic-analyzer.ts  # Deterministic semantic deconstructor & cent distributor
│   │   │   ├── client.ts             # LLM client (Gemini 2.0 / OpenAI) with prompt injection defense
│   │   │   ├── ai.service.ts         # GitHub issue ingestion, caching, and amount scaling
│   │   │   ├── ai.controller.ts      # REST controller for /api/ai/analyze-issue
│   │   │   └── ai.routes.ts          # Rate-limited, authenticated AI routes
│   │   ├── auth/
│   │   │   ├── auth.service.ts       # Registration, login, token rotation, and admin bootstrap
│   │   │   ├── auth.controller.ts    # Express controller with HttpOnly cookie handling
│   │   │   ├── auth.middleware.ts    # authenticate, requireGlobalRole, requireOrganizationRole
│   │   │   ├── auth.routes.ts        # Rate-limited auth endpoints
│   │   │   ├── auth.validation.ts    # Zod input schemas
│   │   │   ├── password.service.ts   # Bcryptjs hashing (12 work factor rounds)
│   │   │   └── token.service.ts      # JWT sign/verify, refresh rotation & reuse detection
│   │   ├── organizations/
│   │   │   ├── organization.service.ts # Org CRUD, member addition, ownership transfer
│   │   │   ├── organization.controller.ts
│   │   │   └── organization.routes.ts
│   │   ├── bounties/
│   │   │   ├── bounty.service.ts     # Bounty lifecycle, GitHub validation, race-safe acceptance
│   │   │   ├── milestone.service.ts  # Milestone CRUD, integer cent arithmetic, locked approval
│   │   │   ├── ledger.service.ts     # Append-only event writer with idempotency guards
│   │   │   ├── bounty-state.service.ts # State transition validation graph & actor permissions
│   │   │   ├── bounty.controller.ts  # REST controllers for bounties, milestones, and ledger
│   │   │   ├── bounty.routes.ts      # Express routes mounted on /api/bounties and /api/milestones
│   │   │   └── bounty.validation.ts  # Zod validation schemas
│   │   ├── paypal/
│   │   │   ├── client.ts             # Typed PayPal REST API client (OAuth2, token cache)
│   │   │   └── types.ts              # Orders v2, Payments v2, Payouts v1 types
│   │   └── github/
│   │       ├── client.ts             # Typed GitHub REST API client
│   │       ├── types.ts              # GitHub entities
│   │       ├── webhook.ts            # Timing-safe HMAC SHA-256 verifier
│   │       └── webhook-router.ts     # Express router with raw-body signature validation
│   ├── scripts/
│   │   ├── test-ai-analysis.ts       # 17-test automated suite for AI Issue Analysis (Task 2B.2)
│   │   ├── test-bounties.ts          # 34-test programmatic suite for Bounties, Milestones, Ledger
│   │   ├── test-auth.ts              # 31-test automated suite for Auth, JWT, RBAC & Orgs
│   │   ├── test-webhook-endpoint.ts  # Automated webhook signature & duplicate test suite
│   │   ├── verify-sandbox.ts         # Resumable PayPal Sandbox capture/refund verification
│   │   ├── verify-paypal-authorization.ts # PayPal Authorization & Void test suite
│   │   ├── verify-github.ts          # GitHub REST API & CI check verification script
│   │   ├── .verify-state.json        # Progress state for capture/refund (ignored by Git)
│   │   └── .verify-auth-state.json   # Progress state for authorization/void (ignored by Git)
│   ├── package.json
│   └── tsconfig.json
├── artifacts/screens/                # 22 captured browser screenshots across 11 desktop & mobile views
├── .env.example                      # Canonical environment variable template
├── .gitignore                        # Git ignore rules protecting credentials and state files
├── LICENSE                           # MIT License
├── package.json                      # Root monorepo script runner
└── README.md
```

---

## 2. AI-Powered Issue Analysis & Milestone Criteria (Task 2B.2)


### 2.1 Core Architectural Principles

1. **Real GitHub Context**: Analysis ingests real issue titles, descriptions, labels, author information, and repository metadata (e.g. `facebook/react #38090` and `#38092`).
2. **Deterministic Integer-Cent Precision**: All reward suggestions are mathematically distributed using `distributeCents()`, ensuring the sum of milestone allocations strictly matches the bounty total ($100.00, $250.00, $333.33) without rounding drift.
3. **Resilient Fallback & Zero Crash Guarantee**: When LLM keys (`GEMINI_API_KEY` / `OPENAI_API_KEY`) are omitted or network APIs encounter timeouts, the system transparently utilizes the built-in `SemanticFallbackAnalyzer`, extracting code tokens, checklists, and error stack traces directly.
4. **Prompt Injection Defense**: Untrusted issue bodies are isolated within explicit delimiters with system instructions strictly forbidding instruction overrides or security bypasses.
5. **Human-in-the-Loop Authority**: AI proposals are strictly advisory. Applying suggestions populates draft fields for sponsor review. The sponsor retains total authority to edit criteria, add or delete milestones, or reject suggestions. AI never disburses funds, executes payouts, or approves milestone deliverables.

---

## 3. PayPal Integration & Financial Integrity

GitEscrow enforces strict financial truthfulness across all payment operations. All verification scripts interact with PayPal Sandbox endpoints and maintain idempotent state.


### 3.1 Verified PayPal Capabilities

| Capability                       | PayPal API Endpoint                             | Verified State / Test Result                                      | Status   |
| ---                              | ---                                             | ---                                                               | ---      |
| **OAuth2 Client Authentication** | `POST /v1/oauth2/token`                         | Bearer token retrieved (`length: 97`, valid ~3600s)               | **PASS** |
| **Order Creation (Capture)**     | `POST /v2/checkout/orders`                      | Order `29W94452X2811371K` created ($100.00 USD)                   | **PASS** |
| **Payment Capture**              | `POST /v2/checkout/orders/{id}/capture`         | Capture `1WC064007Y4652301` ($100.00 USD)                         | **PASS** |
| **Partial Refund**               | `POST /v2/payments/captures/{id}/refund`        | Refund `40K256001X5322935` ($30.00 USD)                           | **PASS** |
| **Remaining Balance Refund**     | `POST /v2/payments/captures/{id}/refund`        | Refund `4G764159WU686171M` ($70.00 USD)                           | **PASS** |
| **Order Creation (Authorize)**   | `POST /v2/checkout/orders`                      | Orders created with `intent: AUTHORIZE` ($50.00 and $25.00)       | **PASS** |
| **Authorization & Capture**      | `POST /v2/payments/authorizations/{id}/capture` | Auth `8K6263744E3078422` captured via Capture `58U5059383320752U` | **PASS** |
| **Authorization Void**           | `POST /v2/payments/authorizations/{id}/void`    | Auth `0DF88378NN3582943` voided with status `VOIDED`              | **PASS** |
| **Payouts API Scope & Auth**     | `GET /v1/payments/payouts/{id}`                 | Endpoint authenticated, OAuth scope recognized                    | **PASS** |


### 3.2 Payout Execution Limitation Notice

> [!IMPORTANT]
> **PayPal Sandbox Payouts Execution Status**:
> While OAuth authorization and endpoint probing for the Payouts API succeed, automated payout execution against `POST /v1/payments/payouts` is subject to PayPal's sender account restriction:
> ```json
> {
>   "name": "USER_COUNTRY_NOT_SUPPORTED",
>   "message": "User country is not supported.",
>   "information_link": "https://developer.paypal.com/docs/api/payments.payouts-batch/#errors"
> }
> ```
> In compliance with PayPal API terms and developer guidelines:
> 1. GitEscrow **does not synthesize fake payout confirmations**.
> 2. Payout execution remains **fully modular and guarded** (`--run-payout` flag in verification suites).
> 3. Production deployments require a PayPal Business account in a country permitted for automated Payouts.

---

## 4. Hallmark UI Design & GSAP Motion

GitEscrow's frontend follows the **Hallmark** design authority, implementing a sleek, modern-minimal developer-tool aesthetic (`Console` theme):

- **Centralized OKLCH Tokens (`tokens.css`)**: High-contrast, accessibility-checked colors (`--color-paper`, `--color-ink`, `--color-accent`), spacing scales (`--space-1` through `--space-8`), and border rules (`--rule-hair`).
- **Typography & Formatting**: Clean sans-serif headings with monospace tabular numbers for financial figures and transaction IDs (`var(--font-mono)`).
- **GSAP Animation Engine**:
  - React 19 lifecycle safety via `@gsap/react` `useGSAP()` hook with ref scoping.
  - Transforms and opacity only (`y`, `autoAlpha`, `scale`); no reflow properties (`width`, `height`, `margin`, `padding`).
  - Strict support for `prefers-reduced-motion` via `gsap.matchMedia()`, reverting animations to instantaneous transitions when requested.
- **Code Quality**: Verified clean with Hallmark's sloplint auditor: **0 FAIL, 0 REFLEX, 0 WARN across 16 files**.

---


## 5. Visual Artifacts (22 Browser Screenshots)

The project includes 22 browser screenshots captured across 11 application views for both Desktop (1440x900) and Mobile (390x844), stored in `artifacts/screens/`:

| View                               | Desktop Screenshot                         | Mobile Screenshot                         | Description                                                                                          |
| ---                                | ---                                        | ---                                       | ---                                                                                                  |
| **Public Marketplace**             | `01-public-marketplace-desktop.png`        | `01-public-marketplace-mobile.png`        | Unauthenticated bounty grid with status filters, search, and demo badges                             |
| **Login**                          | `02-login-desktop.png`                     | `02-login-mobile.png`                     | Authentication form with credential fields and security notices                                      |
| **Registration**                   | `03-registration-desktop.png`              | `03-registration-mobile.png`              | Developer registration form with password requirements                                               |
| **Authenticated Marketplace**      | `04-authenticated-marketplace-desktop.png` | `04-authenticated-marketplace-mobile.png` | Marketplace with active session badge, user profile link, and role pill                              |
| **Bounty Details**                 | `05-bounty-details-desktop.png`            | `05-bounty-details-mobile.png`            | Bounty view with GitHub issue link, sponsor info, and tab navigation                                 |
| **Milestones**                     | `06-milestones-desktop.png`                | `06-milestones-mobile.png`                | Sequential milestone breakdown with deliverables and completion states                               |
| **Escrow Ledger**                  | `07-escrow-ledger-desktop.png`             | `07-escrow-ledger-mobile.png`             | Append-only financial audit trail with event types and idempotency keys                              |
| **Create Bounty**                  | `08-create-bounty-desktop.png`             | `08-create-bounty-mobile.png`             | Interactive milestone builder with dynamic sum calculation and validation                            |
| **User Profile**                   | `09-user-profile-desktop.png`              | `09-user-profile-mobile.png`              | User credentials, RBAC permissions, and organization memberships                                     |
| **AI Analysis Review Modal**       | `10-ai-analysis-modal-desktop.png`         | `10-ai-analysis-modal-mobile.png`         | **Task 2B.2**: AI decomposition review drawer with criteria checklist and allocation metrics         |
| **Bounty Form with AI Milestones** | `11-bounty-form-ai-applied-desktop.png`    | `11-bounty-form-ai-applied-mobile.png`    | **Task 2B.2**: Populated draft with applied AI milestones, criteria, and sponsor verification notice |

---

## 6. Installation & Quickstart

### Prerequisites

- **Node.js**: v18.0.0 or higher (tested on Node v24)
- **npm**: v9.0.0 or higher
- **MongoDB**: Local MongoDB instance or MongoDB Atlas cluster
- **PayPal Developer Account**: [https://developer.paypal.com](https://developer.paypal.com)
- **GitHub Personal Access Token**: [https://github.com/settings/tokens](https://github.com/settings/tokens)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/gitescrow.git
cd gitescrow

# Install all workspace dependencies
npm run install:all
````

### Environment Configuration

Copy [.env.example](.env.example) to `.env` and `server/.env`:

```bash
cp .env.example .env
cp .env.example server/.env
````

Configure your environment variables:

```ini
# PayPal Sandbox REST Credentials
PAYPAL_CLIENT_ID=your_paypal_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_paypal_sandbox_client_secret
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
PAYPAL_SANDBOX_CONTRIBUTOR_EMAIL=sb-contributor@personal.example.com

# GitHub API & Webhooks
GITHUB_TOKEN=ghp_your_personal_access_token
GITHUB_WEBHOOK_SECRET=your_webhook_hmac_secret
GITHUB_API_BASE_URL=https://api.github.com

# Optional AI Provider Keys (Falls back to deterministic Semantic Analyzer if omitted)
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# Authentication & Security
JWT_ACCESS_SECRET=your_32_byte_min_jwt_access_secret_key
JWT_REFRESH_SECRET=your_32_byte_min_jwt_refresh_secret_key
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
ADMIN_SETUP_SECRET=your_one_time_admin_bootstrap_secret

# MongoDB Atlas / Local Connection
MONGODB_URI=mongodb://localhost:27017/gitescrow

# Application Ports & URLs
PORT=5000
FRONTEND_URL=http://localhost:5173
```
### Running the Services

```bash
# Start backend API server (port 5000)
npm run dev:server

# Start frontend client application (port 5173)
npm run dev:client
```

---

## 7. Verification & Complete Test Matrix

All **87 automated backend tests** and frontend validation suites run deterministically without errors:

| Suite | Command | Tests | Scope & Coverage | Status |
|---|---|---|---|---|
| **AI Issue Analysis** | `npm run test:ai` | **17 / 17** | **Task 2B.2**: Real issue ingestion (`#38090`, `#38092`), structured summary, Zod validation, integer-cent arithmetic, prompt injection defense, 401 auth guards, zero financial transactions | **PASS** |
| **Bounties & Milestones** | `npm run test:bounties` | **34 / 34** | Bounty lifecycle, milestone ordering/sums, atomic race-free claims, locked milestone edits, append-only ledger guards, tenant isolation | **PASS** |
| **Auth & RBAC** | `npm run test:auth` | **31 / 31** | User registration, login, anti-enumeration, token family reuse revocation, HttpOnly cookies, org RBAC, admin bootstrap locking | **PASS** |
| **GitHub Webhooks** | `npm run test:webhook` | **5 / 5** | Timing-safe HMAC SHA-256 signatures, tampered payload rejection, duplicate delivery ID idempotency | **PASS** |
| **GitHub Integration** | `npm run verify:github` | **4 / 4** | Live repo retrieval (`facebook/react`), issue listings, and single issue verification (`#38090`) | **PASS** |
| **PayPal Sandbox** | `npm run verify:sandbox` | **10 / 10** | OAuth authentication, order creation, capture, partial refund ($30.00), remaining refund ($70.00), Payouts endpoint probing, MongoDB ping | **PASS** |
| **PayPal Authorization** | `npm run verify:paypal-auth` | **4 / 4** | Order authorization, authorization capture ($50.00), separate order authorization, authorization void ($25.00) | **PASS** |
| **Hallmark Sloplint** | `node .agent/skills/hallmark/scripts/sloplint.mjs client/src` | **16 files** | Enforces modern-minimal tokens, contrast ratios, and prevents generic UI slop (**0 FAIL, 0 REFLEX, 0 WARN**) | **PASS** |
| **Client Build** | `npm run build:client` | **TypeScript + Vite** | Production chunking, assets, CSS bundling (0 errors) | **PASS** |
| **Server Build** | `npm run build:server` | **TypeScript (tsc)** | Strict typechecking across models, services, and controllers (0 errors) | **PASS** |

---

## 8. License

This project is licensed under the [MIT License](LICENSE).
