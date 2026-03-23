"use client";

import { getActiveCaseId } from "@/lib/case-client";
import { useActiveCaseId } from "@/lib/use-active-case";
import { buildTimelineFromEvents, formatTimelineForExport, summarizeTimeline, TimelineEvent } from "@/lib/timeline-builder";
import { formatTimestamp } from "@/lib/onchain-format";
import { useEffect, useMemo, useState } from "react";

export default function BuildTimelinePage() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const activeCaseId = useActiveCaseId();

  const loadCaseTimeline = async () => {
    const caseId = activeCaseId || getActiveCaseId();
    if (!caseId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/cases/${caseId}/events`);
      if (!response.ok) throw new Error("Failed to load case events");

      const data = await response.json();
      const caseEvents = Array.isArray(data.events) ? data.events : [];

      // Use timeline builder to process events
      const timeline = buildTimelineFromEvents(caseEvents);
      setEvents(timeline);

      // Generate summary
      const timelineSummary = summarizeTimeline(timeline);
      setSummary(timelineSummary);
    } catch (error) {
      console.error("Timeline load failed:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCaseTimeline();
  }, [activeCaseId]);

  const exportMarkdown = () => {
    const markdown = formatTimelineForExport(events);
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `investigation-timeline-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Feature 04</p>
      <h1 className="mt-2 text-3xl font-bold text-[var(--ink)]">Build Timeline</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Assemble case evidence into a chronological investigation timeline with risk annotations.</p>

      <div className="mt-6 flex gap-2">
        <button
          onClick={loadCaseTimeline}
          disabled={loading}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-50"
        >
          {loading ? "Loading..." : "Refresh Timeline"}
        </button>
        <button
          onClick={exportMarkdown}
          disabled={events.length === 0}
          className="rounded-lg border border-[var(--line)] bg-white px-4 py-2 font-semibold disabled:opacity-50"
        >
          Export Markdown
        </button>
      </div>

      {summary ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3">
            <p className="text-xs text-[var(--muted)]">Total Events</p>
            <p className="mt-1 text-2xl font-bold">{String((summary as Record<string, unknown>).totalEvents || 0)}</p>
          </div>
          <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3">
            <p className="text-xs text-[var(--muted)]">Time Span</p>
            <p className="mt-1 text-sm font-semibold">{String((summary as Record<string, unknown>).timelineSpan || "N/A")}</p>
          </div>
          <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3">
            <p className="text-xs text-[var(--muted)]">Risk Events</p>
            <p className="mt-1 text-2xl font-bold text-orange-600">{String((summary as Record<string, unknown>).riskCount || 0)}</p>
          </div>
          <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3">
            <p className="text-xs text-[var(--muted)]">Entities</p>
            <p className="mt-1 text-2xl font-bold">{String(((summary as Record<string, unknown>).entitiesInvolved as string[])?.length || 0)}</p>
          </div>
          <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3">
            <p className="text-xs text-[var(--muted)]">Social Signals</p>
            <p className="mt-1 text-2xl font-bold text-orange-600">{String((summary as Record<string, unknown>).socialSignalEvents || 0)}</p>
          </div>
        </div>
      ) : null}

      {summary ? (
        <div className="mt-6 rounded-lg border border-[var(--line)] bg-white p-4">
          <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Features Used</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {((summary as Record<string, unknown>).featuresUsed as string[])?.map((feature) => (
              <span
                key={feature}
                className={`rounded-full px-3 py-1 text-xs font-semibold text-white ${
                  feature === "social" ? "bg-orange-600" : "bg-[var(--accent)]"
                }`}
              >
                {feature}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {events.length > 0 ? (
        <div className="mt-6 space-y-3">
          <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Timeline Events (Newest First)</p>
          {events.map((event, idx) => (
            <div key={idx} className="rounded-lg border border-[var(--line)] bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-xs text-[var(--muted)]">{formatTimestamp(event.timestamp)}</p>
                    {event.blockNumber ? <p className="text-xs text-[var(--muted)]">Block #{event.blockNumber}</p> : null}
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold text-white ${
                        event.feature === "social" ? "bg-orange-600" : "bg-[var(--accent)]"
                      }`}
                    >
                      {event.feature}
                    </span>
                  </div>
                  <h3 className="mt-2 text-lg font-semibold">{event.title}</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">{event.narrative}</p>

                  {event.entities.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {event.entities.map((addr) => (
                        <span key={addr} className="font-mono text-xs bg-[var(--paper)] px-2 py-1 rounded border border-[var(--line)]">
                          {addr.slice(0, 10)}...
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {event.riskIndicators.length > 0 ? (
                    <div className="mt-3 p-2 rounded-lg bg-orange-50 border border-orange-200">
                      <p className="text-xs font-semibold text-orange-700">⚠️ Risk Flags:</p>
                      <p className="text-xs text-orange-600 mt-1">{event.riskIndicators.join(", ")}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {events.length === 0 && !loading ? (
        <div className="mt-6 rounded-lg border border-[var(--line)] bg-[var(--paper)] p-6 text-center">
          <p className="text-sm text-[var(--muted)]">Select or create an active case and run investigation features to build a timeline.</p>
        </div>
      ) : null}
    </div>
  );
}
