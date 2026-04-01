import { ServiceBusClient } from "@azure/service-bus";
import { buildWalletProfile } from "@/lib/datasources";
import { rpcCall } from "@/lib/datasources";
import { arkhamLookup } from "@/lib/datasources";
import { updateAsyncJob } from "@/lib/azure";
import { NextRequest, NextResponse } from "next/server";


interface JobPayload {
  [key: string]: unknown;
  userId: string;
  address?: string;
  sourceAddress?: string;
  seedAddresses?: string[];
}

function getQueueName(jobType: string): string {
  const queueNames: Record<string, string> = {
    profile: process.env.AZURE_SERVICE_BUS_QUEUE_PROFILE || "aubox-profile-jobs",
    trace: process.env.AZURE_SERVICE_BUS_QUEUE_TRACE || "aubox-trace-jobs",
    cluster: process.env.AZURE_SERVICE_BUS_QUEUE_CLUSTER || "aubox-cluster-jobs",
  };
  return queueNames[jobType] || "";
}

async function processProfileJob(payload: JobPayload) {
  if (!payload.address || !payload.chain) {
    throw new Error("Invalid profile job: missing address or chain");
  }

  return await buildWalletProfile(payload.address as string, payload.chain as string);
}


// For trace and cluster, the actual processing is done in their respective API routes
// This processor just marks them as completed
async function processTraceJob(payload: JobPayload) {
  const sourceAddress = typeof payload.sourceAddress === "string" ? payload.sourceAddress : null;
  const chain = typeof payload.chain === "string" ? payload.chain : null;

  if (!sourceAddress || !chain) {
    throw new Error("Invalid trace payload");
  }

  const trace = await rpcCall(chain, "trace_filter", [
    {
      fromAddress: [sourceAddress],
      count: 100,
    },
  ]);

  if (!trace) {
    const txCountHex = await rpcCall(chain, "eth_getTransactionCount", [sourceAddress, "latest"]);
    return {
      success: true,
      trace: null,
      fallback: {
        txCountHex,
      },
      message: "Trace filter is not supported by this RPC provider. Returned account-level fallback data.",
    };
  }

  return {
    success: true,
    trace,
    message: "Trace completed (async queue mode).",
  };
}

async function processClusterJob(payload: JobPayload) {
  const seedAddresses = Array.isArray(payload.seedAddresses)
    ? payload.seedAddresses.filter((item): item is string => typeof item === "string")
    : [];
  const heuristics = Array.isArray(payload.heuristics)
    ? payload.heuristics.filter((item): item is string => typeof item === "string")
    : ["sharedFunder", "counterparty"];

  if (seedAddresses.length === 0) {
    throw new Error("Invalid cluster payload");
  }

  const labelResults = await Promise.all(
    seedAddresses.map(async (address) => ({
      address,
      arkhamData: await arkhamLookup(address),
    }))
  );

  const clusters: Record<string, string[]> = {};
  labelResults.forEach(({ address, arkhamData }) => {
    if (arkhamData?.labels) {
      arkhamData.labels.forEach((label: string) => {
        if (!clusters[label]) {
          clusters[label] = [];
        }
        clusters[label].push(address);
      });
    }
  });

  return {
    success: true,
    clusters: Object.entries(clusters).filter(([, addrs]) => addrs.length > 1),
    heuristics,
    message: "Clustering completed (async queue mode).",
  };
}

