/**
 * OpportunitiesDO - Durable Object for caching arbitrage and income opportunities
 *
 * Fetches Polymarket data from Goldsky GraphQL Subgraph and caches in D1.
 * Provides singleton pattern for centralized opportunity tracking.
 */

import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env.d";

// ============================================================================
// TYPES
// ============================================================================

export interface ArbitrageOpportunity {
  marketId: string;
  marketName: string;
  yesPrice: number;
  noPrice: number;
  sum: number;
  profitPercent: number;
  volume24h: number;
  updatedAt: string;
}

export interface IncomeOpportunity {
  id: string;
  type: "dividend" | "yield" | "lending";
  asset: string;
  platform: string;
  apy: number;
  tvl?: number;
  riskLevel: "low" | "medium" | "high";
  description: string;
  updatedAt: string;
}

interface OpportunitiesState {
  arbitrage: ArbitrageOpportunity[];
  income: IncomeOpportunity[];
  lastFetchAt: string | null;
  isFetching: boolean;
}

// GraphQL Subgraph response types
interface PolymarketOutcome {
  id: string;
  name: string;
  price: number;
}

interface PolymarketMarket {
  id: string;
  question: string;
  volume24h: number;
  outcomes: PolymarketOutcome[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

// FREE TIER PROTECTION: Keep API calls minimal
// Cloudflare Workers Free Tier: 100k requests/day, 50 subrequests/request
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes - aggressive caching to minimize API calls
const MAX_MARKETS_TO_FETCH = 50; // Limit to stay well under free tier limits
const POLYMARKET_SUBGRAPH_URL = "https://api.goldsky.com/api/public/project_cl6kegq1e1ed101ug8yncq1t5/subgraphs/polymarket/0.1.5/gn";

const DEFAULT_STATE: OpportunitiesState = {
  arbitrage: [],
  income: [],
  lastFetchAt: null,
  isFetching: false,
};

// Static income data (JEPQ, Aave yields)
const DEFAULT_INCOME_OPPORTUNITIES: IncomeOpportunity[] = [
  {
    id: "jepq-dividend",
    type: "dividend",
    asset: "JEPQ",
    platform: "Nasdaq",
    apy: 11.5,
    riskLevel: "medium",
    description: "JPMorgan Nasdaq Equity Premium Income ETF - monthly distributions",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "aave-usdc",
    type: "lending",
    asset: "USDC",
    platform: "Aave V3",
    apy: 4.2,
    tvl: 850000000,
    riskLevel: "low",
    description: "Lend USDC on Aave for stable yields",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "aave-eth",
    type: "lending",
    asset: "ETH",
    platform: "Aave V3",
    apy: 2.8,
    tvl: 1200000000,
    riskLevel: "low",
    description: "Lend ETH on Aave for passive yield",
    updatedAt: new Date().toISOString(),
  },
];

// ============================================================================
// DURABLE OBJECT
// ============================================================================

export class OpportunitiesDO extends DurableObject<Env> {
  private state: OpportunitiesState = { ...DEFAULT_STATE };

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<OpportunitiesState>("state");
      if (stored) {
        this.state = stored;
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const action = url.pathname.slice(1);

    try {
      switch (action) {
        case "arbitrage":
          return this.handleGetArbitrage();

        case "income":
          return this.handleGetIncome();

        case "refresh":
          return this.handleRefresh();

        case "status":
          return this.handleStatus();

        default:
          return new Response("Not found", { status: 404 });
      }
    } catch (error) {
      console.error("OpportunitiesDO error:", error);
      return new Response(
        JSON.stringify({ error: String(error) }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // ========================================================================
  // HANDLERS
  // ========================================================================

  private async handleGetArbitrage(): Promise<Response> {
    // Check if cache is stale
    if (this.isCacheStale()) {
      await this.fetchAndCacheOpportunities();
    }

    // Transform to match frontend expected format
    const transformed = this.state.arbitrage.map(opp => ({
      market: opp.marketName,
      yesPrice: opp.yesPrice,
      noPrice: opp.noPrice,
      profitPercent: opp.profitPercent,
      volume: opp.volume24h,
      timestamp: opp.updatedAt,
    }));

    return this.jsonResponse({
      ok: true,
      data: transformed,
      cachedAt: this.state.lastFetchAt,
      count: this.state.arbitrage.length,
    });
  }

  private async handleGetIncome(): Promise<Response> {
    // Income data changes less frequently, but still refresh if stale
    if (this.isCacheStale()) {
      await this.fetchAndCacheOpportunities();
    }

    // Transform to match frontend expected format
    const transformed = this.state.income.map(inc => ({
      protocol: inc.platform,
      asset: inc.asset,
      apy: inc.apy,
      tvl: inc.tvl || 0,
      risk: inc.riskLevel,
      timestamp: inc.updatedAt,
    }));

    return this.jsonResponse({
      ok: true,
      data: transformed,
      cachedAt: this.state.lastFetchAt,
      count: this.state.income.length,
    });
  }

  private async handleRefresh(): Promise<Response> {
    if (this.state.isFetching) {
      return this.jsonResponse({
        status: "already_fetching",
        cachedAt: this.state.lastFetchAt,
      });
    }

    await this.fetchAndCacheOpportunities();

    return this.jsonResponse({
      status: "refreshed",
      arbitrageCount: this.state.arbitrage.length,
      incomeCount: this.state.income.length,
      cachedAt: this.state.lastFetchAt,
    });
  }

  private async handleStatus(): Promise<Response> {
    return this.jsonResponse({
      isFetching: this.state.isFetching,
      lastFetchAt: this.state.lastFetchAt,
      cacheStale: this.isCacheStale(),
      arbitrageCount: this.state.arbitrage.length,
      incomeCount: this.state.income.length,
    });
  }

  // ========================================================================
  // CORE LOGIC
  // ========================================================================

  private isCacheStale(): boolean {
    if (!this.state.lastFetchAt) return true;
    const lastFetch = new Date(this.state.lastFetchAt).getTime();
    return Date.now() - lastFetch > CACHE_TTL_MS;
  }

  private async fetchAndCacheOpportunities(): Promise<void> {
    this.state.isFetching = true;

    try {
      // FREE TIER NOTE: Each fetch uses ~1-2 subrequests total
      // - 1 Goldsky Subgraph GraphQL call
      // - Optional: 1 D1 write per cached batch
      // Well within free tier limits (50 subrequests/request, 100k requests/day)
      const arbitrageOpps = await this.fetchPolymarketArbitrage();

      // Update state
      this.state.arbitrage = arbitrageOpps;
      this.state.income = [...DEFAULT_INCOME_OPPORTUNITIES];
      this.state.lastFetchAt = new Date().toISOString();

      // Persist to storage
      await this.persist();

      // Also cache in D1 for persistence across DO restarts
      await this.cacheToD1(arbitrageOpps);
    } finally {
      this.state.isFetching = false;
      await this.persist();
    }
  }

  private async fetchPolymarketArbitrage(): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];

    try {
      // FREE TIER PROTECTION: Limit markets to minimize API calls
      // Goldsky Subgraph call counts as 1 subrequest (well under 50 limit)
      // 5-minute caching keeps us at ~288 calls/day (well under 100k limit)
      const response = await fetch(POLYMARKET_SUBGRAPH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `
            query GetMarkets {
              markets(where: { active: true, closed: false }, first: ${MAX_MARKETS_TO_FETCH}) {
                id
                question
                outcomes {
                  id
                  name
                  price
                }
                volume24h
              }
            }
          `,
        }),
      });

      if (!response.ok) {
        throw new Error(`Goldsky Subgraph error: ${response.status}`);
      }

      const result = await response.json() as {
        data?: { markets: PolymarketMarket[] };
        errors?: Array<{ message: string }>;
      };

      // DEBUG: Log raw response
      console.log("Subgraph response:", JSON.stringify(result, null, 2));

      if (result.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
      }

      const markets = result.data?.markets || [];
      console.log(`Fetched ${markets.length} markets from subgraph`);
      const now = new Date().toISOString();

      for (const market of markets) {
        // DEBUG: Log first few markets to see structure
        if (opportunities.length < 3) {
          console.log("Market structure:", JSON.stringify(market, null, 2));
        }

        if (!market.outcomes || market.outcomes.length < 2) {
          console.log(`Skipping ${market.id}: less than 2 outcomes`);
          continue;
        }

        // Find Yes/No outcomes
        const yesOutcome = market.outcomes.find(o =>
          o.name.toLowerCase() === "yes"
        );
        const noOutcome = market.outcomes.find(o =>
          o.name.toLowerCase() === "no"
        );

        if (!yesOutcome || !noOutcome) {
          console.log(`Skipping ${market.id}: missing yes/no. Outcomes: ${market.outcomes.map(o => o.name).join(", ")}`);
          continue;
        }
        if (typeof yesOutcome.price !== "number" || typeof noOutcome.price !== "number") {
          console.log(`Skipping ${market.id}: price not number. Yes: ${yesOutcome.price}, No: ${noOutcome.price}`);
          continue;
        }

        const yesPrice = yesOutcome.price;
        const noPrice = noOutcome.price;
        const sum = yesPrice + noPrice;

        // Arbitrage opportunity: YES + NO < $1.00
        console.log(`Market ${market.id}: YES=${yesPrice}, NO=${noPrice}, SUM=${sum}`);
        
        if (sum < 1.0) {
          const profitPercent = (1.0 - sum) * 100;
          console.log(`🎯 ARBITRAGE FOUND: ${market.question} - Profit: ${profitPercent.toFixed(2)}%`);
          
          opportunities.push({
            marketId: market.id,
            marketName: market.question,
            yesPrice: Number(yesPrice.toFixed(4)),
            noPrice: Number(noPrice.toFixed(4)),
            sum: Number(sum.toFixed(4)),
            profitPercent: Number(profitPercent.toFixed(4)),
            volume24h: market.volume24h || 0,
            updatedAt: now,
          });
        }
      }

      // Sort by profit potential (descending)
      opportunities.sort((a, b) => b.profitPercent - a.profitPercent);

    } catch (error) {
      console.error("Error fetching Polymarket data:", error);
      // Return cached data if available, empty array otherwise
      return this.state.arbitrage;
    }

    return opportunities;
  }

  private async cacheToD1(arbitrage: ArbitrageOpportunity[]): Promise<void> {
    try {
      // Clear old cache
      await this.env.DB.prepare("DELETE FROM arbitrage_cache WHERE 1=1").run();

      // Insert new data
      if (arbitrage.length > 0) {
        const stmt = this.env.DB.prepare(
          `INSERT INTO arbitrage_cache
           (market_id, market_name, yes_price, no_price, sum, profit_percent, volume24h, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        );

        const batch = arbitrage.map(opp =>
          stmt.bind(
            opp.marketId,
            opp.marketName,
            opp.yesPrice,
            opp.noPrice,
            opp.sum,
            opp.profitPercent,
            opp.volume24h,
            opp.updatedAt
          )
        );

        await this.env.DB.batch(batch);
      }

      // Update income cache
      await this.env.DB.prepare("DELETE FROM income_cache WHERE 1=1").run();

      const incomeStmt = this.env.DB.prepare(
        `INSERT INTO income_cache
         (id, type, asset, platform, apy, tvl, risk_level, description, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      const incomeBatch = DEFAULT_INCOME_OPPORTUNITIES.map(inc =>
        incomeStmt.bind(
          inc.id,
          inc.type,
          inc.asset,
          inc.platform,
          inc.apy,
          inc.tvl || null,
          inc.riskLevel,
          inc.description,
          inc.updatedAt
        )
      );

      await this.env.DB.batch(incomeBatch);

    } catch (error) {
      console.error("Error caching to D1:", error);
      // Non-critical: DO state is the primary cache
    }
  }

  // ========================================================================
  // HELPERS
  // ========================================================================

  private async persist(): Promise<void> {
    await this.ctx.storage.put("state", this.state);
  }

  private jsonResponse(data: unknown): Response {
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  }
}

// ============================================================================
// EXPORT HELPERS
// ============================================================================

export function getOpportunitiesStub(env: Env): DurableObjectStub {
  const id = env.OPPORTUNITIES_DO.idFromName("singleton");
  return env.OPPORTUNITIES_DO.get(id);
}

export async function getArbitrageOpportunities(
  env: Env
): Promise<{ opportunities: ArbitrageOpportunity[]; cachedAt: string | null; count: number }> {
  const stub = getOpportunitiesStub(env);
  const response = await stub.fetch(new Request("http://opportunities/arbitrage"));
  return response.json() as Promise<{ opportunities: ArbitrageOpportunity[]; cachedAt: string | null; count: number }>;
}

export async function getIncomeOpportunities(
  env: Env
): Promise<{ opportunities: IncomeOpportunity[]; cachedAt: string | null; count: number }> {
  const stub = getOpportunitiesStub(env);
  const response = await stub.fetch(new Request("http://opportunities/income"));
  return response.json() as Promise<{ opportunities: IncomeOpportunity[]; cachedAt: string | null; count: number }>;
}

export async function refreshOpportunities(
  env: Env
): Promise<{ status: string; arbitrageCount: number; incomeCount: number; cachedAt: string | null }> {
  const stub = getOpportunitiesStub(env);
  const response = await stub.fetch(new Request("http://opportunities/refresh", { method: "POST" }));
  return response.json() as Promise<{ status: string; arbitrageCount: number; incomeCount: number; cachedAt: string | null }>;
}
