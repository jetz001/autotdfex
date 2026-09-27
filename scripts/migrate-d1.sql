-- autoTDFex D1 Database Schema
-- Run this in Cloudflare Dashboard > D1 > autotdfex-db > Console
-- Or: wrangler d1 execute autotdfex-db --file=scripts/migrate-d1.sql

CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quant_logs (
  id TEXT PRIMARY KEY,
  time TEXT,
  action TEXT,
  symbol TEXT,
  note TEXT,
  color TEXT,
  is_paper INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quant_logs_created ON quant_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quant_logs_symbol ON quant_logs(symbol);
