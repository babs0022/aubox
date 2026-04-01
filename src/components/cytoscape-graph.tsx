import { useEffect, useRef, useState } from "react";
import cytoscape from "cytoscape";
import type { FundFlowNode, FundFlowEdge } from "@/app/api/fund-flow/trace/route";
import coseBilkent from "cytoscape-cose-bilkent";

// Register the COSE-Bilkent layout
cytoscape.use(coseBilkent);

interface CytoscapeGraphProps {
  nodes: FundFlowNode[];
  edges: FundFlowEdge[];
}

type CyNodeType = cytoscape.NodeDefinition;
type CyEdgeType = cytoscape.EdgeDefinition;

const nodeTypeColors: Record<string, string> = {
  wallet: "#ef4444", // red
  bridge: "#f59e0b", // amber
  exchange: "#8b5cf6", // purple
  dex: "#10b981", // emerald
  staking: "#3b82f6", // blue
  contract: "#6b7280", // gray
  unknown: "#9ca3af", // gray
};

export default function CytoscapeGraph({ nodes, edges }: CytoscapeGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [selectedNode, setSelectedNode] = useState<FundFlowNode | null>(null);

  useEffect(() => {
    if (!containerRef.current || nodes.length === 0) return;

    // Transform nodes
    const cyNodes: CyNodeType[] = nodes.map((node) => ({
      data: {
        id: node.id,
        label: node.label,
        nodeType: node.nodeType,
        totalUsd: node.totalUsd,
        txCount: node.txCount,
      },
    }));

    // Transform edges
    const cyEdges: CyEdgeType[] = edges.map((edge, idx) => ({
      data: {
        id: `edge-${idx}`,
        source: edge.source,
        target: edge.target,
        amount: edge.amount,
        txCount: edge.txCount,
        label: `$${edge.amount.toFixed(0)}`,
      },
    }));

    // Create Cytoscape instance
    const cy = cytoscape({
      container: containerRef.current,
      elements: [...cyNodes, ...cyEdges],
      style: [
        {
          selector: "node",
          style: {
            "background-color": (node: cytoscape.NodeSingular) => nodeTypeColors[node.data("nodeType") as string] || nodeTypeColors.unknown,
            "border-color": "#fff",
            "border-width": 2,
            "label": "data(label)",
            "text-valign": "center",
            "text-halign": "center",
            "font-size": 11,
            "color": "#fff",
            "text-outline-color": (node: cytoscape.NodeSingular) => nodeTypeColors[node.data("nodeType") as string] || nodeTypeColors.unknown,
            "text-outline-width": 2,
            "width": (node: cytoscape.NodeSingular) => {
              if (node.data("nodeType") === "wallet") return 40;
              return 30;
            },
            "height": (node: cytoscape.NodeSingular) => {
              if (node.data("nodeType") === "wallet") return 40;
              return 30;
            },
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-width": 4,
            "border-color": "#000",
          },
        },
        {
          selector: "edge",
          style: {
            "line-color": "#d1d5db",
            "target-arrow-color": "#d1d5db",
            "target-arrow-shape": "triangle-backcurve",
            "curve-style": "bezier",
            "width": (edge: cytoscape.EdgeSingular) => {
              // Scale width by transaction count (1-5px)
              const txCount = Number(edge.data("txCount") || 0);
              return Math.min(5, Math.max(1, txCount / 10));
            },
            "label": "data(label)",
            "font-size": 10,
            "text-background-color": "#fff",
            "text-background-opacity": 0.8,
            "text-background-padding": "2px",
          },
        },
        {
          selector: "edge:selected",
          style: {
            "line-color": "#3b82f6",
            "target-arrow-color": "#3b82f6",
            "width": 3,
          },
        },
      ],
      layout: {
        name: "cose-bilkent",
        animate: true,
        animationDuration: 500,
        animateFilter: (_node: cytoscape.NodeSingular, i: number) => i % 2 === 0,
        randomize: false,
        nodeSpacing: 10,
        piTol: 0.1,
        numIter: 2500,
        nodeRepulsion: 100000,
        idealEdgeLength: 100,
        edge: "data()",
        directed: true,
      } as cytoscape.LayoutOptions,
    });

    cyRef.current = cy;

    // Event handlers
    cy.on("tap", "node", function (event) {
      const node = event.target;
      const nodeData = node.data() as { id: string };
      
      // Find the original node object
      const originalNode = nodes.find((n) => n.id === nodeData.id);
      if (originalNode) {
        setSelectedNode(originalNode);
      }

      // Highlight neighbors
      cy.elements().style({ "opacity": 0.3 });
      node.style({ "opacity": 1 });
      node.neighbors().style({ "opacity": 1 });
      node.connectedEdges().style({ "opacity": 1 });
    });

    cy.on("tap", "edge", function (event) {
      const edge = event.target;
      cy.elements().style({ "opacity": 0.3 });
      edge.style({ "opacity": 1 });
      edge.source().style({ "opacity": 1 });
      edge.target().style({ "opacity": 1 });
    });

    cy.on("tap", function () {
      // Clear selection on background tap
      cy.elements().style({ "opacity": 1 });
      setSelectedNode(null);
    });

    // Fit graph to view
    cy.fit();
    cy.center();

    return () => {
      cy.destroy();
    };
  }, [nodes, edges]);

  return (
    <div className="w-full flex gap-4">
      {/* Graph Container */}
      <div ref={containerRef} className="flex-1" style={{ minHeight: "600px" }} />

      {/* Details Panel */}
      {selectedNode && (
        <div className="w-64 bg-gray-50 border-l p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Node Details</h3>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {/* Node Type Badge */}
          <div className="mb-4">
            <span
              className="inline-block px-3 py-1 rounded-full text-xs text-white capitalize font-medium"
              style={{ backgroundColor: nodeTypeColors[selectedNode.nodeType] }}
            >
              {selectedNode.nodeType}
            </span>
          </div>

          {/* Address */}
          <div className="mb-4">
            <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Address</p>
            <p className="font-mono text-xs break-all bg-white p-2 rounded border">
              {selectedNode.address || selectedNode.id}
            </p>
          </div>

          {/* Label */}
          <div className="mb-4">
            <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Name</p>
            <p className="text-sm font-medium">{selectedNode.label}</p>
          </div>

          {/* Protocol Name */}
          {selectedNode.protocolName && (
            <div className="mb-4">
              <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Protocol</p>
              <p className="text-sm">{selectedNode.protocolName}</p>
            </div>
          )}

          {/* Chain */}
          <div className="mb-4">
            <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Chain</p>
            <p className="text-sm capitalize">{selectedNode.chain}</p>
          </div>

          {/* Total USD */}
          <div className="mb-4 p-3 bg-blue-50 rounded">
            <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Total Flow</p>
            <p className="text-lg font-bold text-blue-700">${selectedNode.totalUsd?.toFixed(0)}</p>
          </div>

          {/* Transaction Count */}
          <div className="mb-4 p-3 bg-green-50 rounded">
            <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Transactions</p>
            <p className="text-lg font-bold text-green-700">{selectedNode.txCount}</p>
          </div>
        </div>
      )}
    </div>
  );
}
