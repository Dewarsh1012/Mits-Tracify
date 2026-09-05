import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Filter,
  Eye,
  Sparkles,
  Shield,
  Layers,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { truncateAddress } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import type {
  GraphEdge,
  GraphNode,
  InvestigationGraph,
  NodeKind,
  TracePath,
} from "@/services/intelligence";

const KIND_STYLE: Record<NodeKind, { fill: string; stroke: string; glow?: string }> = {
  target: { fill: "var(--critical)", stroke: "var(--critical)", glow: "rgba(255, 92, 108, 0.4)" },
  wallet: { fill: "var(--elevated)", stroke: "var(--border-strong)" },
  intermediary: { fill: "var(--elevated)", stroke: "var(--border-strong)" },
  candidate_entity: { fill: "var(--elevated)", stroke: "var(--warning)", glow: "rgba(255, 184, 77, 0.3)" },
  vasp: { fill: "var(--elevated)", stroke: "var(--positive)", glow: "rgba(61, 220, 151, 0.35)" },
  bridge: { fill: "var(--elevated)", stroke: "var(--intel)", glow: "rgba(139, 124, 255, 0.35)" },
};

export const NODE_KIND_LABEL: Record<NodeKind, string> = {
  target: "Target wallet",
  wallet: "Wallet",
  intermediary: "Intermediary",
  candidate_entity: "Candidate entity",
  vasp: "Attributed VASP",
  bridge: "Bridge contract",
};

