import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "aubox-api",
      version: "0.1.0",
      timestamp: new Date().toISOString(),
      features: {
        auth: "azure-entra-id",
        dataWalletProfile: ["arkham", "explorer", "quicknode"],
        dataTrace: ["service-bus-queue", "rpc-fallback"],
        dataCluster: ["service-bus-queue", "arkham-heuristic"],
      },
    },
    { status: 200 }
  );
}
