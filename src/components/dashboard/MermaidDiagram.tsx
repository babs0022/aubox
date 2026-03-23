"use client";

import { useEffect, useMemo, useState } from "react";

type MermaidDiagramProps = {
  chart: string;
};

export default function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const normalizedChart = useMemo(() => chart.trim(), [chart]);

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      if (!normalizedChart) {
        setSvg("");
        setError(null);
        return;
      }

      try {
        const mermaidModule = await import("mermaid");
        const mermaid = mermaidModule.default;

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "loose",
          theme: "default",
        });

        const id = `mermaid-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const { svg: renderedSvg } = await mermaid.render(id, normalizedChart);

        if (!cancelled) {
          setSvg(renderedSvg);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setSvg("");
          setError(err instanceof Error ? err.message : "Failed to render Mermaid diagram.");
        }
      }
    };

    void render();

    return () => {
      cancelled = true;
    };
  }, [normalizedChart]);

  if (error) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-700">
        Mermaid render failed: {error}
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3 text-xs text-[var(--muted)]">
        Rendering diagram...
      </div>
    );
  }

  return (
    <div
      className="overflow-x-auto rounded-lg border border-[var(--line)] bg-white p-3"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

