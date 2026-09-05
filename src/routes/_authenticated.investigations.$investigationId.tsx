import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Clock,
  Copy,
  FileText,
  Fingerprint,
  Layers,
  Pin,
  Route as RouteIcon,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Compass,
  ExternalLink,
  Vault,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Chip,
  InvestigationStatusBadge,
  Mono,
  SeverityBadge,
} from "@/components/vt/badges";
import { GraphCanvas, NODE_KIND_LABEL } from "@/components/vt/GraphCanvas";
import { ReportBuilderDialog } from "@/components/vt/ReportBuilderDialog";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  StatTile,
} from "@/components/vt/states";
import {
  createEvidence,
  createFinding,
  evidenceQuery,
  findingsQuery,
  investigationQuery,
  casesQuery,
} from "@/lib/api/queries";
import { chainLabel, truncateAddress } from "@/lib/domain";
import { intelligence } from "@/services/intelligence";
import type { GraphEdge, GraphNode } from "@/services/intelligence";
import { getExplorerTxUrl, getExplorerAddressUrl } from "@/lib/explorer";
import {
  addressIntelligenceQuery,
  addressNeighboursQuery,
} from "@/lib/api/backend";
import { useUIStore, useWorkspaceStore } from "@/stores/ui";

/** Formats a possibly-missing USD amount without crashing on undefined. */
function usd(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value)
    ? `$${Math.round(value).toLocaleString()}`
    : "—";
}

export const Route = createFileRoute(
  "/_authenticated/investigations/$investigationId",
)({
  head: () => ({
    meta: [
      { title: "Investigation workspace — TRACIFY" },
      {
        name: "description",
        content:
          "The investigation workspace: a bounded fund-flow graph, ranked value-continuity paths, entity and VASP attribution candidates, behavioural signals and a chronological timeline.",
      },
      { property: "og:title", content: "Investigation workspace — TRACIFY" },
      {
        property: "og:description",
        content:
          "Bounded fund-flow graph, ranked paths, attribution candidates and behavioural signals in one investigative canvas.",
      },
    ],
  }),
  component: WorkspacePage,
  errorComponent: ({ error }) => (
    <div className="space-y-4 p-6">
      <ErrorState
        message={error instanceof Error ? error.message : "Failed to load investigation workspace."}
      />
      <div className="flex items-center gap-3">
        <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
        <Link to="/investigations" className="text-xs text-primary hover:underline">
          ← Back to investigations
        </Link>
      </div>
    </div>
  ),
});

function copy(value: string) {
  void navigator.clipboard.writeText(value);
  toast.success("Copied to clipboard.");
}

