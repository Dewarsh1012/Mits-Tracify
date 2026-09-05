import { providerStatus } from "../services/blockchain";
import {
  lookupAddress,
  lookupNeighbours,
  lookupTransaction,
  lookupTransactions,
  multiChainSearch,
  quickTraceAddress,
} from "../services/intelligence.query.service";
import type { Chain } from "../models/Investigation.model";
import { sendSuccess } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";

/** Available chain data providers and their reachability status */
export const providers = asyncHandler(async (_req, res) => {
  sendSuccess(res, "Chain data providers status", await providerStatus());
});

/** Lookup single transaction details across supported chains */
export const transaction = asyncHandler(async (req, res) => {
  const params = req.params as unknown as { chain: Chain; txHash: string };
  sendSuccess(
    res,
    "Transaction intelligence",
    await lookupTransaction(params.chain, params.txHash),
  );
});

/** Address intelligence summary and entity attribution */
export const address = asyncHandler(async (req, res) => {
  const params = req.params as unknown as { chain: Chain; address: string };
  sendSuccess(res, "Address intelligence", await lookupAddress(params.chain, params.address));
});

/** List transactions associated with an address */
export const transactions = asyncHandler(async (req, res) => {
  const params = req.params as unknown as { chain: Chain; address: string };
  const query = req.query as unknown as {
    direction?: "in" | "out" | "all";
    limit?: number;
    page?: number;
    minValueUsd?: number;
    asset?: string;
  };

  sendSuccess(
    res,
    "Address transactions",
    await lookupTransactions(params.chain, params.address, query),
  );
});

/** Counterparty graph neighbours for an address */
export const neighbours = asyncHandler(async (req, res) => {
  const params = req.params as unknown as { chain: Chain; address: string };
  const query = req.query as unknown as {
    direction: "in" | "out";
    limit: number;
    minValueUsd?: number;
  };

  sendSuccess(
    res,
    "Address counterparties",
    await lookupNeighbours(params.chain, params.address, {
      direction: query.direction,
      limit: query.limit,
      ...(query.minValueUsd !== undefined ? { minValueUsd: query.minValueUsd } : {}),
    }),
  );
});

/** Run an ad-hoc graph trace without creating an investigation record */
export const trace = asyncHandler(async (req, res) => {
  const params = req.params as unknown as { chain: Chain; address: string };
  const query = req.query as unknown as {
    maxHops?: number;
    minValueUsd?: number;
    direction?: "outbound" | "inbound" | "both";
  };

  sendSuccess(
    res,
    "On-demand address trace",
    await quickTraceAddress(params.chain, params.address, query),
  );
});

/** Search an address across all supported chains concurrently */
export const search = asyncHandler(async (req, res) => {
  const query = req.query as unknown as { address: string };
  sendSuccess(
    res,
    "Multi-chain address search results",
    await multiChainSearch(query.address),
  );
});
