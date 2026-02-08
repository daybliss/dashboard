-- Paper trading table for simulated arbitrage trading
-- ============================================================================
-- PAPER TRADES
-- Tracks simulated trades (no real money) for testing arbitrage strategies
-- ============================================================================

CREATE TABLE paper_trades (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  market_id TEXT NOT NULL,
  market_name TEXT NOT NULL,
  strategy TEXT NOT NULL DEFAULT 'arbitrage',
  yes_price REAL NOT NULL,
  no_price REAL NOT NULL,
  profit_percent REAL NOT NULL,
  invested_amount REAL NOT NULL DEFAULT 5.0,
  potential_profit REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'settled')),
  opened_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT,
  simulated_pnl REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_paper_trades_status ON paper_trades(status);
CREATE INDEX idx_paper_trades_market ON paper_trades(market_id);
CREATE INDEX idx_paper_trades_opened ON paper_trades(opened_at);
CREATE INDEX idx_paper_trades_profit ON paper_trades(profit_percent DESC);
