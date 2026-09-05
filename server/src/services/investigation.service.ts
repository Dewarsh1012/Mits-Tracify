import { Types } from "mongoose";
import { nextSequentialId } from "../models/Counter.model";
import {
  Investigation,
  type Chain,
  type InvestigationDoc,
} from "../models/Investigation.model";
import type { AuthenticatedUser } from "../types/express";
import { ApiError } from "../utils/ApiError";
import { logger } from "../utils/logger";
import { assertCaseAccess, asObjectId, caseScopeFilter } from "./access.service";
import { Case } from "../models/Case.model";
import { detectSignals, rankPaths, runTrace, type TraceRequest } from "./intelligence.service";
import { getChainProvider, syntheticProvider, traceWithProvider } from "./blockchain";

export interface StartTraceInput {
  caseId: string;
  title: string;
  rootAddress: string;
  chain: Chain;
  direction?: "outbound" | "inbound" | "both";
  maxHops?: number;
  minValueUsd?: number;
  seedValueUsd?: number;
}

/** Investigations are only visible through cases the user can access. */
async function accessibleCaseIds(user: AuthenticatedUser): Promise<Types.ObjectId[] | null> {
  if (user.role === "admin") return null;
  const cases = await Case.find(caseScopeFilter(user)).select("_id").lean();
  return cases.map((c) => c._id as Types.ObjectId);
}

export async function listInvestigations(
  user: AuthenticatedUser,
  options: { page: number; limit: number; sort: string; order: "asc" | "desc"; status?: string; caseId?: string },
) {
  const filter: Record<string, unknown> = {};
  const ids = await accessibleCaseIds(user);
  if (ids) filter['case'] = { $in: ids };
  if (options.caseId) {
    await assertCaseAccess(options.caseId, user);
    filter['case'] = asObjectId(options.caseId);
  }
  if (options.status) filter['status'] = options.status;

  const [items, total] = await Promise.all([
    Investigation.find(filter)
      .select("-graph")
      .sort({ [options.sort]: options.order === "asc" ? 1 : -1 })
      .skip((options.page - 1) * options.limit)
      .limit(options.limit)
      .populate("case", "reference title")
      .lean(),
    Investigation.countDocuments(filter),
  ]);

  return { items, total };
}

export async function getInvestigation(id: string, user: AuthenticatedUser): Promise<InvestigationDoc> {
  const found = await Investigation.findById(asObjectId(id));
  if (!found) throw ApiError.notFound("Investigation not found");
  await assertCaseAccess(found.case, user);
  return found;
}

/**
 * Create the investigation immediately in `queued` state and run the trace
 * asynchronously, so the API stays responsive and the client can poll progress.
 */
export async function startInvestigation(user: AuthenticatedUser, input: StartTraceInput) {
  const parent = await assertCaseAccess(input.caseId, user);
  const reference = await nextSequentialId("INV");

  const investigation = await Investigation.create({
    reference,
    case: parent._id,
    title: input.title,
    rootAddress: input.rootAddress,
    chain: input.chain,
    direction: input.direction ?? "outbound",
    maxHops: input.maxHops ?? 5,
    minValueUsd: input.minValueUsd ?? 0,
    status: "queued",
    startedBy: new Types.ObjectId(user.id),
  });

  void executeTrace(String(investigation._id), input.seedValueUsd);

  return investigation;
}

/**
 * Run the intelligence pipeline and persist the resulting graph.
 *
 * The chain-data provider is resolved per chain: GraphSense when it is
 * configured and indexes that chain, the deterministic synthetic ledger
 * otherwise. A live-provider failure degrades to the synthetic trace rather
 * than failing the investigation, and the record states which source was used
 * so nothing is presented as live data when it is not.
 */
export async function executeTrace(investigationId: string, seedValueUsd?: number): Promise<void> {
  try {
    const investigation = await Investigation.findById(investigationId);
    if (!investigation) return;

    const provider = getChainProvider(investigation.chain);

    investigation.status = "tracing";
    investigation.progress = 25;
    investigation.dataSource = provider.id;
    investigation.progressNote = `Expanding hops via ${provider.label}`;
    await investigation.save();

    const request: TraceRequest = {
      rootAddress: investigation.rootAddress,
      chain: investigation.chain,
      maxHops: investigation.maxHops,
      minValueUsd: investigation.minValueUsd,
      direction: investigation.direction,
      ...(seedValueUsd !== undefined ? { seedValueUsd } : {}),
    };

    let result: Awaited<ReturnType<typeof traceWithProvider>> | ReturnType<typeof runTrace> & {
      source: "graphsense" | "synthetic";
    };

    if (provider.id === "graphsense") {
      try {
        result = await traceWithProvider(provider, request);
      } catch (error) {
        logger.warn("live provider trace failed — falling back to synthetic", {
          investigationId,
          reason: error instanceof Error ? error.message : String(error),
        });
        result = { ...runTrace(request), source: syntheticProvider.id };
      }
    } else {
      result = { ...runTrace(request), source: syntheticProvider.id };
    }

    investigation.status = "analysing";
    investigation.progress = 70;
    await investigation.save();

    investigation.graph = { nodes: result.nodes, edges: result.edges };
    investigation.metrics = result.metrics;
    investigation.riskScore = result.riskScore;
    investigation.dataSource = result.source;
    investigation.progressNote =
      result.source === "graphsense"
        ? "Graph sourced from GraphSense ledger index"
        : "Graph sourced from the deterministic synthetic ledger";
    investigation.status = "complete";
    investigation.progress = 100;
    investigation.completedAt = new Date();
    await investigation.save();
  } catch (error) {
    logger.error("trace execution failed", {
      investigationId,
      reason: error instanceof Error ? error.message : String(error),
    });
    await Investigation.findByIdAndUpdate(investigationId, {
      status: "failed",
      failureReason: "The trace could not be completed",
    });
  }
}

/** Ranked paths + behavioural signals, derived on read from the stored graph. */
export async function analyseInvestigation(id: string, user: AuthenticatedUser) {
  const investigation = await getInvestigation(id, user);
  const nodes = investigation.graph.nodes;
  const edges = investigation.graph.edges.map((e) => ({ ...e, timestamp: new Date(e.timestamp) }));

  if (nodes.length === 0) {
    return {
      paths: [],
      signals: [],
      riskScore: investigation.riskScore,
      metrics: investigation.metrics,
      dataSource: investigation.dataSource,
    };
  }

  return {
    paths: rankPaths(nodes, edges, investigation.rootAddress),
    signals: detectSignals(nodes, edges),
    riskScore: investigation.riskScore,
    metrics: investigation.metrics,
    dataSource: investigation.dataSource,
  };
}

export async function deleteInvestigation(id: string, user: AuthenticatedUser) {
  const investigation = await getInvestigation(id, user);
  await investigation.deleteOne();
}
