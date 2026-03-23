"use client";

import { getActiveCaseId } from "@/lib/case-client";
import { useActiveCaseId } from "@/lib/use-active-case";
import { formatTimestamp } from "@/lib/onchain-format";
import MermaidDiagram from "@/components/dashboard/MermaidDiagram";
import { useMemo, useState } from "react";

type ReportPack = {
  markdown: string;
  mermaid: string;
  summary: string;
};

export default function GenerateReportPage() {
  const activeCaseIdHook = useActiveCaseId();
  const [caseTitle, setCaseTitle] = useState("");
  const [target, setTarget] = useState("");
  const [summary, setSummary] = useState("");
  const [findings, setFindings] = useState("");
  const [evidenceNarrative, setEvidenceNarrative] = useState("");
  const [loadingPack, setLoadingPack] = useState(false);
  const [packMessage, setPackMessage] = useState<string | null>(null);
  const [reportPack, setReportPack] = useState<ReportPack | null>(null);

  const report = useMemo(() => {
    const findingsList = findings
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => `- ${line}`)
      .join("\n");

    return `# ${caseTitle || "Investigation Report"}\n\nGenerated: ${formatTimestamp(new Date())}\n\n## Target\n${target || "N/A"}\n\n## Executive Summary\n${summary || "N/A"}\n\n## Key Findings\n${findingsList || "- N/A"}\n\n## Evidence Narrative\n${evidenceNarrative || "No narrative evidence entered."}\n`;
  }, [caseTitle, target, summary, findings, evidenceNarrative]);

  const copy = async () => {
    await navigator.clipboard.writeText(report);
  };

  const download = () => {
    const blob = new Blob([report], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(caseTitle || "investigation-report").toLowerCase().replace(/\s+/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateFromCase = async () => {
    const activeCaseId = activeCaseIdHook || getActiveCaseId();
    if (!activeCaseId) {
      setPackMessage("Select an active case first.");
      return;
    }

    setLoadingPack(true);
    setPackMessage(null);
    try {
      const response = await fetch(`/api/cases/${activeCaseId}/report-pack`);
      if (!response.ok) {
        throw new Error("Failed to generate case report pack");
      }
      const data = await response.json();
      const pack = data.pack as ReportPack;
      setReportPack(pack);
      setSummary(pack.summary);
      setEvidenceNarrative("Auto-assembled from saved profile, trace, and cluster evidence events.");
      setPackMessage("Case report pack generated. Review and export below.");
    } catch (err) {
      setPackMessage(err instanceof Error ? err.message : "Failed to generate case report pack");
    } finally {
      setLoadingPack(false);
    }
  };

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Feature 05</p>
      <h1 className="mt-2 text-3xl font-bold text-[var(--ink)]">Generate Report</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Build an exportable narrative report and one-click case pack for review.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={generateFromCase}
          disabled={loadingPack}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-50"
        >
          {loadingPack ? "Building Pack..." : "Build From Active Case"}
        </button>
      </div>
      {packMessage ? <p className="mt-2 text-sm text-[var(--muted)]">{packMessage}</p> : null}

      <div className="mt-6 grid gap-3">
        <input
          value={caseTitle}
          onChange={(e) => setCaseTitle(e.target.value)}
          placeholder="Case title"
          className="rounded-lg border border-[var(--line)] bg-white px-3 py-2"
        />
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="Target address or entity"
          className="rounded-lg border border-[var(--line)] bg-white px-3 py-2"
        />
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Executive summary"
          className="min-h-[90px] rounded-lg border border-[var(--line)] bg-white px-3 py-2"
        />
        <textarea
          value={findings}
          onChange={(e) => setFindings(e.target.value)}
          placeholder="One finding per line"
          className="min-h-[120px] rounded-lg border border-[var(--line)] bg-white px-3 py-2"
        />
        <textarea
          value={evidenceNarrative}
          onChange={(e) => setEvidenceNarrative(e.target.value)}
          placeholder="Write evidence narrative and interpretation"
          className="min-h-[140px] rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <button
            onClick={copy}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-white hover:bg-[var(--accent-strong)]"
          >
            Copy Markdown
          </button>
          <button
            onClick={download}
            className="rounded-lg border border-[var(--line)] bg-white px-4 py-2 font-semibold"
          >
            Download .md
          </button>
        </div>
      </div>

      {reportPack ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Auto Pack Markdown</p>
            <pre className="mt-2 max-h-[420px] overflow-auto text-xs">{reportPack.markdown}</pre>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-white p-4">
            <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Graph Diagram (Mermaid)</p>
            <div className="mt-2">
              <MermaidDiagram chart={reportPack.mermaid} />
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold text-[var(--muted)]">Show Mermaid source</summary>
              <pre className="mt-2 max-h-[220px] overflow-auto text-xs">{reportPack.mermaid}</pre>
            </details>
          </div>
        </div>
      ) : null}

      <div className="mt-6 rounded-xl border border-[var(--line)] bg-white p-4">
        <pre className="max-h-[520px] overflow-auto text-xs">{report}</pre>
      </div>
    </div>
  );
}
