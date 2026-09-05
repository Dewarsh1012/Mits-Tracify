/**
 * Provider registry.
 *
 * Resolution is explicit and per-chain: GraphSense is used whenever it is
 * configured and indexes the requested chain; otherwise the deterministic
 * synthetic provider serves the request. Nothing else in the codebase needs to
 * know which one answered — the result shape is identical.
 */
import type { Chain } from "../../models/Investigation.model";
import { CHAINS } from "../../models/Investigation.model";
import { env } from "../../config/env";
import { etherscanProvider } from "./etherscan.provider";
import { createGraphSenseProvider } from "./graphsense.provider";
import { syntheticProvider } from "./synthetic.provider";
import type { ChainProvider } from "./types";

let graphsense: ChainProvider | null | undefined;

/** Lazily constructed so env validation failures surface at first use, not import. */
function graphsenseProvider(): ChainProvider | null {
  if (graphsense === undefined) graphsense = createGraphSenseProvider();
  return graphsense;
}

/** Test seam: inject a provider (or `null`) instead of reading configuration. */
export function setGraphSenseProvider(provider: ChainProvider | null): void {
  graphsense = provider;
}

export function resetProviders(): void {
  graphsense = undefined;
}

export function getChainProvider(chain: Chain): ChainProvider {
  // 1. GraphSense if configured and supports the chain (BTC, ETH, TRX)
  const live = graphsenseProvider();
  if (live && live.supports(chain)) return live;

  // 2. Etherscan for EVM chains if API key configured (or live lookups available)
  if (
    etherscanProvider.supports(chain) &&
    (env.hasEtherscan || env.hasPolygonscan || env.hasBscscan)
  ) {
    return etherscanProvider;
  }

  // 3. Fallback to deterministic synthetic provider
  return syntheticProvider;
}

export function isLiveProvider(chain: Chain): boolean {
  return getChainProvider(chain).id !== "synthetic";
}

/** Per-chain coverage plus a reachability probe, for the status endpoint. */
export async function providerStatus() {
  const liveGs = graphsenseProvider();
  const gsHealth = liveGs ? await liveGs.healthcheck() : { ok: false, detail: "Not configured" };
  const esHealth = (env.hasEtherscan || env.hasPolygonscan || env.hasBscscan)
    ? await etherscanProvider.healthcheck()
    : { ok: false, detail: "No scan API keys configured" };

  return {
    graphsense: {
      configured: Boolean(liveGs),
      reachable: gsHealth.ok,
      ...(gsHealth.detail ? { detail: gsHealth.detail } : {}),
      chains: CHAINS.filter((chain) => liveGs?.supports(chain) ?? false),
    },
    etherscan: {
      configured: env.hasEtherscan || env.hasPolygonscan || env.hasBscscan,
      reachable: esHealth.ok,
      ...(esHealth.detail ? { detail: esHealth.detail } : {}),
      chains: CHAINS.filter((chain) => etherscanProvider.supports(chain)),
    },
    fallback: {
      id: syntheticProvider.id,
      label: syntheticProvider.label,
      chains: CHAINS,
    },
    resolution: Object.fromEntries(
      CHAINS.map((chain) => [chain, getChainProvider(chain).id]),
    ) as Record<Chain, ChainProvider["id"]>,
  };
}

export { syntheticProvider };
export * from "./types";
export { expandGraphFromProvider, traceWithProvider } from "./expansion";
