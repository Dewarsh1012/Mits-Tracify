import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { motion } from "motion/react";
import {
  Activity,
  ArrowRight,
  Bot,
  Compass,
  Flag,
  FolderOpen,
  FolderPlus,
  Gauge,
  Layers,
  Radar,
  Search,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkle,
  Split,
  Vault,
  Wallet,
  Waves,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Chip,
  InvestigationStatusBadge,
  Mono,
  PriorityBadge,
  SeverityBadge,
  StatusBadge,
} from "@/components/vt/badges";
import {
  ActivityRow,
  ClayCard,
  ClayIcon,
  ClayProgress,
  KpiCard,
  QuickAction,
  RiskRing,
  SectionHeading,
  TrendChart,
  type TrendPoint,
} from "@/components/vt/clay";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/vt/states";
import {
  casesQuery,
  evidenceQuery,
  findingsQuery,
  investigationsQuery,
} from "@/lib/api/queries";
import { chainLabel, truncateAddress } from "@/lib/domain";
import { useAuth } from "@/hooks/useAuth";
import { useUIStore } from "@/stores/ui";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Investigator command center — TRACIFY" },
      {
        name: "description",
        content:
          "A claymorphic command center for blockchain investigations: live traces, risk scoring, AI insights, priority cases and evidence-backed findings.",
      },
      { property: "og:title", content: "Investigator command center — TRACIFY" },
      {
        property: "og:description",
        content:
          "Live traces, risk scoring, AI insights and priority caseload in one intelligence console.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

function relative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) {
    const hours = Math.floor(diff / 3_600_000);
    return hours <= 1 ? "just now" : `${hours}h ago`;
  }
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function DashboardPage() {
  const setCreateCaseOpen = useUIStore((s) => s.setCreateCaseOpen);
  const setStartInvestigationOpen = useUIStore(
    (s) => s.setStartInvestigationOpen,
  );
  const setCommandOpen = useUIStore((s) => s.setCommandOpen);
  const { user, profile } = useAuth();
  const name =
    (profile as { full_name?: string } | null)?.full_name ??
    user?.email?.split("@")[0] ??
    "Investigator";

  const cases = useQuery(casesQuery());
  const investigations = useQuery(investigationsQuery());
  const findings = useQuery(findingsQuery());
  const evidence = useQuery(evidenceQuery());

  const error = cases.error ?? investigations.error ?? findings.error;
  const loading = cases.isLoading || investigations.isLoading;

  const activeInvestigations = (investigations.data ?? []).filter((i) =>
    ["queued", "processing"].includes(i.status),
  );
  const priorityCases = (cases.data ?? []).filter(
    (c) => ["critical", "high"].includes(c.priority) && c.status !== "closed",
  );
  const criticalFindings = (findings.data ?? []).filter((f) =>
    ["critical", "high"].includes(f.severity),
  );

  // --- Computed TREND from real investigation dates ---
  const TREND = useMemo((): TrendPoint[] => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const buckets: Record<string, { completed: number; ongoing: number }> = {};
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      buckets[days[d.getDay()]!] = { completed: 0, ongoing: 0 };
    }
    for (const inv of investigations.data ?? []) {
      const d = new Date(inv.created_at);
      const key = days[d.getDay()]!;
      if (!(key in buckets)) continue;
      if (inv.status === "complete") buckets[key]!.completed++;
      else if (["queued", "processing"].includes(inv.status)) buckets[key]!.ongoing++;
    }
    return Object.entries(buckets).map(([label, v]) => ({ label, ...v }));
  }, [investigations.data]);

  // --- FEED from most-recent investigations + evidence ---
  const FEED = useMemo(() => {
    const feedItems: { icon: typeof Waves; tone: "primary" | "intel" | "critical" | "teal"; title: string; detail: string; meta: string; time: string }[] = [];
    const recentInv = (investigations.data ?? []).slice(0, 2);
    const recentEvidence = (evidence.data ?? []).slice(0, 2);
    for (const inv of recentInv) {
      const sev = inv.status === "complete" ? "teal" as const
        : inv.status === "processing" ? "primary" as const
        : "intel" as const;
      feedItems.push({
        icon: inv.status === "complete" ? Layers : Waves,
        tone: sev,
        title: inv.status === "complete" ? `Trace completed: ${inv.name}` : `Trace in progress: ${inv.name}`,
        detail: inv.target_address ? `${inv.target_address.slice(0, 12)}…${inv.target_address.slice(-6)}` : inv.investigation_ref,
        meta: inv.blockchain ?? "ethereum",
        time: relative(inv.updated_at ?? inv.created_at),
      });
    }
    for (const ev of recentEvidence) {
      feedItems.push({
        icon: ShieldAlert,
        tone: "critical" as const,
        title: ev.title,
        detail: ev.description?.slice(0, 60) ?? ev.evidence_type,
        meta: ev.source ?? "evidence vault",
        time: relative(ev.created_at),
      });
    }
    // Always show at least 1 item with placeholder if empty
    if (feedItems.length === 0) {
      feedItems.push({
        icon: Waves,
        tone: "primary" as const,
        title: "No recent activity",
        detail: "Start an investigation to begin tracing.",
        meta: "—",
        time: "—",
      });
    }
    return feedItems;
  }, [investigations.data, evidence.data]);

  // --- INSIGHTS from top 3 findings by severity ---
  const INSIGHTS = useMemo(() => {
    const severityOrder = ["critical", "high", "medium", "low"];
    const top = [...(findings.data ?? [])]
      .sort((a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity))
      .slice(0, 3);
    return top.map((f) => ({
      icon: f.severity === "critical" ? Siren
        : f.severity === "high" ? ShieldAlert
        : f.finding_type === "attribution" || f.finding_type === "vasp_endpoint" ? ShieldCheck
        : Split,
      tone: f.severity === "critical" ? "critical" as const
        : f.severity === "high" ? "warning" as const
        : f.finding_type === "attribution" ? "teal" as const
        : "intel" as const,
      title: f.title,
      body: f.description ?? `${f.severity} severity · ${f.confidence}% confidence`,
      time: relative(f.created_at),
    }));
  }, [findings.data]);

  // --- RISK_FACTORS computed from findings distribution ---
  const RISK_FACTORS = useMemo(() => {
    const all = findings.data ?? [];
    const invCount = investigations.data?.length ?? 0;
    const total = Math.max(1, all.length);
    const critical = all.filter((f) => f.severity === "critical").length;
    const high = all.filter((f) => f.severity === "high").length;
    const week = investigations.data?.filter((i) => {
      const d = new Date(i.created_at);
      return Date.now() - d.getTime() < 7 * 86_400_000;
    }).length ?? 0;
    const vaspFindings = all.filter((f) => f.finding_type === "vasp_endpoint" || f.finding_type === "attribution").length;
    return [
      { label: "Transaction behaviour", value: Math.min(100, Math.round(((critical + high) / total) * 100) || 20), tone: "critical" as const },
      { label: "Counterparty risk", value: Math.min(100, Math.round((critical / total) * 100 * 3) || 15), tone: "warning" as const },
      { label: "Velocity", value: Math.min(100, Math.round((week / Math.max(1, invCount)) * 100) || 10), tone: "intel" as const },
      { label: "Entity association", value: Math.min(100, Math.round((vaspFindings / total) * 100 * 2) || 8), tone: "primary" as const },
      { label: "Sanctions screening", value: Math.min(30, Math.round((all.filter((f) => f.finding_type === "sanctions").length / total) * 100) || 5), tone: "positive" as const },
    ];
  }, [findings.data, investigations.data]);

  // --- Overall risk score ---
  const riskScore = useMemo(() => {
    if (RISK_FACTORS.length === 0) return 0;
    const avg = RISK_FACTORS.reduce((s, f) => s + f.value, 0) / RISK_FACTORS.length;
    return Math.round(avg);
  }, [RISK_FACTORS]);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <ClayCard className="ambient-glow overflow-hidden p-6 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="label-caps mb-2">Investigator command center</p>
            <h1 className="text-[26px] font-semibold tracking-tight sm:text-[30px]">
              {greeting()}, <span className="text-gradient-intel">{name}</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              {activeInvestigations.length} traces are building right now, and{" "}
              {criticalFindings.length} findings are waiting on your review.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Button variant="outline" onClick={() => setCreateCaseOpen(true)}>
              <FolderPlus className="size-4" />
              New case
            </Button>
            <Button onClick={() => setStartInvestigationOpen(true)}>
              <Radar className="size-4" />
              Start investigation
            </Button>
            <Button variant="secondary" onClick={() => setCommandOpen(true)}>
              <Sparkle className="size-4" />
              AI copilot
            </Button>
          </div>
        </div>
      </ClayCard>

      {error ? <ErrorState message={error.message} /> : null}

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Active investigations"
          value={activeInvestigations.length}
          icon={Activity}
          tone="primary"
          trend={12}
          trendLabel="from yesterday"
          delay={0}
        />
        <KpiCard
          label="High priority cases"
          value={priorityCases.length}
          icon={Flag}
          tone="critical"
          trend={8}
          trendLabel="new escalations"
          delay={0.05}
        />
        <KpiCard
          label="Findings to review"
          value={criticalFindings.length}
          icon={ShieldAlert}
          tone="warning"
          trend={-4}
          trendLabel="vs last week"
          delay={0.1}
        />
        <KpiCard
          label="Evidence items"
          value={(evidence.data ?? []).length}
          icon={Vault}
          tone="teal"
          trend={24}
          trendLabel="pinned this week"
          delay={0.15}
        />
      </div>

      {/* Overview + risk + insights */}
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <ClayCard className="p-5 sm:p-6" delay={0.05}>
          <SectionHeading
            title="Investigation overview"
            description="Completed vs ongoing traces this week"
            action={<Chip tone="info" dot>This week</Chip>}
          />
          <TrendChart data={TREND} />
          <div className="mt-3 flex items-center gap-5 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-primary" /> Completed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-intel" /> Ongoing
            </span>
          </div>
        </ClayCard>

        <ClayCard className="p-5 sm:p-6" delay={0.1}>
          <SectionHeading
            title="Workspace risk score"
            description="Weighted across all open investigations"
          />
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
            <RiskRing score={riskScore} />
            <ul className="w-full flex-1 space-y-2.5">
              {RISK_FACTORS.map((f) => (
                <li key={f.label}>
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">{f.label}</span>
                    <span className="mono tabular-nums">{f.value}</span>
                  </div>
                  <ClayProgress value={f.value} tone={f.tone} />
                </li>
              ))}
            </ul>
          </div>
        </ClayCard>
      </div>

      {/* Feed + AI insights + cases */}
      <div className="grid gap-4 xl:grid-cols-3">
        <ClayCard className="p-5" delay={0.05}>
          <SectionHeading
            title="Live activity feed"
            action={
              <span className="clay-pill flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold text-positive">
                <span className="pulse-ring size-1.5 rounded-full bg-positive" />
                LIVE
              </span>
            }
          />
          <div className="space-y-1">
            {FEED.map((f) => (
              <ActivityRow key={f.title} {...f} />
            ))}
          </div>
        </ClayCard>

        <ClayCard className="p-5" delay={0.1}>
          <SectionHeading
            title="AI insights"
            action={
              <button
                type="button"
                onClick={() => setCommandOpen(true)}
                className="text-[11px] text-primary hover:underline"
              >
                View all
              </button>
            }
          />
          <div className="space-y-2.5">
            {INSIGHTS.length === 0 ? (
              <p className="text-[12px] text-muted-foreground px-1">
                No findings recorded yet — complete an investigation to see AI-powered insights here.
              </p>
            ) : (
              INSIGHTS.map((i) => (
                <div key={i.title} className="clay-inset flex gap-3 p-3">
                  <ClayIcon icon={i.icon} tone={i.tone} className="size-8" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{i.title}</p>
                    <p className="text-[11px] text-muted-foreground">{i.body}</p>
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {i.time}
                  </span>
                </div>
              ))
            )}
          </div>
          <div className="clay-inset mt-3 flex items-center gap-3 p-3">
            <ClayIcon icon={Bot} tone="intel" className="size-8" />
            <p className="min-w-0 flex-1 text-[11px] text-muted-foreground">
              Ask the copilot anything about your investigations.
            </p>
            <Button size="sm" onClick={() => setCommandOpen(true)}>
              Ask
            </Button>
          </div>
        </ClayCard>

        <ClayCard className="p-5" delay={0.15}>
          <SectionHeading
            title="High-priority cases"
            action={
              <Link to="/cases" className="text-[11px] text-primary hover:underline">
                View all
              </Link>
            }
          />
          {priorityCases.length === 0 ? (
            <EmptyState
              icon={FolderPlus}
              title="No priority cases"
              description="Nothing is flagged high or critical right now."
            />
          ) : (
            <ul className="space-y-2.5">
              {priorityCases.slice(0, 4).map((c) => (
                <li key={c.id}>
                  <Link
                    to="/cases/$caseId"
                    params={{ caseId: c.id }}
                    className="clay-inset block p-3.5 transition-colors hover:border-border-strong"
                  >
                    <div className="flex items-center gap-2">
                      <PriorityBadge priority={c.priority} />
                      <Mono className="text-muted-foreground">{c.case_ref}</Mono>
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        {relative(c.updated_at)}
                      </span>
                    </div>
                    <p className="mt-2 text-[13px] font-medium leading-snug">
                      {c.title}
                    </p>
                    {c.reported_loss ? (
                      <p className="mono mt-1.5 text-[11px] text-muted-foreground">
                        reported loss ${c.reported_loss.toLocaleString()}
                      </p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </ClayCard>
      </div>

      {/* Active traces + findings */}
      {loading ? (
        <LoadingState rows={3} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
          <ClayCard className="p-5 sm:p-6" delay={0.05}>
            <SectionHeading
              title="Active investigations"
              description="Traces currently building or awaiting analysis."
              action={
                <Link
                  to="/investigations"
                  className="text-[11px] text-primary hover:underline"
                >
                  All investigations
                </Link>
              }
            />
            {activeInvestigations.length === 0 ? (
              <EmptyState
                icon={Radar}
                title="No traces in flight"
                description="Every queued trace has completed. Start a new investigation from a case to begin tracing fund movement."
                action={
                  <Button
                    size="sm"
                    onClick={() => setStartInvestigationOpen(true)}
                  >
                    Start investigation
                  </Button>
                }
              />
            ) : (
              <ul className="space-y-3">
                {activeInvestigations.map((inv, i) => (
                  <motion.li
                    key={inv.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.3 }}
                  >
                    <Link
                      to="/investigations/$investigationId"
                      params={{ investigationId: inv.id }}
                      className="clay-inset block p-4 transition-colors hover:border-border-strong"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Mono className="text-muted-foreground">
                          {inv.investigation_ref}
                        </Mono>
                        <InvestigationStatusBadge status={inv.status} />
                        <Chip>{chainLabel(inv.blockchain)}</Chip>
                        <Chip>{inv.trace_depth} hops</Chip>
                      </div>
                      <p className="mt-2 text-sm font-medium">{inv.name}</p>
                      <p className="mono mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Wallet className="size-3" />
                        {truncateAddress(inv.target_address, 12, 8)}
                      </p>
                      {inv.status === "processing" ? (
                        <div className="mt-3">
                          <div className="mb-1.5 flex justify-between text-[10px] text-muted-foreground">
                            <span>Building bounded graph</span>
                            <span className="mono">
                              hop 2 / {inv.trace_depth}
                            </span>
                          </div>
                          <ClayProgress
                            value={Math.round(((inv.summary?.hops ?? 1) / (inv.trace_depth ?? 3)) * 100)}
                            tone="intel"
                          />
                        </div>
                      ) : null}
                    </Link>
                  </motion.li>
                ))}
              </ul>
            )}

            <div className="mt-6">
              <SectionHeading
                title="Recent case activity"
                action={
                  <Link
                    to="/cases"
                    className="text-[11px] text-primary hover:underline"
                  >
                    All cases
                  </Link>
                }
              />
              <ul className="clay-inset divide-y divide-border overflow-hidden">
                {(cases.data ?? []).slice(0, 5).map((c) => (
                  <li key={c.id}>
                    <Link
                      to="/cases/$caseId"
                      params={{ caseId: c.id }}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-elevated/60"
                    >
                      <Mono className="w-[112px] shrink-0 text-muted-foreground">
                        {c.case_ref}
                      </Mono>
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {c.title}
                      </span>
                      <StatusBadge status={c.status} />
                      <span className="hidden w-16 shrink-0 text-right text-[11px] text-muted-foreground sm:block">
                        {relative(c.updated_at)}
                      </span>
                      <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </ClayCard>

          <ClayCard className="p-5 sm:p-6" delay={0.1}>
            <SectionHeading
              title="Recent findings"
              description="Analyst conclusions with confidence scoring."
              action={
                <Link
                  to="/findings"
                  className="text-[11px] text-primary hover:underline"
                >
                  View all
                </Link>
              }
            />
            {(findings.data ?? []).length === 0 ? (
              <EmptyState
                icon={ShieldAlert}
                title="No findings recorded"
                description="Findings are produced as investigations complete path and entity analysis."
              />
            ) : (
              <ul className="space-y-3">
                {(findings.data ?? []).slice(0, 5).map((f) => (
                  <li key={f.id} className="clay-inset p-4">
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={f.severity} />
                      <Mono className="text-muted-foreground">
                        {f.finding_ref}
                      </Mono>
                      <span className="mono ml-auto text-[11px] text-muted-foreground">
                        {f.confidence}% conf.
                      </span>
                    </div>
                    <p className="mt-2 text-[13px] font-medium leading-snug">
                      {f.title}
                    </p>
                    <div className="mt-2.5">
                      <ClayProgress
                        value={f.confidence}
                        tone={
                          f.severity === "critical"
                            ? "critical"
                            : f.severity === "high"
                              ? "warning"
                              : "primary"
                        }
                        className="h-1.5"
                      />
                    </div>
                    {f.investigation_id ? (
                      <Link
                        to="/investigations/$investigationId"
                        params={{ investigationId: f.investigation_id }}
                        className="mt-2.5 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                      >
                        Open in workspace
                        <ArrowRight className="size-3" />
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </ClayCard>
        </div>
      )}

      {/* Quick access dock + system status */}
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <ClayCard className="p-5 sm:p-6" delay={0.05}>
          <SectionHeading title="Quick access" description="Jump straight into a tool." />
          <div className="flex flex-wrap gap-2.5">
            <QuickAction
              icon={Wallet}
              label="Wallet lookup"
              onClick={() => setCommandOpen(true)}
            />
            <QuickAction
              icon={Search}
              label="Transaction search"
              onClick={() => setCommandOpen(true)}
            />
            <QuickAction
              icon={Compass}
              label="Entity search"
              onClick={() => setCommandOpen(true)}
            />
            <QuickAction
              icon={ShieldCheck}
              label="Sanctions check"
              onClick={() => setCommandOpen(true)}
            />
            <QuickAction
              icon={Gauge}
              label="Risk scan"
              onClick={() => setCommandOpen(true)}
            />
            <QuickAction
              icon={FolderOpen}
              label="Graph explorer"
              onClick={() => setStartInvestigationOpen(true)}
            />
          </div>
        </ClayCard>

        <ClayCard className="p-5 sm:p-6" delay={0.1}>
          <SectionHeading
            title="System status"
            action={
              <span className="flex items-center gap-1.5 text-[11px] text-positive">
                <span className="pulse-ring size-1.5 rounded-full bg-positive" />
                All systems operational
              </span>
            }
          />
          <ul className="space-y-2.5">
            {[
              { label: "Chain ingestion", value: 99, tone: "positive" as const },
              { label: "Graph engine", value: 96, tone: "primary" as const },
              { label: "Risk scoring", value: 92, tone: "intel" as const },
              { label: "Attribution feeds", value: 88, tone: "teal" as const },
            ].map((s) => (
              <li key={s.label}>
                <div className="mb-1 flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="mono tabular-nums">{s.value}% uptime</span>
                </div>
                <ClayProgress value={s.value} tone={s.tone} />
              </li>
            ))}
          </ul>
        </ClayCard>
      </div>
    </div>
  );
}
