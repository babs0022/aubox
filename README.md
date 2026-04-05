# Aubox

Investigator-first onchain intelligence workspace for profiling wallets, tracing flow, clustering entities, and producing evidence-ready outputs.

This repository contains two Next.js apps:

1. Dashboard app (root project, port 3000): authenticated investigation workspace, onboarding, admin workflows, API routes.
2. Landing app (landing subdirectory, port 3001): marketing site.

## Table of Contents

1. Product Overview
2. Architecture
3. Repository Structure
4. Feature Map
5. Quick Start
6. Environment Variables
7. Email Workflows
8. Access and Admin Flows
9. API Surface (Selected)
10. Background Jobs
11. Deployment
12. Operational Notes
13. Troubleshooting

## Product Overview

Aubox is intentionally analyst-driven, not autonomous. The product is designed to keep human investigators in control while accelerating repetitive parts of onchain investigation.

Core capabilities include:

1. Wallet profile and contextual enrichment.
2. Fund-flow and bridge investigation routes.
3. Entity clustering and case organization.
4. Case artifacts, timelines, and report-oriented workflow.
5. Gated access workflow with admin approval.
6. Structured onboarding, including downloadable identity card.
7. User feedback intake (feature requests + bug reports) and admin triage.

## Architecture

### Runtime

1. Framework: Next.js App Router (root app on Next 16.x).
2. Language: TypeScript.
3. UI: Tailwind CSS 4 + design tokens in src/app/globals.css.

### Services

1. Identity/session: cookie + JWT utilities in src/lib/auth.ts and src/proxy.ts.
2. Storage: Azure Table Storage for users, cases, events, artifacts, access requests/codes, feedback.
3. Queueing: Azure Service Bus for async job processing.
4. Blob uploads: profile image upload flow via Azure Blob Storage.
5. Email delivery: Resend-based transactional emails (welcome, access approval, password reset).
6. External intelligence data: connectors in src/lib/datasources.ts (Arkham, Dune, and others).

### Key Backend Modules

1. src/lib/azure.ts: primary data access and queue integration layer.
2. src/lib/email.ts: transactional email templates + sender logic.
3. src/lib/datasources.ts: external data provider integrations.
4. src/lib/investigation-workflow.ts: workflow composition logic.

## Repository Structure

```text
aubox/
|- src/
|  |- app/
|  |  |- api/                     # App Router APIs
|  |  |- onboarding/              # Onboarding wizard + card generation
|  |  |- dashboard/               # Authenticated product UI
|  |  |- reset-password/          # Base + tokenized reset routes
|  |  |- opengraph-image.tsx      # Dynamic OG image route
|  |- lib/                        # Data, auth, email, workflows
|- public/                        # Root static assets
|- landing/                       # Separate Next.js landing site
|- AZURE_DEPLOYMENT.md            # Azure deployment guide
|- .env.example                   # Environment template
```

## Feature Map

### Authentication and Onboarding

1. Signup/login/logout.
2. Forgot/reset password flow with email delivery.
3. Multi-step onboarding with username validation and profile image upload.
4. Auto-generated onboarding card preview and PNG download.

### Admin and Access Control

1. Request-access intake.
2. Admin review of access requests.
3. One-time access code creation and redemption.
4. Feedback admin panel with status management.

### Investigation Modules

1. Profile analysis.
2. Fund-flow trace.
3. Entity clustering.
4. Bridge analysis.
5. ENS resolve.
6. Social investigation.
7. Token and token-risk endpoints.

## Quick Start

### Prerequisites

1. Node.js 20+ recommended.
2. npm 10+.
3. Azure resources for non-mock storage/queues.
4. Resend API key for email delivery.

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment

```bash
copy .env.example .env.local
```

Then fill required values in .env.local.

### 3) Start dashboard app (root)

```bash
npm run dev
```

Dashboard runs on http://localhost:3000.

### 4) Start landing app (optional)

```bash
cd landing
npm install
npm run dev
```

Landing runs on http://localhost:3001.

## Environment Variables

This project currently uses both required and optional variables. For production, define all required values explicitly.

### Core App URLs

| Variable | Required | Purpose |
|---|---|---|
| APP_BASE_URL | Yes | Primary app URL used in link generation fallbacks. |
| NEXT_PUBLIC_APP_URL | Yes | Public app URL for client-side link contexts. |
| NEXT_PUBLIC_SITE_URL | Recommended | Metadata site URL in layout metadata. |
| WELCOME_EMAIL_BASE_URL | Recommended | Canonical dashboard URL used for email links. |

### Auth and Session

| Variable | Required | Purpose |
|---|---|---|
| JWT_SECRET | Yes | JWT signing/verification secret for auth cookies/tokens. |

### Azure Storage and Queue

| Variable | Required | Purpose |
|---|---|---|
| AZURE_STORAGE_CONNECTION_STRING | Yes | Azure Table/Blob access used across onboarding, users, cases, feedback. |
| AZURE_SERVICE_BUS_CONNECTION_STRING | Required unless using namespace + managed identity | Service Bus connection for jobs. |
| AZURE_SERVICE_BUS_NAMESPACE | Optional alternative | Namespace host used with DefaultAzureCredential path. |
| AZURE_SERVICE_BUS_QUEUE_PROFILE | Optional | Profile jobs queue name (default aubox-profile-jobs). |
| AZURE_SERVICE_BUS_QUEUE_TRACE | Optional | Trace jobs queue name (default aubox-trace-jobs). |
| AZURE_SERVICE_BUS_QUEUE_CLUSTER | Optional | Cluster jobs queue name (default aubox-cluster-jobs). |

