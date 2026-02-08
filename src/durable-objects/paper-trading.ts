/**
 * PaperTradingDO - Durable Object for paper trading (simulated) arbitrage
 *
 * Simulates buying YES+NO when profit > threshold
 * Tracks P&L without real money
 * Stores trade history in D1
 */

import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env.d";

// ============================================================================
// TYPES
// ============================================================================

export interface PaperTrade {
  id: string;
  marketId: string;
  marketName: string;
  strategy: "arbitrage";
  yesPrice: number;
  noPrice: number;
  profitPercent: number;
  investedAmount: number; // Simulated $5 per trade
  potentialProfit: number;
  status: "open" | "closed" | "settled";
  openedAt: string;
  closedAt?: string;
  expectedReturn: number;
  simulatedPnl: number;
}

export interface PaperTradingConfig {
  autoExecuteThreshold: number; // Profit % to auto-execute (default 2.5%)
  maxTradeSizeUsd: number; // Max $ per trade (default $5)
  maxTokenLimit: number; // Max tokens per trade (default 500)
  dryRun: boolean; // Always true for paper trading
}

interface PaperTradingState {
  trades: PaperTrade[];
  config: PaperTradingConfig;
  totalTrades: number;
  totalPnl: number;
  autoTradingEnabled: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONFIG: PaperTradingConfig = {
  autoExecuteThreshold: 2.5, // 2.5% profit to auto-trade
  maxTradeSizeUsd: 5.0, // $5 per trade
  maxTokenLimit: 500, // 500 tokens max
  dryRun: true, // ALWAYS true - paper trading only
};

const DEFAULT_STATE: PaperTradingState = {
  trades: [],
  config: { ...DEFAULT_CONFIG },
  totalTrades: 0,
  totalPnl: 0,
  autoTradingEnabled: false, // Disabled by default
};

// ============================================================================
// DURABLE OBJECT
// ============================================================================

export class PaperTradingDO extends DurableObject<Env> {
  private state: PaperTradingState = { ...DEFAULT_STATE };

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<PaperTradingState>("state");
      if (stored) {
        this.state = stored;
      }
      // Load trades from D1 on init
      await this.loadTradesFromD1();
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.slice(1);