export function GraphCanvas({
  graph,
  paths,
  focusedPath,
  selectedId,
  minRelevance = 0,
  maxTimeSeconds = Infinity,
  onSelectNode,
  onSelectEdge,
  onToggleFocus,
}: {
  graph: InvestigationGraph;
  paths: TracePath[];
  focusedPath: string | null;
  selectedId: string | null;
  minRelevance?: number;
  maxTimeSeconds?: number;
  onSelectNode: (node: GraphNode) => void;
  onSelectEdge: (edge: GraphEdge) => void;
  onToggleFocus?: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isNoiseFiltered, setIsNoiseFiltered] = useState(false);

  const focusedNodeIds = useMemo(() => {
    if (!focusedPath) return null;
    const path = paths.find((p) => p.id === focusedPath);
    return path ? new Set(path.nodeIds) : null;
  }, [focusedPath, paths]);

  const dim = (id: string) => Boolean(focusedNodeIds && !focusedNodeIds.has(id));

  const handleZoomIn = () => setZoom((z) => Math.min(2.2, z + 0.2));
  const handleZoomOut = () => setZoom((z) => Math.max(0.6, z - 0.2));
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="canvas-grid relative h-[520px] w-full overflow-hidden rounded-xl border border-border bg-workspace select-none">
      {/* Floating Graph Controls (Top Left & Bottom Left - Blueprint Page 104) */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-border/80 bg-surface/85 p-1 backdrop-blur-md shadow-lg">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded"
            onClick={handleZoomIn}
            title="Zoom In"
          >
            <ZoomIn className="size-3.5 text-muted-foreground hover:text-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded"
            onClick={handleZoomOut}
            title="Zoom Out"
          >
            <ZoomOut className="size-3.5 text-muted-foreground hover:text-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded"
            onClick={handleReset}
            title="Reset View"
          >
            <RotateCcw className="size-3.5 text-muted-foreground hover:text-foreground" />
          </Button>
        </div>

        {/* Noise Filter Toggle Button */}
        <Button
          variant={isNoiseFiltered ? "default" : "outline"}
          size="sm"
          className="h-8 text-xs gap-1.5 backdrop-blur-md shadow-md"
          onClick={() => setIsNoiseFiltered((f) => !f)}
        >
          <Filter className="size-3" />
          {isNoiseFiltered ? "Noise Suppressed" : "Filter Low Value"}
        </Button>

        {/* Focus Mode Indicator */}
        {focusedPath && (
          <Button
            variant="secondary"
            size="sm"
            className="h-8 text-xs gap-1.5 border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 backdrop-blur-md"
            onClick={onToggleFocus}
          >
            <Eye className="size-3" />
            Path Focus Active
          </Button>
        )}
      </div>

      {/* Main SVG Graph Surface */}
      <motion.div
        className="h-full w-full cursor-grab active:cursor-grabbing flex items-center justify-center"
        animate={{ scale: zoom, x: pan.x, y: pan.y }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <svg
          viewBox="0 0 1000 420"
          className="h-full w-full max-w-[1000px] overflow-visible"
          role="img"
          aria-label="Bounded investigation graph of traced fund movement"
        >
          <defs>
            <marker
              id="vt-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--border-strong)" />
            </marker>
            <marker
              id="vt-arrow-active"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--primary)" />
            </marker>
            <radialGradient id="target-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--critical)" stopOpacity="0.55" />
              <stop offset="100%" stopColor="var(--critical)" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="vasp-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--positive)" stopOpacity="0.4" />
              <stop offset="100%" stopColor="var(--positive)" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Hop guide rails */}
          {Array.from({ length: graph.bounds.hops + 1 }).map((_, hop) => {
            const node = graph.nodes.find((n) => n.hop === hop);
            if (!node) return null;
            return (
              <g key={`hop-${hop}`}>
                <line
                  x1={node.x}
                  y1={16}
                  x2={node.x}
                  y2={404}
                  stroke="var(--border)"
                  strokeDasharray="2 6"
                />
                <text
                  x={node.x}
                  y={12}
                  textAnchor="middle"
                  className="mono"
                  fontSize="9"
                  fill="var(--muted-foreground)"
                >
                  {hop === 0 ? "TARGET ROOT" : `HOP ${hop}`}
                </text>
              </g>
            );
          })}

          {/* Edges */}
          {graph.edges.map((edge) => {
            const from = graph.nodes.find((n) => n.id === edge.from);
            const to = graph.nodes.find((n) => n.id === edge.to);
            if (!from || !to) return null;

            // Low relevance noise filter check
            if (isNoiseFiltered && edge.continuity < 0.35) return null;

            const isPathActive = Boolean(
              focusedPath && edge.pathIds && edge.pathIds.includes(focusedPath)
            );
            const faded = dim(from.id) || dim(to.id);
            const mid = (from.x + to.x) / 2;

            return (
              <g
                key={edge.id}
                className="cursor-pointer group"
                opacity={faded ? 0.12 : isPathActive ? 1 : 0.85}
                onClick={() => onSelectEdge(edge)}
              >
                {/* Hit area line */}
                <path
                  d={`M ${from.x + 26} ${from.y} C ${mid} ${from.y}, ${mid} ${to.y}, ${to.x - 28} ${to.y}`}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={14}
                />
                {/* Visual line */}
                <path
                  d={`M ${from.x + 26} ${from.y} C ${mid} ${from.y}, ${mid} ${to.y}, ${to.x - 28} ${to.y}`}
                  fill="none"
                  stroke={
                    isPathActive
                      ? "var(--primary)"
                      : edge.continuity > 0.7
                        ? "var(--positive)"
                        : edge.continuity > 0.45
                          ? "var(--warning)"
                          : "var(--border-strong)"
                  }
                  strokeWidth={isPathActive ? 3.5 : 1.2 + edge.continuity * 2.2}
                  strokeDasharray={edge.continuity < 0.4 ? "4 3" : undefined}
                  markerEnd={isPathActive ? "url(#vt-arrow-active)" : "url(#vt-arrow)"}
                  className="transition-all duration-300"
                />
                {/* Edge transfer value label */}
                <g transform={`translate(${mid}, ${(from.y + to.y) / 2 - 8})`}>
                  <rect
                    x={-28}
                    y={-8}
                    width={56}
                    height={14}
                    rx={3}
                    fill="var(--background)"
                    stroke="var(--border)"
                    strokeWidth={0.8}
                    opacity={0.9}
                  />
                  <text
                    x={0}
                    y={2}
                    textAnchor="middle"
                    className="mono"
                    fontSize="8.5"
                    fill={isPathActive ? "var(--primary)" : "var(--foreground)"}
                  >
                    {edge.value}
                  </text>
                </g>
              </g>
            );
          })}

          {/* Nodes */}
          {graph.nodes.map((node, i) => {
            const style = KIND_STYLE[node.kind];
            const selected = selectedId === node.id;
            const isTarget = node.kind === "target";
            const isVasp = node.kind === "vasp" || node.kind === "candidate_entity";
            const isFaded = dim(node.id);

            return (
              <motion.g
                key={node.id}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: isFaded ? 0.18 : 1, scale: 1 }}
                transition={{ delay: i * 0.02, duration: 0.25 }}
                className="cursor-pointer group"
                onClick={() => onSelectNode(node)}
              >
                {/* Ambient Radial Glow for Target & VASP endpoints (Page 103) */}
                {isTarget && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={44}
                    fill="url(#target-glow)"
                    className="animate-pulse"
                  />
                )}
                {isVasp && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={36}
                    fill="url(#vasp-glow)"
                  />
                )}

                {/* Selected Outer Ring Indicator */}
                {selected && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={isTarget ? 32 : 26}
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                    className="animate-spin-slow"
                  />
                )}

                {/* Node Main Shape */}
                {node.kind === "vasp" ? (
                  // Verified Entity: Rounded Square (Blueprint Page 103)
                  <rect
                    x={node.x - 16}
                    y={node.y - 16}
                    width={32}
                    height={32}
                    rx={6}
                    fill={style.fill}
                    stroke={style.stroke}
                    strokeWidth={2}
                  />
                ) : node.kind === "candidate_entity" ? (
                  // Candidate Entity: Dashed Border Square
                  <rect
                    x={node.x - 15}
                    y={node.y - 15}
                    width={30}
                    height={30}
                    rx={5}
                    fill={style.fill}
                    stroke={style.stroke}
                    strokeWidth={1.8}
                    strokeDasharray="3 2"
                  />
                ) : (
                  // Target / Intermediary Wallet: Circle
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={isTarget ? 22 : 16}
                    fill={style.fill}
                    stroke={style.stroke}
                    strokeWidth={isTarget ? 2.8 : 1.8}
                  />
                )}

                {/* Node Center Label */}
                <text
                  x={node.x}
                  y={node.y + 3.5}
                  textAnchor="middle"
                  className="mono font-semibold"
                  fontSize={isTarget ? "10" : "9"}
                  fill="var(--foreground)"
                >
                  {isTarget ? "T" : node.kind === "vasp" ? "◆" : `${node.hop}`}
                </text>

                {/* Primary Entity / Wallet Label */}
                <text
                  x={node.x}
                  y={node.y + (isTarget ? 38 : 34)}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="600"
                  fill="var(--foreground)"
                  className="transition-colors group-hover:fill-primary"
                >
                  {node.label}
                </text>

                {/* Truncated Address */}
                <text
                  x={node.x}
                  y={node.y + (isTarget ? 50 : 46)}
                  textAnchor="middle"
                  className="mono"
                  fontSize="8"
                  fill="var(--muted-foreground)"
                >
                  {truncateAddress(node.address, 6, 4)}
                </text>
              </motion.g>
            );
          })}
        </svg>
      </motion.div>

      {/* Legend Badge Bar (Bottom Left - Blueprint Page 102) */}
      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-3 rounded-lg border border-border/80 bg-surface/90 px-3.5 py-2 text-[10px] backdrop-blur-md shadow-md">
        {(
          [
            ["target", "Target Wallet"],
            ["intermediary", "Intermediary"],
            ["bridge", "Bridge Protocol"],
            ["candidate_entity", "Candidate VASP"],
            ["vasp", "Attributed VASP"],
          ] as [NodeKind, string][]
        ).map(([kind, label]) => (
          <span key={kind} className="flex items-center gap-1.5">
            <span
              className={cn("size-2.5 rounded-full border")}
              style={{
                borderColor: KIND_STYLE[kind].stroke,
                background:
                  kind === "target" ? KIND_STYLE[kind].fill : "transparent",
              }}
            />
            <span className="text-muted-foreground font-medium">{label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
