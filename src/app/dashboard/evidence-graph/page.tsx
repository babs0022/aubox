"use client";

import { getActiveCaseId } from "@/lib/case-client";
import { useActiveCaseId } from "@/lib/use-active-case";
import { formatTimestamp } from "@/lib/onchain-format";
import MermaidDiagram from "@/components/dashboard/MermaidDiagram";
import { useEffect, useMemo, useState } from "react";

type Node = { id: string; label: string; type: string };
type Edge = { source: string; target: string; label?: string };
type CaseEvent = {
  id: string;
  feature: string;
  title: string;
  narrative: string;
  nodes?: Node[];
  edges?: Edge[];
  createdAt: string;
};

export default function EvidenceGraphPage() {
  const activeCaseIdHook = useActiveCaseId();
  const [events, setEvents] = useState<CaseEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const caseId = activeCaseIdHook || getActiveCaseId();
      if (!caseId) {
        setError("Select an active case to view graph evidence.");
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/cases/${caseId}/events`);
        if (!response.ok) {
          throw new Error("Failed to load case events");
        }
        const data = await response.json();
        setEvents(Array.isArray(data.events) ? data.events : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load graph evidence");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [activeCaseIdHook]);

  const graph = useMemo(() => {
    const nodeMap = new Map<string, Node>();
    const edges: Edge[] = [];

    events.forEach((event) => {
      (event.nodes || []).forEach((node) => {
        if (!nodeMap.has(node.id)) {
          nodeMap.set(node.id, node);
        }
      });
      (event.edges || []).forEach((edge) => edges.push(edge));
    });

    return {
      nodes: Array.from(nodeMap.values()),
      edges,
    };
  }, [events]);

  const mermaidChart = useMemo(() => {
    if (graph.nodes.length === 0) {
      return "";
    }

    const lines: string[] = [
      "flowchart LR",
      "classDef address fill:#f5faf9,stroke:#2f8577,color:#0f2e2a,stroke-width:1px",
      "classDef cluster fill:#0a6e5d,stroke:#07584b,color:#ffffff,stroke-width:1px",
      "classDef entity fill:#eef2ff,stroke:#6366f1,color:#1e1b4b,stroke-width:1px",
      "classDef social fill:#fff4e6,stroke:#ea580c,color:#7c2d12,stroke-width:1px",
      "classDef default fill:#ffffff,stroke:#94a3b8,color:#0f172a,stroke-width:1px",
    ];

    const nodeToMermaidId = new Map<string, string>();

    graph.nodes.forEach((node, index) => {
      const mermaidId = `n${index}`;
      nodeToMermaidId.set(node.id, mermaidId);
      const safeLabel = (node.label || node.id).replace(/\"/g, "'");
      lines.push(`${mermaidId}[\"${safeLabel}\"]`);

      if (node.type === "address") {
        lines.push(`class ${mermaidId} address`);
      } else if (node.type === "cluster") {
        lines.push(`class ${mermaidId} cluster`);
      } else if (node.type === "entity") {
        lines.push(`class ${mermaidId} entity`);
      } else if (node.type === "social") {
        lines.push(`class ${mermaidId} social`);
      }
    });

    graph.edges.forEach((edge) => {
      const sourceId = nodeToMermaidId.get(edge.source);
      const targetId = nodeToMermaidId.get(edge.target);
      if (!sourceId || !targetId) {
        return;
      }

      if (edge.label) {
        const safeEdgeLabel = edge.label.replace(/\"/g, "'");
        lines.push(`${sourceId} -->|${safeEdgeLabel}| ${targetId}`);
      } else {
        lines.push(`${sourceId} --> ${targetId}`);
      }
    });

    return lines.join("\n");
  }, [graph]);

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Investigation Graph</p>
      <h1 className="mt-2 text-3xl font-bold text-[var(--ink)]">Evidence Graph</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Visualize linked wallets, entities, social accounts, and flow paths captured from profile, trace, clustering, and social signals.
      </p>

      {loading ? <p className="mt-4 text-sm text-[var(--muted)]">Loading evidence graph...</p> : null}
      {error ? <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {!loading && !error ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="rounded-xl border border-[var(--line)] bg-white p-3">
            {mermaidChart ? <MermaidDiagram chart={mermaidChart} /> : <p className="text-sm text-[var(--muted)]">No graph nodes yet.</p>}
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Graph Stats</p>
            <div className="mt-3 space-y-3">
              <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3">
                <p className="text-xs text-[var(--muted)]">Nodes</p>
                <p className="mt-1 text-xl font-bold text-[var(--ink)]">{graph.nodes.length}</p>
              </div>
              <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3">
                <p className="text-xs text-[var(--muted)]">Edges</p>
                <p className="mt-1 text-xl font-bold text-[var(--ink)]">{graph.edges.length}</p>
              </div>
              <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3">
                <p className="text-xs text-[var(--muted)]">Evidence Events</p>
                <p className="mt-1 text-xl font-bold text-[var(--ink)]">{events.length}</p>
              </div>
            </div>

            <p className="mt-4 text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Latest Evidence</p>
            <div className="mt-2 space-y-2">
              {events.slice(0, 5).map((event) => (
                <div key={event.id} className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-2">
                  <p className="text-xs font-semibold text-[var(--ink)]">{event.title}</p>
                  <p className="mt-1 text-[11px] text-[var(--muted)]">{event.feature} - {formatTimestamp(event.createdAt)}</p>
                </div>
              ))}
              {events.length === 0 ? <p className="text-sm text-[var(--muted)]">No saved evidence yet.</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