    try {
      // List all paper trades
      if (path === "trades" && request.method === "GET") {
        return this.handleGetTrades(request);
      }

      // Get P&L summary
      if (path === "pnl" && request.method === "GET") {
        return this.handleGetPnl();
      }

      // Execute paper trade manually
      if (path === "execute" && request.method === "POST") {
        return this.handleExecuteTrade(request);
      }

      // Close/settle a trade
      const closeMatch = path.match(/^close\/(.+)$/);
      if (closeMatch && closeMatch[1] && request.method === "POST") {
        return this.handleCloseTrade(closeMatch[1], request);
      }

      // Auto-trading settings
      if (path === "config" && request.method === "GET") {
        return this.handleGetConfig();
      }

      if (path === "config" && request.method === "POST") {
        return this.handleUpdateConfig(request);
      }

      // Auto-scan and execute
      if (path === "auto-scan" && request.method === "POST") {
        return this.handleAutoScan(request);
      }

      return new Response("Not found", { status: 404 });
    } catch (error) {
      console.error("PaperTradingDO error:", error);
      return new Response(
        JSON.stringify({ error: String(error) }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // ========================================================================
  // HANDLERS
  // ========================================================================

  private async handleGetTrades(request: Request): Promise<Response> {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as PaperTrade["status"] | null;

    let trades = this.state.trades;
    if (status) {
      trades = trades.filter((t) => t.status === status);
    }

    // Sort by opened date, newest first
    trades.sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());

    return this.jsonResponse({
      ok: true,
      trades,
      count: trades.length,
      totalTrades: this.state.totalTrades,
    });
  }

  private async handleGetPnl(): Promise<Response> {
    const openTrades = this.state.trades.filter((t) => t.status === "open");
    const closedTrades = this.state.trades.filter((t) => t.status === "closed" || t.status === "settled");

    const openPnl = openTrades.reduce((sum, t) => sum + t.simulatedPnl, 0);
    const realizedPnl = closedTrades.reduce((sum, t) => sum + t.simulatedPnl, 0);
    const unrealizedPnl = openPnl;
    const totalPnl = realizedPnl + unrealizedPnl;

    const totalInvested = this.state.trades.reduce((sum, t) => sum + t.investedAmount, 0);
    const winTrades = closedTrades.filter((t) => t.simulatedPnl > 0);
    const lossTrades = closedTrades.filter((t) => t.simulatedPnl < 0);

    return this.jsonResponse({
      ok: true,
      summary: {
        totalTrades: this.state.totalTrades,
        openTrades: openTrades.length,
        closedTrades: closedTrades.length,
        winTrades: winTrades.length,
        lossTrades: lossTrades.length,
        winRate: closedTrades.length > 0 ? (winTrades.length / closedTrades.length) * 100 : 0,
        totalInvested,
        realizedPnl: Number(realizedPnl.toFixed(4)),
        unrealizedPnl: Number(unrealizedPnl.toFixed(4)),
        totalPnl: Number(totalPnl.toFixed(4)),
        roi: totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0,
      },
      trades: this.state.trades,
    });
  }

  private async handleExecuteTrade(request: Request): Promise<Response> {
    const body = await request.json() as {
      marketId: string;
      marketName: string;
      yesPrice: number;
      noPrice: number;
      profitPercent?: number;
    };

    if (!body.marketId || !body.marketName || typeof body.yesPrice !== "number" || typeof body.noPrice !== "number") {
      return this.jsonResponse({ ok: false, error: "Missing required fields: marketId, marketName, yesPrice, noPrice" }, 400);
    }

    const profitPercent = body.profitPercent ?? (1 - (body.yesPrice + body.noPrice)) * 100;

    // Check if already trading this market
    const existing = this.state.trades.find((t) => t.marketId === body.marketId && t.status === "open");
    if (existing) {
      return this.jsonResponse({ ok: false, error: "Already have an open trade for this market", tradeId: existing.id }, 409);
    }

    const trade = await this.createPaperTrade({
      marketId: body.marketId,
      marketName: body.marketName,
      yesPrice: body.yesPrice,
      noPrice: body.noPrice,
      profitPercent,
    });

    return this.jsonResponse({
      ok: true,
      message: "📝 PAPER TRADE EXECUTED (simulated)",
      trade,
      note: "This is a simulated trade. No real money was used.",
    });
  }

  private async handleCloseTrade(tradeId: string, request: Request): Promise<Response> {
    const body = await request.json() as { resolution?: "yes" | "no" | "cancel" | "unknown"; finalPnl?: number };

    const trade = this.state.trades.find((t) => t.id === tradeId);
    if (!trade) {
      return this.jsonResponse({ ok: false, error: "Trade not found" }, 404);
    }

    if (trade.status !== "open") {
      return this.jsonResponse({ ok: false, error: "Trade is not open" }, 400);
    }

    // Calculate P&L based on resolution
    let simulatedPnl = 0;

    if (body.finalPnl !== undefined) {
      // Manual override
      simulatedPnl = body.finalPnl;
    } else if (body.resolution === "yes") {
      // YES pays $1, NO pays $0
      // We bought both YES and NO, so we get $1 from YES, lose NO cost
      simulatedPnl = 1.0 - (trade.yesPrice + trade.noPrice);
    } else if (body.resolution === "no") {
      // NO pays $1, YES pays $0
      simulatedPnl = 1.0 - (trade.yesPrice + trade.noPrice);
    } else if (body.resolution === "cancel") {
      // Market cancelled, return full investment
      simulatedPnl = 0;
    } else {
      // Unknown resolution - use expected value
      simulatedPnl = trade.potentialProfit;
    }

    const updatedTrade: PaperTrade = {
      ...trade,
      status: body.resolution ? "settled" : "closed",
      closedAt: new Date().toISOString(),
      simulatedPnl: Number(simulatedPnl.toFixed(4)),
    };

    // Update state
    this.state.trades = this.state.trades.map((t) => (t.id === tradeId ? updatedTrade : t));
    this.state.totalPnl += simulatedPnl;
    await this.persist();

    // Update D1
    await this.updateTradeInD1(updatedTrade);

    return this.jsonResponse({
      ok: true,
      message: `Trade ${tradeId} ${body.resolution ? "settled" : "closed"}`,
      trade: updatedTrade,
      pnl: simulatedPnl,
    });
  }

  private async handleGetConfig(): Promise<Response> {
    return this.jsonResponse({
      ok: true,
      config: this.state.config,
      autoTradingEnabled: this.state.autoTradingEnabled,
    });
  }

  private async handleUpdateConfig(request: Request): Promise<Response> {
    const body = await request.json() as Partial<PaperTradingConfig> & { autoTradingEnabled?: boolean };

    if (body.autoExecuteThreshold !== undefined) {
      this.state.config.autoExecuteThreshold = Math.max(0.1, body.autoExecuteThreshold);
    }
    if (body.maxTradeSizeUsd !== undefined) {
      this.state.config.maxTradeSizeUsd = Math.min(100, Math.max(1, body.maxTradeSizeUsd));
    }
    if (body.maxTokenLimit !== undefined) {
      this.state.config.maxTokenLimit = Math.min(10000, Math.max(10, body.maxTokenLimit));
    }
    if (body.autoTradingEnabled !== undefined) {
      this.state.autoTradingEnabled = body.autoTradingEnabled;
    }

    await this.persist();

    return this.jsonResponse({
      ok: true,
      config: this.state.config,
      autoTradingEnabled: this.state.autoTradingEnabled,
    });
  }

  private async handleAutoScan(request: Request): Promise<Response> {
    const body = await request.json() as { opportunities?: Array<{ marketId: string; marketName: string; yesPrice: number; noPrice: number; profitPercent: number }> };

    if (!this.state.autoTradingEnabled) {
      return this.jsonResponse({ ok: false, error: "Auto-trading is disabled" }, 400);
    }

    const opportunities = body.opportunities || [];
    const executed: PaperTrade[] = [];
    const skipped: string[] = [];

    for (const opp of opportunities) {
      // Check threshold
      if (opp.profitPercent < this.state.config.autoExecuteThreshold) {
        skipped.push(`${opp.marketName}: profit ${opp.profitPercent.toFixed(2)}% below threshold`);
        continue;
      }

      // Check if already trading
      const existing = this.state.trades.find((t) => t.marketId === opp.marketId && t.status === "open");
      if (existing) {
        skipped.push(`${opp.marketName}: already have open trade`);
        continue;
      }

      // Execute paper trade
      const trade = await this.createPaperTrade({
        marketId: opp.marketId,
        marketName: opp.marketName,
        yesPrice: opp.yesPrice,
        noPrice: opp.noPrice,
        profitPercent: opp.profitPercent,
      });

      executed.push(trade);
    }

    return this.jsonResponse({
      ok: true,
      autoTradingEnabled: true,
      executed: executed.length,
      skipped: skipped.length,
      trades: executed,
      skipReasons: skipped,
    });
  }

  // ========================================================================
  // CORE LOGIC
  // ========================================================================

  private async createPaperTrade(params: {
    marketId: string;
    marketName: string;
    yesPrice: number;
    noPrice: number;
    profitPercent: number;
  }): Promise<PaperTrade> {
    const sum = params.yesPrice + params.noPrice;
    const profitPerDollar = 1.0 - sum;
    const investedAmount = this.state.config.maxTradeSizeUsd;
    const potentialProfit = profitPerDollar * investedAmount;

    const trade: PaperTrade = {
      id: this.generateId(),
      marketId: params.marketId,
      marketName: params.marketName,
      strategy: "arbitrage",
      yesPrice: params.yesPrice,
      noPrice: params.noPrice,
      profitPercent: params.profitPercent,
      investedAmount,
      potentialProfit: Number(potentialProfit.toFixed(4)),
      status: "open",
      openedAt: new Date().toISOString(),
      expectedReturn: investedAmount + potentialProfit,
      simulatedPnl: 0, // Will be calculated on close
    };

    // Update state
    this.state.trades.push(trade);
    this.state.totalTrades += 1;
    await this.persist();

    // Store in D1
    await this.insertTradeToD1(trade);

    console.log(`📝 Paper trade created: ${trade.marketName} - ${trade.profitPercent.toFixed(2)}% profit potential`);

    return trade;
  }

  // ========================================================================
  // D1 STORAGE
  // ========================================================================

  private async loadTradesFromD1(): Promise<void> {
    try {
      const result = await this.env.DB.prepare(
        `SELECT * FROM paper_trades ORDER BY opened_at DESC`
      ).all();

      if (result.results) {
        this.state.trades = result.results.map((row) => ({
          id: row.id as string,
          marketId: row.market_id as string,
          marketName: row.market_name as string,
          strategy: row.strategy as "arbitrage",
          yesPrice: row.yes_price as number,
          noPrice: row.no_price as number,
          profitPercent: row.profit_percent as number,
          investedAmount: row.invested_amount as number,
          potentialProfit: row.potential_profit as number,
          status: row.status as "open" | "closed" | "settled",
          openedAt: row.opened_at as string,
          closedAt: row.closed_at as string | undefined,
          expectedReturn: (row.invested_amount as number) + (row.potential_profit as number),
          simulatedPnl: row.simulated_pnl as number,
        }));

        this.state.totalTrades = this.state.trades.length;
        this.state.totalPnl = this.state.trades.reduce((sum, t) => sum + (t.simulatedPnl || 0), 0);

        console.log(`📊 Loaded ${this.state.trades.length} paper trades from D1`);
      }
    } catch (error) {
      console.error("Error loading trades from D1:", error);
      // Non-critical: DO state will be used
    }
  }

  private async insertTradeToD1(trade: PaperTrade): Promise<void> {
    try {
      await this.env.DB.prepare(
        `INSERT INTO paper_trades
         (id, market_id, market_name, strategy, yes_price, no_price, profit_percent,
          invested_amount, potential_profit, status, opened_at, simulated_pnl)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        trade.id,
        trade.marketId,
        trade.marketName,
        trade.strategy,
        trade.yesPrice,
        trade.noPrice,
        trade.profitPercent,
        trade.investedAmount,
        trade.potentialProfit,
        trade.status,
        trade.openedAt,
        trade.simulatedPnl
      ).run();
    } catch (error) {
      console.error("Error inserting trade to D1:", error);
    }
  }

  private async updateTradeInD1(trade: PaperTrade): Promise<void> {
    try {
      await this.env.DB.prepare(
        `UPDATE paper_trades
         SET status = ?, closed_at = ?, simulated_pnl = ?
         WHERE id = ?`
      ).bind(
        trade.status,
        trade.closedAt || null,
        trade.simulatedPnl,
        trade.id
      ).run();
    } catch (error) {
      console.error("Error updating trade in D1:", error);
    }
  }

  // ========================================================================
  // HELPERS
  // ========================================================================

  private generateId(): string {
    // Generate a UUID-like ID without crypto.randomUUID() for compatibility
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === "x" ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  private async persist(): Promise<void> {
    await this.ctx.storage.put("state", this.state);
  }

  private jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// ============================================================================
// EXPORT HELPERS
// ============================================================================

export function getPaperTradingStub(env: Env): DurableObjectStub {
  const id = env.PAPER_TRADING_DO.idFromName("singleton");
  return env.PAPER_TRADING_DO.get(id);
}

export async function getPaperTrades(
  env: Env,
  status?: "open" | "closed" | "settled"
): Promise<{ trades: PaperTrade[]; count: number; totalTrades: number }> {
  const stub = getPaperTradingStub(env);
  const url = status ? `http://paper/trades?status=${status}` : "http://paper/trades";
  const response = await stub.fetch(new Request(url));
  return response.json() as Promise<{ trades: PaperTrade[]; count: number; totalTrades: number }>;
}

export async function getPaperPnl(env: Env): Promise<{
  ok: boolean;
  summary: {
    totalTrades: number;
    openTrades: number;
    closedTrades: number;
    winTrades: number;
    lossTrades: number;
    winRate: number;
    totalInvested: number;
    realizedPnl: number;
    unrealizedPnl: number;
    totalPnl: number;
    roi: number;
  };
  trades: PaperTrade[];
}> {
  const stub = getPaperTradingStub(env);
  const response = await stub.fetch(new Request("http://paper/pnl"));
  const result = await response.json() as { ok: boolean; summary: { totalTrades: number; openTrades: number; closedTrades: number; winTrades: number; lossTrades: number; winRate: number; totalInvested: number; realizedPnl: number; unrealizedPnl: number; totalPnl: number; roi: number }; trades: PaperTrade[] };
  return result;
}

export async function executePaperTrade(
  env: Env,
  params: {
    marketId: string;
    marketName: string;
    yesPrice: number;
    noPrice: number;
    profitPercent?: number;
  }
): Promise<{ ok: boolean; trade?: PaperTrade; error?: string }> {
  const stub = getPaperTradingStub(env);
  const response = await stub.fetch(new Request("http://paper/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  }));
  return response.json() as Promise<{ ok: boolean; trade?: PaperTrade; error?: string }>;
}

export async function closePaperTrade(
  env: Env,
  tradeId: string,
  resolution?: "yes" | "no" | "cancel" | "unknown",
  finalPnl?: number
): Promise<{ ok: boolean; trade?: PaperTrade; error?: string }> {
  const stub = getPaperTradingStub(env);
  const response = await stub.fetch(new Request(`http://paper/close/${tradeId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resolution, finalPnl }),
  }));
  return response.json() as Promise<{ ok: boolean; trade?: PaperTrade; error?: string }>;
}

export async function autoScanPaperTrades(
  env: Env,
  opportunities: Array<{ marketId: string; marketName: string; yesPrice: number; noPrice: number; profitPercent: number }>
): Promise<{ ok: boolean; executed: number; trades: PaperTrade[] }> {
  const stub = getPaperTradingStub(env);
  const response = await stub.fetch(new Request("http://paper/auto-scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ opportunities }),
  }));
  return response.json() as Promise<{ ok: boolean; executed: number; trades: PaperTrade[] }>;
}
