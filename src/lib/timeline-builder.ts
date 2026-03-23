// Timeline builder for assembling case events into chronological narrative
import { CaseEventRecord } from "@/lib/azure";

export interface TimelineEvent {
  timestamp: string;
  blockNumber?: number;
  feature: string;
  title: string;
  narrative: string;
  metrics: Record<string, number | string>;
  entities: string[];
  riskIndicators: string[];
}

export const buildTimelineFromEvents = (events: CaseEventRecord[]): TimelineEvent[] => {
  const timeline: TimelineEvent[] = [];

  for (const event of events) {
    const entities = extractEntitiesFromEvent(event);
    const riskIndicators = extractRiskIndicators(event);
    const blockNumber = extractBlockNumber(event);

    timeline.push({
      timestamp: event.createdAt,
      blockNumber,
      feature: event.feature,
      title: event.title,
      narrative: event.narrative,
      metrics: event.metrics || {},
      entities,
      riskIndicators,
    });
  }

  // Sort by timestamp descending (newest first)
  return timeline.sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1));
};

const extractEntitiesFromEvent = (event: CaseEventRecord): string[] => {
  const entities = new Set<string>();

  // Extract from nodes
  if (Array.isArray(event.nodes)) {
    for (const node of event.nodes) {
      if (node && typeof node === "object" && "id" in node) {
        const id = (node as Record<string, unknown>).id;
        if (typeof id === "string" && id.startsWith("0x")) {
          entities.add(id);
        }
      }
    }
  }

  // Extract from metrics (common field names)
  const metricsObj = event.metrics || {};
  for (const [key, value] of Object.entries(metricsObj)) {
    if (key.toLowerCase().includes("address") && typeof value === "string" && value.startsWith("0x")) {
      entities.add(value);
    }
  }

  // Extract from narrative (simple regex, look for 0x addresses)
  const addressRegex = /0x[a-fA-F0-9]{40}/g;
  const matches = event.narrative.match(addressRegex);
  if (matches) {
    for (const match of matches) {
      entities.add(match.toLowerCase());
    }
  }

  return Array.from(entities);
};

const extractRiskIndicators = (event: CaseEventRecord): string[] => {
  const risks: string[] = [];
  const metrics = event.metrics || {};

  // Profile feature risk
  if (event.feature === "profile") {
    const riskScore = metrics.riskScore;
    if (typeof riskScore === "number") {
      if (riskScore >= 75) risks.push("high_risk_wallet");
      if (riskScore >= 40) risks.push("medium_risk_wallet");
    }
    const labelCount = metrics.labelCount;
    if (typeof labelCount === "number" && labelCount > 5) {
      risks.push("multiple_attributed_tags");
    }
  }

  // Trace feature risk
  if (event.feature === "trace") {
    const hasJob = metrics.hasJob;
    if (typeof hasJob === "number" && hasJob === 1) risks.push("async_trace_pending");
    const txCount = metrics.txCountFallback;
    if (typeof txCount === "number" && txCount < 0) risks.push("failed_trace");
  }

  // Cluster feature risk
  if (event.feature === "cluster") {
    const clusterSize = metrics.clusterSize;
    if (typeof clusterSize === "number" && clusterSize > 10) risks.push("large_entity_cluster");
  }

  // Social feature risk
  if (event.feature === "social") {
    const mentionCount = metrics.mentionCount;
    const maxEngagement = metrics.maxEngagement;
    if (typeof mentionCount === "number" && mentionCount >= 5) risks.push("coordinated_social_signal");
    if (typeof maxEngagement === "number" && maxEngagement >= 100) risks.push("viral_social_amplification");
  }

  // Generic age-based risk
  const createdTime = new Date(event.createdAt).getTime();
  const nowTime = Date.now();
  const ageHours = (nowTime - createdTime) / (1000 * 60 * 60);
  if (ageHours > 72) risks.push("stale_intelligence");

  return Array.from(new Set(risks));
};

const extractBlockNumber = (event: CaseEventRecord): number | undefined => {
  const metrics = event.metrics || {};
  const blockNum = metrics.blockNumber;
  if (typeof blockNum === "number") return blockNum;

  // Try to extract from narrative (simple pattern)
  const blockMatch = event.narrative.match(/block\s*#?(\d+)/i);
  if (blockMatch && blockMatch[1]) {
    return Number.parseInt(blockMatch[1], 10);
  }

  return undefined;
};

export const formatTimelineForExport = (timeline: TimelineEvent[]): string => {
  let output = "# Investigation Timeline\n\n";
  output += `Generated: ${new Date().toLocaleString()}\n\n`;

  let currentDate = "";

  for (const event of timeline) {
    const eventDate = new Date(event.timestamp).toLocaleDateString();
    if (eventDate !== currentDate) {
      currentDate = eventDate;
      output += `## ${eventDate}\n\n`;
    }

    const time = new Date(event.timestamp).toLocaleTimeString();
    output += `### ${time} — ${event.feature.toUpperCase()} — ${event.title}\n\n`;

    output += `${event.narrative}\n\n`;

    if (event.blockNumber) {
      output += `**Block**: ${event.blockNumber}\n\n`;
    }

    if (event.entities.length > 0) {
      output += `**Entities**: ${event.entities.join(", ")}\n\n`;
    }

    if (event.riskIndicators.length > 0) {
      output += `⚠️ **Risk Flags**: ${event.riskIndicators.join(", ")}\n\n`;
    }

    if (Object.keys(event.metrics).length > 0) {
      output += "**Metrics**:\n";
      for (const [key, value] of Object.entries(event.metrics)) {
        output += `- ${key}: ${value}\n`;
      }
      output += "\n";
    }
  }

  return output;
};

export const summarizeTimeline = (timeline: TimelineEvent[]): Record<string, unknown> => {
  const summary = {
    totalEvents: timeline.length,
    timelineSpan: "",
    featuresUsed: new Set<string>(),
    entitiesInvolved: new Set<string>(),
    riskCount: 0,
    socialSignalEvents: 0,
    highRiskEvents: [] as TimelineEvent[],
    lastUpdated: timeline[0]?.timestamp || new Date().toISOString(),
  };

  if (timeline.length > 0) {
    const oldest = timeline[timeline.length - 1];
    const newest = timeline[0];
    summary.timelineSpan = `${new Date(oldest.timestamp).toLocaleDateString()} to ${new Date(newest.timestamp).toLocaleDateString()}`;
  }

  let seen = new Set<string>();
  for (const event of timeline) {
    (summary.featuresUsed as Set<string>).add(event.feature);
    for (const entity of event.entities) {
      (summary.entitiesInvolved as Set<string>).add(entity);
    }

    if (event.riskIndicators.length > 0) {
      (summary as Record<string, unknown>).riskCount = ((summary as Record<string, unknown>).riskCount as number) + 1;
      if (event.riskIndicators.some((r) => r.includes("high"))) {
        (summary.highRiskEvents as TimelineEvent[]).push(event);
      }
    }

    if (event.feature === "social") {
      (summary as Record<string, unknown>).socialSignalEvents =
        ((summary as Record<string, unknown>).socialSignalEvents as number) + 1;
    }
  }

  return {
    ...summary,
    featuresUsed: Array.from(summary.featuresUsed),
    entitiesInvolved: Array.from(summary.entitiesInvolved),
  };
};
