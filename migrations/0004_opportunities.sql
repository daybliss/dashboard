-- Opportunities cache tables for arbitrage and income tracking

-- ============================================================================
-- ARBITRAGE CACHE
-- Stores Polymarket arbitrage opportunities (YES+NO < $1.00)
-- ============================================================================

CREATE TABLE arbitrage_cache (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  market_id TEXT NOT NULL,
  market_name TEXT NOT NULL,
  yes_price REAL NOT NULL,
  no_price REAL NOT NULL,
  sum REAL NOT NULL,
  profit_percent REAL NOT NULL,
  volume24h REAL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_arbitrage_profit ON arbitrage_cache(profit_percent DESC);
CREATE INDEX idx_arbitrage_updated ON arbitrage_cache(updated_at);
CREATE INDEX idx_arbitrage_market ON arbitrage_cache(market_id);

-- ============================================================================
-- INCOME CACHE
-- Stores yield opportunities (JEPQ, Aave, etc.)
-- ============================================================================

CREATE TABLE income_cache (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('dividend', 'yield', 'lending')),
  asset TEXT NOT NULL,
  platform TEXT NOT NULL,
  apy REAL NOT NULL,
  tvl REAL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  description TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_income_type ON income_cache(type);
CREATE INDEX idx_income_apy ON income_cache(apy DESC);
CREATE INDEX idx_income_updated ON income_cache(updated_at);