### Email (Resend)

| Variable | Required | Purpose |
|---|---|---|
| RESEND_API_KEY | Yes for email sending | Resend API authentication. |
| WELCOME_EMAIL_ENABLED | Optional | Set false to disable welcome and access approval sends. |
| WELCOME_EMAIL_FROM | Recommended | Sender identity for welcome email. |
| WELCOME_EMAIL_REPLY_TO | Recommended | Reply-to for welcome email. |
| ACCESS_APPROVAL_EMAIL_FROM | Recommended | Sender identity for approval email. |
| ACCESS_APPROVAL_EMAIL_REPLY_TO | Recommended | Reply-to for approval email. |
| PASSWORD_RESET_EMAIL_FROM | Recommended | Sender identity for password reset email. |
| PASSWORD_RESET_EMAIL_REPLY_TO | Recommended | Reply-to for password reset email. |
| FOUNDER_FULL_NAME | Optional | Welcome email copy personalization. |
| FOUNDER_EMAIL | Optional | Fallback sender identity. |
| FOUNDER_CALENDLY_URL | Optional | CTA link in welcome/approval emails. |

### External Intelligence Providers

| Variable | Required | Purpose |
|---|---|---|
| ARKHAM_API_KEY | Optional | Arkham enrichment and analytics routes. |
| DUNE_API_KEY | Optional | Dune-backed queries. |
| DUNE_BRIDGE_QUERY_ID | Optional | Dune bridge analysis query id. |
| DUNE_FUND_FLOW_QUERY_ID | Optional | Dune fund-flow query id. |
| ALCHEMY_MAINNET_RPC_URL / ALCHEMY_API_KEY | Optional | ENS and Ethereum resolver paths. |
| ETHEREUM_RPC_URL | Optional | Generic Ethereum RPC fallback. |
| QUICKNODE_RPC_URL | Optional | Additional RPC fallback. |
| DESEARCH_API_KEY | Optional | Social investigation connector. |
| NANSEN_API_KEY | Optional | Nansen connector where enabled. |

### Optional Flags and Ops

| Variable | Required | Purpose |
|---|---|---|
| FUND_FLOW_DEBUG | Optional | Enables fund-flow debug diagnostics. |
| BRIDGE_EXPOSURE_DEBUG | Optional | Enables bridge debug diagnostics. |
| TRACE_VALUE_DEBUG | Optional | Workflow-level trace debugging. |
| AUBOX_DEFAULT_ACCESS_CODES | Optional | Comma-separated startup access codes. |
| AUBOX_DEFAULT_ACCESS_CODE_USES | Optional | Default usage count for seeded access codes. |

## Email Workflows

Email templates and delivery are implemented in src/lib/email.ts.

Current transactional templates:

1. Welcome email.
2. Access approval email (includes one-time code instructions).
3. Password reset email.

Behavioral note:

1. Email links never intentionally fall back to localhost.
2. If no safe URL is configured, links default to https://dashboard.aubox.app.

## Access and Admin Flows

### Request Access

1. User submits request at /request-access.
2. Admin reviews at /dashboard/admin/access-requests.
3. Admin approves and sends one-time access code.
4. User redeems code in signup flow.

### Feedback Queue

1. Users submit feature requests or bug reports from dashboard navigation.
2. Admin reviews feedback at /dashboard/admin/feedback.
3. Status transitions: new, in_review, resolved, dismissed.

## API Surface (Selected)

Representative routes under src/app/api:

1. /api/auth/*: login/signup/redeem-code/forgot-password/reset-password/logout.
2. /api/onboarding/*: status, complete, profile image upload.
3. /api/access-requests/* and /api/admin/*: gated access and admin moderation.
4. /api/feedback and /api/admin/feedback/*: feedback intake + triage.
5. /api/profile, /api/fund-flow, /api/cluster, /api/bridge, /api/social: investigation routes.
6. /api/jobs/process: queued job processing endpoint.
7. /api/health: service health check.

## Background Jobs

Local utility scripts in package.json:

1. npm run jobs:process
2. npm run jobs:monitor

These trigger the /api/jobs/process endpoint and are useful for manual queue processing in local environments.

## Deployment

For Azure deployment instructions, see AZURE_DEPLOYMENT.md.

Typical patterns:

1. Vercel deployment for dashboard and landing apps.
2. Azure-hosted backing services (Storage, Service Bus, optional App Service/Functions).

Deployment checklist:

1. Set all required environment variables.
2. Verify AZURE_STORAGE_CONNECTION_STRING and queue settings.
3. Verify RESEND_API_KEY and sender domains.
4. Confirm APP_BASE_URL / WELCOME_EMAIL_BASE_URL production values.
5. Validate /api/health after deployment.

## Operational Notes

1. Password reset route format is path-based: /reset-password/<token>.
2. Open Graph image is generated at /opengraph-image.
3. Onboarding card preview now matches the actual downloadable image.

## Troubleshooting

### npm run dev fails

1. Ensure dependencies are installed at root: npm install.
2. Confirm .env.local exists and required values are present.
3. Remove stale build output if needed: delete .next and restart.

### Email is not delivered

1. Verify RESEND_API_KEY.
2. Verify sender domain/address in Resend.
3. Confirm WELCOME_EMAIL_ENABLED is not false.

### Azure data operations fail

1. Check AZURE_STORAGE_CONNECTION_STRING.
2. Check Service Bus connection string/namespace and queue names.
3. Confirm credentials/permissions for the target subscription and resources.

---

If you maintain this repository, keep .env.example aligned with real runtime requirements whenever adding new environment variables.
