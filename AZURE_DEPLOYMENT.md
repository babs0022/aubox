# Aubox on Azure - Deployment Guide

## Overview

Aubox now runs on Azure instead of AWS. This guide shows how to deploy Aubox to Azure using your $100 free credit.

## Prerequisites

- Azure subscription with $100 free credit
- Azure CLI installed (`az` command)
- Node.js 18+
- Git

## Local .env.local Setup

First, fill in your Azure credentials in `.env.local`:

```env
AZURE_TENANT_ID=<your-tenant-id>
AZURE_CLIENT_ID=<your-client-id>
AZURE_CLIENT_SECRET=<your-client-secret>
AZURE_SUBSCRIPTION_ID=<your-subscription-id>
DATABASE_URL=postgresql://username:password@host:5432/aubox?sslmode=require
AZURE_SERVICE_BUS_CONNECTION_STRING=Endpoint=sb://aubox-sb.servicebus.windows.net/;...
```

## Quick Azure Setup (1 Command)

```bash
# Create resource group and core services
az group create --name aubox-rg --location eastus

# Create PostgreSQL Database for Aubox
az postgres flexible-server create \
  --name aubox-db \
  --resource-group aubox-rg \
  --admin-user auboxadmin \
  --admin-password <strong-password> \
  --sku-name Standard_B1ms \
  --tier Burstable

# Create Service Bus namespace for async jobs
az servicebus namespace create \
  --name aubox-sb \
  --resource-group aubox-rg \
  --sku Basic

# Create Service Bus queues
az servicebus queue create --namespace-name aubox-sb --name aubox-profile-jobs --resource-group aubox-rg
az servicebus queue create --namespace-name aubox-sb --name aubox-trace-jobs --resource-group aubox-rg
az servicebus queue create --namespace-name aubox-sb --name aubox-cluster-jobs --resource-group aubox-rg

# Create Storage Account for exports
az storage account create \
  --name auboxstorage \
  --resource-group aubox-rg \
  --sku Standard_LRS

# Create Key Vault for secrets
az keyvault create \
  --name aubox-keyvault \
  --resource-group aubox-rg
```

## Get Connection Strings

```bash
# Service Bus connection string
az servicebus namespace authorization-rule keys list \
  --namespace-name aubox-sb \
  --name RootManageSharedAccessKey \
  --resource-group aubox-rg

# PostgreSQL connection string
az postgres flexible-server show-connection-string \
  --name aubox-db \
  --admin-user auboxadmin

# Storage connection string
az storage account show-connection-string \
  --name auboxstorage \
  --resource-group aubox-rg
```

## Run Locally

```bash
npm install
npm run dev
# Open http://localhost:3000
```

## Deploy to Azure

### Option 1: Azure Static Web Apps (Frontend) + Azure Functions (Backend)

```bash
# Build front+backend
npm run build

# Deploy frontend to Static Web Apps
az staticwebapp create \
  --name aubox-web \
  --source . \
  --resource-group aubox-rg \
  --location eastus

# Deploy API to Azure Functions
func azure functionapp create \
  --name aubox-api \
  --resource-group aubox-rg \
  --runtime node \
  --runtime-version 18 \
  --functions-version 4
```

### Option 2: Single App Service (Recommended for starting out)

```bash
# Create App Service Plan
az appservice plan create \
  --name aubox-plan \
  --resource-group aubox-rg \
  --sku B1 \
  --is-linux

# Create App Service
az webapp create \
  --name aubox-app \
  --resource-group aubox-rg \
  --plan aubox-plan \
  --runtime "node|18"

# Configure environment variables
az webapp config appsettings set \
  --name aubox-app \
  --resource-group aubox-rg \
  --settings \
    AZURE_TENANT_ID="$AZURE_TENANT_ID" \
    AZURE_CLIENT_ID="$AZURE_CLIENT_ID" \
    NODE_ENV="production"

# Push to Azure
git remote add azure https://aubox-app.scm.azurewebsites.net/aubox-app.git
git push azure main
```

## Monitor Costs

```bash
# View current spending against $100 credit
az consumption usage list --interval Daily --resource-group aubox-rg
```

## API Health Check

Once deployed, test the service:

```bash
curl https://aubox-app.azurewebsites.net/api/health
```

Should return:
```json
{
  "status": "ok",
  "service": "aubox-api",
  "features": {
    "auth": "azure-entra-id",
    "dataWalletProfile": ["arkham", "explorer", "quicknode"],
    "dataTrace": ["service-bus-queue", "rpc-fallback"],
    "dataCluster": ["service-bus-queue", "arkham-heuristic"]
  }
}
```

## Database Setup

Run the schema DDL from `src/lib/db.ts`:

```bash
# Connect to PostgreSQL
psql --host=aubox-db.postgres.database.azure.com \
     --username=auboxadmin@aubox-db \
     --dbname=aubox

# Paste the SQL from DB_SCHEMA
```

## Cleanup (when free credit runs out)

```bash
# Delete resource group and all resources
az group delete --name aubox-rg --yes
```

## Cost Breakdown

**Included in $100 free tier (first 3 months):**
- 1 TB SQL Database
- 1 million Azure Functions invocations
- 1 GB Service Bus messaging
- 5 GB app service CPU/memory

**After free tier (~per month):**
- PostgreSQL (B1ms): $30-40
- Service Bus (Basic): $5-10
- App Service (B1): $10-15
- Storage: $2-5

**Total estimate: $50-70/month on B1 tier**

## Next: Add Entra ID Authentication

To fully activate Entra ID auth:

1. Register app in Azure Entra ID
2. Get client credentials
3. Add `MSAL` to frontend (`@azure/msal-browser`)
4. Validate JWT tokens server-side
5. Link user accounts to PostgreSQL

For now, local email/password auth works with JWT tokens.

## Troubleshooting

**Service Bus connection fails:**
- Check connection string is copied correctly
- Verify RootManageSharedAccessKey has "Send/Listen" permissions

**PostgreSQL connection fails:**
- Verify firewall rules allow Azure services
- Use PostgreSQL CLI to test: `psql -h host -U user -d aubox`

**Functions cold start too slow:**
- Consider Premium plan for always-on
- Or use App Service Standard tier

## Support

For Azure-specific issues, check:
- [Azure Docs - PostgreSQL](https://learn.microsoft.com/en-us/azure/postgresql/)
- [Azure Docs - Service Bus](https://learn.microsoft.com/en-us/azure/service-bus-messaging/)
- [Azure Docs - Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/)
