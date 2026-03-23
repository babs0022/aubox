# Aubox - Onchain Investigation Workbench on Azure

Aubox is a manual, investigator-first onchain research web app. It is intentionally not an autonomous agent.

## Current MVP Foundation

- Next.js App Router + TypeScript
- Tailwind CSS 4
- Landing cockpit with the five must-have action modules:
  - Profile Address
  - Trace Funds
  - Cluster Entities
  - Build Timeline
  - Generate Report
- Day-1 launch chain badges:
  - Ethereum
  - BSC
  - Base
  - Arbitrum
  - Hyperliquid

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Project Layout

- `src/app/layout.tsx`: global metadata and font setup
- `src/app/globals.css`: design tokens, background styling, animation keyframes
- `src/app/page.tsx`: Aubox hero, chain scope, and primary investigation action cards

## Architecture Overview

- **Frontend**: Next.js (Vercel or Azure Static Web Apps)
- **Backend**: Azure Functions or App Service
- **Auth**: Azure Entra ID B2C (or Entra External ID)
- **Database**: Azure Database for PostgreSQL
- **Queue**: Azure Service Bus
- **Storage**: Azure Blob Storage
- **Secrets**: Azure Key Vault
- **Onchain Data**: Provider-agnostic per-chain RPC URLs + Arkham enrichment

Implementation note: Azure integrations are in `src/lib/azure.ts`.

## Next Build Steps
- Harden Entra auth token verification with Microsoft identity libraries
- Add API routes for investigation actions (`/api/profile`, `/api/trace`, `/api/cluster`) persistence layer
- Add persistence for cases/evidence with PostgreSQL
- Add queue workers for heavy trace and clustering jobs
- Integrate per-chain RPC providers + Arkham with source fallback logic