export async function POST() {
  try {

    const connectionString = process.env.AZURE_SERVICE_BUS_CONNECTION_STRING;
    if (!connectionString) {
      return NextResponse.json(
        { error: "Service Bus not configured" },
        { status: 503 }
      );
    }

    const serviceBusClient = new ServiceBusClient(connectionString);

    // Process one job from each queue
    const results = {
      profile: { processed: 0, succeeded: 0, failed: 0 },
      trace: { processed: 0, succeeded: 0, failed: 0 },
      cluster: { processed: 0, succeeded: 0, failed: 0 },
    };

    for (const jobType of ["profile", "trace", "cluster"] as const) {
      try {
        const queueName = getQueueName(jobType);
        if (!queueName) continue;

        const receiver = serviceBusClient.createReceiver(queueName, { receiveMode: "peekLock" });

        const messages = await receiver.receiveMessages(1, { maxWaitTimeInMs: 1000 });

        for (const message of messages) {
          results[jobType].processed++;

          try {
            const payload: JobPayload = JSON.parse(
              typeof message.body === "string" ? message.body : JSON.stringify(message.body)
            );
            const jobId = typeof payload.jobId === "string" ? payload.jobId : null;
            const userId = typeof payload.userId === "string" ? payload.userId : null;

            if (jobId && userId) {
              await updateAsyncJob(userId, jobId, { status: "running", error: null });
            }

            console.log(`[${jobType}] Processing job`, payload);

            let jobResult: unknown;
            switch (jobType) {
              case "profile":
                jobResult = await processProfileJob(payload);
                break;
              case "trace":
                jobResult = await processTraceJob(payload);
                break;
              case "cluster":
                jobResult = await processClusterJob(payload);
                break;
            }

            // Store result somewhere (for now, log it)
            console.log(`[${jobType}] Job completed`, jobResult);

            if (jobId && userId) {
              await updateAsyncJob(userId, jobId, {
                status: "completed",
                result: (jobResult as Record<string, unknown>) || {},
                error: null,
              });
            }

            // Complete the message
            await receiver.completeMessage(message);
            results[jobType].succeeded++;
          } catch (error) {
            console.error(`[${jobType}] Job failed:`, error);
            try {
              const payload: JobPayload = JSON.parse(
                typeof message.body === "string" ? message.body : JSON.stringify(message.body)
              );
              const jobId = typeof payload.jobId === "string" ? payload.jobId : null;
              const userId = typeof payload.userId === "string" ? payload.userId : null;
              if (jobId && userId) {
                await updateAsyncJob(userId, jobId, {
                  status: "failed",
                  error: error instanceof Error ? error.message : "Unknown error",
                });
              }
            } catch {
              // Ignore status update failures.
            }
            // Abandon message so it can be retried
            await receiver.abandonMessage(message);
            results[jobType].failed++;
          }
        }

        await receiver.close();
      } catch (error) {
        console.error(`[${jobType}] Queue processing error:`, error);
      }
    }

    await serviceBusClient.close();

    return NextResponse.json({
      success: true,
      message: "Job processing complete",
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Job processor error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const queue = searchParams.get("queue") || "all";
    const maxJobs = Math.min(parseInt(searchParams.get("maxJobs") || "1"), 10); // Max 10 per request

    const connectionString = process.env.AZURE_SERVICE_BUS_CONNECTION_STRING;
    if (!connectionString) {
      return NextResponse.json(
        { error: "Service Bus not configured" },
        { status: 503 }
      );
    }

    const serviceBusClient = new ServiceBusClient(connectionString);

    const queueNames =
      queue === "all"
        ? (["profile", "trace", "cluster"] as const)
        : ([queue as "profile" | "trace" | "cluster"] as const);

    type QueueRunResult = {
      queueName: string;
      requested: number;
      processed: number;
      jobs: Array<Record<string, unknown>>;
    };

    const results: Record<string, QueueRunResult> = {};

    for (const jobType of queueNames) {
      const queueName = getQueueName(jobType);
      if (!queueName) continue;

      const receiver = serviceBusClient.createReceiver(queueName, { receiveMode: "peekLock" });

      const jobCount = Math.min(maxJobs, 3);
      results[jobType] = {
        queueName,
        requested: jobCount,
        processed: 0,
        jobs: [],
      };

      try {
        const messages = await receiver.receiveMessages(jobCount, { maxWaitTimeInMs: 1000 });

        for (const message of messages) {
          try {
            const payload = JSON.parse(
              typeof message.body === "string" ? message.body : JSON.stringify(message.body)
            );

            results[jobType].processed++;

            console.log(`[${jobType}] Processing job`, payload);

            let jobResult: unknown;
            switch (jobType) {
              case "profile":
                jobResult = await processProfileJob(payload);
                break;
              case "trace":
                jobResult = await processTraceJob(payload);
                break;
              case "cluster":
                jobResult = await processClusterJob(payload);
                break;
            }

            results[jobType].jobs.push({
              payload,
              result: jobResult,
              status: "completed",
            });

            await receiver.completeMessage(message);
          } catch (error) {
            results[jobType].jobs.push({
              error: error instanceof Error ? error.message : "Unknown error",
              status: "failed",
            });
            await receiver.abandonMessage(message);
          }
        }
      } finally {
        await receiver.close();
      }
    }

    await serviceBusClient.close();

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Job processor error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