function WorkspacePage() {
  const { investigationId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const selection = useWorkspaceStore((s) => s.selection);
  const select = useWorkspaceStore((s) => s.select);
  const focusedPath = useWorkspaceStore((s) => s.focusedPath);
  const setFocusedPath = useWorkspaceStore((s) => s.setFocusedPath);
  const openInvestigationModal = useUIStore((s) => s.openInvestigationModal);

  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [activeTimelineFilter, setActiveTimelineFilter] = useState<string | null>(null);

  const investigation = useQuery(investigationQuery(investigationId));
  const cases = useQuery(casesQuery());
  const invFindings = useQuery(findingsQuery({ investigationId }));
  const invEvidence = useQuery(evidenceQuery({ investigationId }));

  const liveAnalysis = useQuery({
    queryKey: [
      "live-investigation-graph",
      investigation.data?.id,
      investigation.data?.target_address,
      investigation.data?.blockchain,
      investigation.data?.trace_depth,
    ],
    queryFn: async () => {
      if (!investigation.data) return null;
      return intelligence.buildLiveGraph(investigation.data);
    },
    enabled: Boolean(investigation.data?.target_address),
    staleTime: 5 * 60 * 1000,
  });

  const analysis = useMemo(() => {
    if (!investigation.data) return null;
    const findings = Array.isArray(invFindings.data) ? invFindings.data : [];
    const evidence = Array.isArray(invEvidence.data) ? invEvidence.data : [];

    if (liveAnalysis.data) {
      const live = liveAnalysis.data;
      const combinedEntities =
        live.entities.length > 0
          ? live.entities
          : intelligence.entities.candidates(live.graph, findings.length > 0 ? findings : undefined);

      const combinedSignals =
        live.signals.length > 0
          ? live.signals
          : intelligence.risk.signals(live.graph, findings.length > 0 ? findings : undefined);

      const combinedTimeline =
        evidence.length > 0
          ? intelligence.timeline(live.graph, evidence)
          : live.timeline;

      return {
        graph: live.graph,
        paths: live.paths,
        entities: combinedEntities,
        signals: combinedSignals,
        timeline: combinedTimeline,
        isLive: true,
        rawTxs: live.rawTransactions,
        generatedFindings: live.generatedFindings,
      };
    }

    try {
      const graph = intelligence.graph.build(investigation.data);
      return {
        graph,
        paths: intelligence.paths.rank(graph, investigation.data),
        entities: intelligence.entities.candidates(graph, findings.length > 0 ? findings : undefined),
        signals: intelligence.risk.signals(graph, findings.length > 0 ? findings : undefined),
        timeline: intelligence.timeline(graph, evidence.length > 0 ? evidence : undefined),
        isLive: false,
        rawTxs: [],
        generatedFindings: [],
      };
    } catch (err) {
      console.error("[Workspace] Failed to construct analysis graph:", err);
      return null;
    }
  }, [investigation.data, liveAnalysis.data, invFindings.data, invEvidence.data]);

  const caseObj = useMemo(() => {
    if (!investigation.data || !cases.data) return null;
    return cases.data.find((c) => c.id === investigation.data?.case_id) ?? null;
  }, [investigation.data, cases.data]);

  const pinEvidence = useMutation({
    mutationFn: (input: { title: string; description: string; type: string }) =>
      createEvidence({
        investigation_id: investigationId,
        case_id: investigation.data?.case_id ?? null,
        title: input.title,
        evidence_type: input.type,
        description: input.description,
        source: `TRACIFY workspace · ${investigation.data?.investigation_ref ?? ""}`,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["evidence"] });
      toast.success("Pinned to the evidence vault.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const autoPinEvidence = useMutation({
    mutationFn: async () => {
      if (!investigation.data) return;
      const inv = investigation.data;
      const caseId = inv.case_id ?? null;
      const rawTxs = analysis?.rawTxs ?? [];

      // 1. Pin Target Wallet Profile
      await createEvidence({
        investigation_id: investigationId,
        case_id: caseId,
        title: `Target Wallet: ${truncateAddress(inv.target_address)}`,
        evidence_type: "wallet",
        description: `Suspect address on ${chainLabel(inv.blockchain)}: ${inv.target_address}. Traced with ${rawTxs.length} direct transfers indexed via live explorer.`,
        source: `Blockscout · ${chainLabel(inv.blockchain)}`,
        metadata: {
          address: inv.target_address,
          blockchain: inv.blockchain,
          explorerUrl: getExplorerAddressUrl(inv.blockchain, inv.target_address),
          indexedAt: new Date().toISOString(),
        },
      });

      // 2. Pin up to 4 significant transactions
      for (const tx of rawTxs.slice(0, 4)) {
        await createEvidence({
          investigation_id: investigationId,
          case_id: caseId,
          title: `On-Chain Transfer: ${truncateAddress(tx.hash)}`,
          evidence_type: "transaction",
          description: `Cryptographic proof: ${Number(tx.value || 0).toFixed(4)} native units from ${truncateAddress(tx.from)} to ${truncateAddress(tx.to)}. Block: ${tx.blockNumber}.`,
          source: `Blockscout · ${chainLabel(inv.blockchain)}`,
          metadata: {
            hash: tx.hash,
            from: tx.from,
            to: tx.to,
            value: tx.value,
            blockNumber: tx.blockNumber,
            timestamp: tx.timestamp,
            explorerUrl: getExplorerTxUrl(inv.blockchain, tx.hash),
          },
        });
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["evidence"] });
      toast.success("Pinned on-chain wallet & key transactions to Evidence Vault!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const recordFinding = useMutation({
    mutationFn: (input: {
      title: string;
      description: string;
      severity: string;
      confidence: number;
      type: string;
    }) =>
      createFinding({
        investigation_id: investigationId,
        case_id: investigation.data?.case_id ?? null,
        title: input.title,
        description: input.description,
        severity: input.severity,
        confidence: input.confidence,
        finding_type: input.type,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["findings"] });
      toast.success("Finding recorded against this case.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Hooks must run on every render, so live lookups sit above the early returns.
  const selectedNodeEarly: GraphNode | null =
    selection.kind === "wallet"
      ? (analysis?.graph?.nodes.find((n) => n.id === selection.id) ?? null)
      : null;

  const liveIntel = useQuery(
    addressIntelligenceQuery(
      investigation.data?.blockchain ?? "ethereum",
      selectedNodeEarly?.address ?? "",
      Boolean(selectedNodeEarly && investigation.data),
    ),
  );

  const liveNeighbours = useQuery(
    addressNeighboursQuery(
      investigation.data?.blockchain ?? "ethereum",
      selectedNodeEarly?.address ?? "",
      "out",
      5,
      Boolean(selectedNodeEarly && investigation.data),
    ),
  );

  if (investigation.isLoading) return <LoadingState rows={5} />;
  if (investigation.error)
    return <ErrorState message={investigation.error.message} />;
  if (!investigation.data || !analysis)
    return <ErrorState message="Investigation not found." />;

  const record = investigation.data;
  const { graph, paths, entities, signals, timeline } = analysis;

  const selectedNode = selectedNodeEarly;
  const primaryPath = paths ? paths[0] : null;


  const handleTraceFromNode = (address: string) => {
    openInvestigationModal(record.case_id);
    toast.info(`Opening new trace starting from ${truncateAddress(address, 6, 4)}`);
  };

  const handleTimelineClick = (eventId: string, nodeId?: string, pathId?: string) => {
    setActiveTimelineFilter((prev) => (prev === eventId ? null : eventId));
    if (nodeId) {
      const targetNode = graph.nodes.find((n) => n.id === nodeId);
      if (targetNode) {
        setSelectedEdge(null);
        select("wallet", targetNode.id);
      }
    }
    if (pathId) {
      setFocusedPath(pathId);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link
          to="/cases/$caseId"
          params={{ caseId: record.case_id }}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back to case file ({caseObj?.case_ref || "Case"})
        </Link>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setReportDialogOpen(true)}
            className="text-xs gap-1.5 border-border hover:border-primary/50"
          >
            <FileText className="size-3.5 text-primary" />
            Generate Dossier Report
          </Button>
        </div>
      </div>

      {/* Workspace header */}
      <header className="panel px-5 py-4.5 bg-surface/40">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Mono className="text-muted-foreground font-semibold">
                {record.investigation_ref}
              </Mono>
              <InvestigationStatusBadge status={record.status} />
              <Chip tone="neutral">{chainLabel(record.blockchain)}</Chip>
              <Chip tone="intel">{record.trace_depth}-hop bounded graph</Chip>
              {analysis.isLive ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Real-Time On-Chain Data ({analysis.rawTxs.length} txs indexed)
                </span>
              ) : liveAnalysis.isLoading ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] text-amber-400">
                  <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
                  Syncing Live On-Chain Data...
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-2.5 py-0.5 text-[11px] text-muted-foreground">
                  Deterministic Baseline
                </span>
              )}
            </div>
            <h1 className="mt-2 text-xl font-bold tracking-tight text-foreground">
              {record.name}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              <button
                onClick={() => copy(record.target_address)}
                className="mono inline-flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground group"
                title="Click to copy target address"
              >
                <span>Subject Root:</span>
                <span className="text-foreground group-hover:underline font-medium">
                  {record.target_address}
                </span>
                <Copy className="size-3 text-muted-foreground group-hover:text-foreground" />
              </button>
              <a
                href={getExplorerAddressUrl(record.blockchain, record.target_address)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
              >
                Explorer <ExternalLink className="size-3" />
              </a>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pinEvidence.isPending}
              onClick={() =>
                pinEvidence.mutate({
                  title: `Graph snapshot — ${record.investigation_ref}`,
                  description: `Bounded graph at ${graph.bounds.hops} hops: ${graph.nodes.length} addresses, ${graph.edges.length} traced transfers.`,
                  type: "graph_snapshot",
                })
              }
            >
              <Pin className="size-3.5" />
              Pin Snapshot
            </Button>
            <Button
              size="sm"
              disabled={recordFinding.isPending || !primaryPath}
              onClick={() =>
                primaryPath &&
                recordFinding.mutate({
                  title: `Primary path terminates at ${(NODE_KIND_LABEL[primaryPath.endpointKind] ?? "unknown endpoint").toLowerCase()}`,
                  description: `${primaryPath.verdict} ${primaryPath.valuePreserved} preserved across ${primaryPath.hops} hops (continuity ${(primaryPath.continuity * 100).toFixed(0)}%).`,
                  severity: primaryPath.continuity > 0.7 ? "high" : "medium",
                  confidence: primaryPath.confidence,
                  type: "path_continuity",
                })
              }
            >
              <Sparkles className="size-3.5" />
              Record Finding
            </Button>
          </div>
        </div>

        {record.status === "processing" ? (() => {
          const completedHops = ((record.summary as Record<string, unknown> | null)?.['hops'] as number | undefined) ?? 1;
          const totalHops = record.trace_depth ?? 3;
          const progressPct = Math.round((completedHops / totalHops) * 100);
          return (
            <div className="mt-4 pt-3 border-t border-border/50">
              <div className="mb-1.5 flex justify-between text-[10px] text-muted-foreground">
                <span>Automated pipeline: Ingesting on-chain transfers and normalizing graph</span>
                <span className="mono">Hop {completedHops} / {totalHops}</span>
              </div>
              <Progress value={progressPct} className="h-1.5" />
            </div>
          );
        })() : null}
      </header>

      {/* KPI Tiles */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Addresses in Scope"
          value={graph.nodes.length}
          hint={`bounded at ${graph.bounds.hops} hops`}
        />
        <StatTile
          label="Traced Transfers"
          value={graph.edges.length}
          hint="verified on-chain records"
        />
        <StatTile
          label="Value Paths"
          value={paths.length}
          hint="ranked by continuity score"
          tone="intel"
        />
        <StatTile
          label="Attributed VASP Candidates"
          value={entities.length}
          hint="actionable endpoints"
          tone="positive"
        />
      </div>

      {/* Main Workspace Layout (Blueprint Pages 100-105: 2-Column Desktop Grid) */}
      <div className="grid gap-5 xl:grid-cols-[1.65fr_1fr]">
        {/* Left Column: Canvas + Tabs */}
        <div className="space-y-4">
          <GraphCanvas
            graph={graph}
            paths={paths}
            focusedPath={focusedPath}
            selectedId={selection.id}
            onSelectNode={(node) => {
              setSelectedEdge(null);
              select("wallet", node.id);
            }}
            onSelectEdge={(edge) => {
              select("transaction", edge.id);
              setSelectedEdge(edge);
            }}
            onToggleFocus={() => setFocusedPath(null)}
          />

          <Tabs defaultValue="paths">
            <TabsList className="bg-surface border border-border">
              <TabsTrigger value="paths" className="gap-1.5">
                <RouteIcon className="size-3.5" />
                Value Paths ({paths.length})
              </TabsTrigger>
              <TabsTrigger value="entities" className="gap-1.5">
                <Fingerprint className="size-3.5" />
                Entity Intelligence ({entities.length})
              </TabsTrigger>
              <TabsTrigger value="signals" className="gap-1.5">
                <ShieldAlert className="size-3.5" />
                Structural Signals ({signals.length})
              </TabsTrigger>
              <TabsTrigger value="timeline" className="gap-1.5">
                <Clock className="size-3.5" />
                Chronology ({timeline.length})
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: Prioritized Value Paths */}
            <TabsContent value="paths" className="mt-3 space-y-2.5">
              {paths.map((p, idx) => {
                const active = focusedPath === p.id;
                return (
                  <div
                    key={p.id}
                    className={`panel p-4 transition-all duration-200 ${
                      active
                        ? "border-primary shadow-[0_0_20px_-8px_var(--primary-glow)] bg-primary/5"
                        : "hover:border-border-strong bg-surface/30"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="mono text-xs font-semibold text-primary">
                          #{String(idx + 1).padStart(2, "0")}
                        </span>
                        <span className="text-sm font-semibold text-foreground">
                          {p.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Chip
                          tone={
                            p.continuity > 0.7
                              ? "positive"
                              : p.continuity > 0.4
                                ? "warning"
                                : "neutral"
                          }
                        >
                          {(p.continuity * 100).toFixed(0)}% Continuity
                        </Chip>
                        <Button
                          size="sm"
                          variant={active ? "default" : "outline"}
                          className="h-7 text-xs"
                          onClick={() => setFocusedPath(active ? null : p.id)}
                        >
                          {active ? "Exit Focus" : "Focus Path"}
                        </Button>
                      </div>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {p.verdict}
                    </p>
                    <div className="mono mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border/50 pt-2.5 text-[11px] text-muted-foreground">
                      <span>{p.valuePreserved} preserved</span>
                      <span>·</span>
                      <span>{p.hops} hops</span>
                      <span>·</span>
                      <span>Endpoint: {NODE_KIND_LABEL[p.endpointKind]}</span>
                      <span className="ml-auto font-medium text-foreground">
                        {p.confidence}% Confidence
                      </span>
                    </div>
                  </div>
                );
              })}
            </TabsContent>

            {/* Tab 2: Entity & VASP Intelligence */}
            <TabsContent value="entities" className="mt-3 space-y-2.5">
              {entities.length === 0 ? (
                <EmptyState
                  icon={Fingerprint}
                  title="No attribution candidates"
                  description="No endpoint in scope matches an attribution set. Extending the hop bound may reach an attributed service."
                />
              ) : (
                entities.map((e) => (
                  <article key={e.id} className="panel p-4 bg-surface/30 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">{e.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          Proximity: {e.proximityHops} hops from target wallet
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Chip tone="intel">{e.type}</Chip>
                        <Chip tone={e.attributionStrength > 0.7 ? "positive" : "warning"}>
                          {(e.attributionStrength * 100).toFixed(0)}% Attribution Strength
                        </Chip>
                      </div>
                    </div>
                    <div className="rounded-md border border-border/60 bg-elevated/40 p-3 space-y-1.5 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground block text-[11px] uppercase mono">
                        Attribution Rationale:
                      </span>
                      <ul className="list-disc pl-4 space-y-1 text-[11px]">
                        {e.rationale.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  </article>
                ))
              )}
            </TabsContent>

            {/* Tab 3: Structural & Behavioural Signals */}
            <TabsContent value="signals" className="mt-3 space-y-2.5">
              {analysis.generatedFindings.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-primary/40 bg-primary/10">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-primary shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        {analysis.generatedFindings.length} On-Chain Risk Patterns Detected
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Automated heuristics identified behavioural patterns from live transaction history.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs gap-1.5 h-7 border-border"
                      disabled={autoPinEvidence.isPending}
                      onClick={() => autoPinEvidence.mutate()}
                    >
                      <Vault className="size-3.5 text-primary" />
                      {autoPinEvidence.isPending ? "Pinning..." : "Pin On-Chain Evidence"}
                    </Button>
                    <Button
                      size="sm"
                      className="text-xs gap-1.5 h-7"
                      disabled={recordFinding.isPending}
                      onClick={() => {
                        for (const f of analysis.generatedFindings) {
                          recordFinding.mutate({
                            title: f.title,
                            description: f.description,
                            severity: f.severity,
                            confidence: f.confidence,
                            type: f.type,
                          });
                        }
                        toast.success(`Recording ${analysis.generatedFindings.length} findings to case...`);
                      }}
                    >
                      Sync All as Case Findings
                    </Button>
                  </div>
                </div>
              )}
              {signals.map((sig) => (
                <article key={sig.id} className="panel p-4 bg-surface/30 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={sig.severity} />
                      <span className="text-sm font-semibold text-foreground">
                        {sig.pattern}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() =>
                        recordFinding.mutate({
                          title: sig.pattern,
                          description: sig.description,
                          severity: sig.severity,
                          confidence: 85,
                          type: "behavioural_pattern",
                        })
                      }
                    >
                      Record as finding
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {sig.description}
                  </p>
                </article>
              ))}
            </TabsContent>

            {/* Tab 4: Chronological Timeline */}
            <TabsContent value="timeline" className="mt-3">
              <div className="panel p-4 bg-surface/30">
                <ol className="space-y-3">
                  {timeline.map((event, i) => {
                    const isSelected = activeTimelineFilter === event.id;
                    return (
                      <li
                        key={event.id}
                        onClick={() => handleTimelineClick(event.id, event.nodeId, event.pathId)}
                        className={`flex items-start gap-3 p-2.5 rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? "border-primary bg-primary/10 shadow-sm"
                            : "border-transparent hover:border-border hover:bg-elevated/40"
                        }`}
                      >
                        <div className="mono w-20 shrink-0 text-[11px] text-muted-foreground pt-0.5">
                          <span className="font-semibold text-foreground block">{event.clock}</span>
                          <span>{event.at}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-foreground">{event.title}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{event.detail}</p>
                        </div>
                        <Chip tone="neutral" className="text-[10px] uppercase">
                          {event.kind}
                        </Chip>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column: 3-Tier Structured Inspector (Blueprint Page 32 & 104-105) */}
        <aside className="panel h-fit xl:sticky xl:top-[88px] bg-surface/40 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3 bg-surface/60">
            <Layers className="size-4 text-primary" />
            <p className="text-sm font-semibold">Contextual Inspector</p>
            <Chip className="ml-auto text-[10px]">
              {selectedEdge
                ? "Transaction Edge"
                : selectedNode
                  ? (NODE_KIND_LABEL[selectedNode.kind] ?? "Wallet")
                  : "Overview Mode"}
            </Chip>
          </div>

          <ScrollArea className="max-h-[640px]">
            <div className="p-4 space-y-4">
              {selectedEdge ? (
                /* Inspector for Transaction Edge */
                <div className="space-y-4">
                  <div>
                    <span className="mono text-[10px] text-muted-foreground uppercase tracking-wider block">
                      Transaction Hash
                    </span>
                    <button
                      onClick={() => copy(selectedEdge.txHash)}
                      className="mono mt-1 flex w-full items-center gap-1.5 break-all rounded-md border border-border bg-elevated/50 px-3 py-2 text-left text-[11px] hover:text-foreground transition-colors"
                    >
                      <span>{truncateAddress(selectedEdge.txHash, 16, 8)}</span>
                      <Copy className="ml-auto size-3 shrink-0 text-muted-foreground" />
                    </button>
                    <a
                      href={getExplorerTxUrl(record.blockchain, selectedEdge.txHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-1.5"
                    >
                      View on Explorer <ExternalLink className="size-3" />
                    </a>
                  </div>

                  {/* 1. Directly Observed Facts */}
                  <div className="p-3 rounded-lg border border-border/80 bg-background/60 space-y-2">
                    <span className="mono text-[10px] font-semibold text-primary uppercase tracking-wider block">
                      01 // Directly Observed On-Chain
                    </span>
                    <dl className="mono space-y-1.5 text-[11px]">
                      <Row label="Transfer Value" value={selectedEdge.value} />
                      <Row label="Asset" value={selectedEdge.asset} />
                      <Row label="Timestamp" value={selectedEdge.timestamp} />
                    </dl>
                  </div>

                  {/* 2. Value Continuity Scoring */}
                  <div className="p-3 rounded-lg border border-border/80 bg-background/60 space-y-2">
                    <span className="mono text-[10px] font-semibold text-positive uppercase tracking-wider block">
                      02 // Continuity & Paths
                    </span>
                    <dl className="mono space-y-1.5 text-[11px]">
                      <Row
                        label="Continuity Score"
                        value={`${(selectedEdge.continuity * 100).toFixed(0)}%`}
                      />
                      <Row label="Associated Paths" value={selectedEdge.pathIds.join(", ")} />
                    </dl>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5 text-xs"
                    disabled={pinEvidence.isPending}
                    onClick={() =>
                      pinEvidence.mutate({
                        title: `Transfer ${truncateAddress(selectedEdge.txHash, 10, 6)}`,
                        description: `${selectedEdge.value} ${selectedEdge.asset} moved at ${selectedEdge.timestamp} with ${(selectedEdge.continuity * 100).toFixed(0)}% value continuity.`,
                        type: "transaction",
                      })
                    }
                  >
                    <Pin className="size-3.5" />
                    Pin Transfer as Evidence
                  </Button>
                </div>
              ) : selectedNode ? (
                /* Inspector for Wallet / Node */
                <div className="space-y-4">
                  <div>
                    <span className="text-sm font-semibold text-foreground block">
                      {selectedNode.label}
                    </span>
                    <button
                      onClick={() => copy(selectedNode.address)}
                      className="mono mt-1 flex w-full items-center gap-1.5 break-all rounded-md border border-border bg-elevated/50 px-3 py-2 text-left text-[11px] hover:text-foreground transition-colors"
                    >
                      <span>{selectedNode.address}</span>
                      <Copy className="ml-auto size-3 shrink-0 text-muted-foreground" />
                    </button>
                    <a
                      href={getExplorerAddressUrl(record.blockchain, selectedNode.address)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-1.5"
                    >
                      View on Explorer <ExternalLink className="size-3" />
                    </a>
                  </div>

                  {/* 1. Directly Observed Facts */}
                  <div className="p-3 rounded-lg border border-border/80 bg-background/60 space-y-2">
                    <span className="mono text-[10px] font-semibold text-primary uppercase tracking-wider block">
                      01 // Directly Observed On-Chain
                    </span>
                    <dl className="mono space-y-1.5 text-[11px]">
                      <Row label="Graph Hop" value={String(selectedNode.hop)} />
                      <Row label="Inflow" value={selectedNode.valueIn} />
                      <Row label="Outflow" value={selectedNode.valueOut} />
                      <Row label="Connected Counterparties" value={`${selectedNode.connectedAddresses}`} />
                      <Row label="First Activity" value={selectedNode.firstSeen} />
                    </dl>
                  </div>

                  {/* Live Backend Intelligence from Express Service */}
                  {liveIntel.data && (
                    <div className="p-3 rounded-lg border border-intel/40 bg-intel/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="mono text-[10px] font-semibold text-intel uppercase tracking-wider block">
                          Live Chain Telemetry
                        </span>
                        <Chip tone={(liveIntel.data.riskScore ?? 0) > 60 ? "critical" : "positive"}>
                          Risk: {liveIntel.data.riskScore ?? 0}/100
                        </Chip>
                      </div>
                      <dl className="mono space-y-1 text-[11px]">
                        <Row
                          label="Total Received"
                          value={usd(liveIntel.data.address.totalReceivedUsd)}
                        />
                        <Row
                          label="Total Spent"
                          value={usd(liveIntel.data.address.totalSpentUsd)}
                        />
                        <Row
                          label="Current Balance"
                          value={usd(liveIntel.data.address.balanceUsd)}
                        />
                        <Row label="Data Provider" value={liveIntel.data.sourceLabel} />
                      </dl>
                      {(liveIntel.data.address.tags?.length ?? 0) > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1 border-t border-border/40">
                          {(liveIntel.data.address.tags ?? []).map((tag: any, idx) => {
                            const label =
                              typeof tag === "string"
                                ? tag
                                : tag?.label ?? tag?.category ?? "tag";
                            const key =
                              typeof tag === "string"
                                ? `${tag}-${idx}`
                                : `${tag?.label ?? "tag"}-${idx}`;
                            return (
                              <Chip key={key} tone="intel" className="text-[9px]">
                                {label}
                              </Chip>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Live Counterparty Neighbours */}
                  {liveNeighbours.data && (liveNeighbours.data.neighbours?.length ?? 0) > 0 && (
                    <div className="p-3 rounded-lg border border-border/80 bg-background/60 space-y-2">
                      <span className="mono text-[10px] font-semibold text-foreground uppercase tracking-wider block">
                        Direct Counterparties ({liveNeighbours.data.neighbours?.length ?? 0})
                      </span>
                      <div className="space-y-1.5">
                        {(liveNeighbours.data.neighbours ?? []).map((nbr) => (
                          <div
                            key={nbr.address}
                            className="flex items-center justify-between text-[10px] mono p-1.5 rounded bg-surface/50 border border-border/40"
                          >
                            <span className="truncate max-w-[130px]" title={nbr.address}>
                              {nbr.label ? nbr.label : truncateAddress(nbr.address, 6, 4)}
                            </span>
                            <span className="text-muted-foreground">
                              {usd(nbr.valueUsd)} ({nbr.txCount ?? 0} txs)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 2. Attribution Intelligence */}
                  <div className="p-3 rounded-lg border border-border/80 bg-background/60 space-y-2">
                    <span className="mono text-[10px] font-semibold text-intel uppercase tracking-wider block">
                      02 // Attribution Intelligence
                    </span>
                    <dl className="mono space-y-1.5 text-[11px]">
                      <Row label="Entity Classification" value={NODE_KIND_LABEL[selectedNode.kind] ?? "Wallet"} />
                      <Row label="On Critical Paths" value={`${selectedNode.relevantPaths} paths`} />
                    </dl>
                  </div>

                  {/* 3. Action Directives (Blueprint Page 105) */}
                  <div className="space-y-2 pt-2 border-t border-border/60">
                    <Button
                      variant="default"
                      size="sm"
                      className="w-full gap-1.5 text-xs"
                      onClick={() => handleTraceFromNode(selectedNode.address)}
                    >
                      <Zap className="size-3.5" />
                      Trace Forward From Here →
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-1.5 text-xs"
                      disabled={pinEvidence.isPending}
                      onClick={() =>
                        pinEvidence.mutate({
                          title: `Wallet ${truncateAddress(selectedNode.address, 10, 6)}`,
                          description: `${NODE_KIND_LABEL[selectedNode.kind] ?? "Wallet"} at hop ${selectedNode.hop}. In ${selectedNode.valueIn}, out ${selectedNode.valueOut}.`,
                          type: "wallet",
                        })
                      }
                    >
                      <Pin className="size-3.5" />
                      Pin Wallet to Evidence Vault
                    </Button>
                  </div>
                </div>
              ) : (
                /* Default Overview State */
                <div className="space-y-3.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2 text-foreground font-semibold">
                    <Compass className="size-4 text-primary" />
                    Investigation Scope & Bounds
                  </div>
                  <p className="leading-relaxed">
                    Select any wallet or transfer edge on the interactive graph to inspect verified cryptographic records, attribution intelligence, and path continuity hypotheses.
                  </p>
                  <div className="mono space-y-2 border-t border-border pt-3 text-[11px]">
                    <Row
                      label="Trace Window"
                      value={
                        record.window_start
                          ? `${new Date(record.window_start).toLocaleDateString()} → ${
                              record.window_end
                                ? new Date(record.window_end).toLocaleDateString()
                                : "now"
                            }`
                          : "unbounded"
                      }
                    />
                    <Row
                      label="Min Value Floor"
                      value={
                        record.min_value
                          ? `${record.min_value.toLocaleString()} USDT`
                          : "none"
                      }
                    />
                    <Row label="Max Node Cap" value={`${graph.bounds.maxNodes}`} />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </aside>
      </div>

      {/* Interactive Report Builder Dialog */}
      <ReportBuilderDialog
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
        data={{
          investigation: record,
          caseRef: caseObj?.case_ref,
          paths,
          entities,
          signals,
          timeline,
          findingsCount: 0,
          evidenceCount: 0,
        }}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/40 pb-1 last:border-b-0">
      <dt className="text-muted-foreground/80">{label}</dt>
      <dd className="truncate text-right text-foreground font-medium">{value}</dd>
    </div>
  );
}
