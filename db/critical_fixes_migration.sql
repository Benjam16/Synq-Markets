-- Critical Fixes Migration
-- Run this in Supabase SQL Editor after the main schema

-- ============================================
-- 1. Add Position Status (Keep History)
-- ============================================
ALTER TABLE simulated_trades 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'settled')),
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS close_price NUMERIC(8, 4);

-- Update existing trades to have 'open' status
UPDATE simulated_trades SET status = 'open' WHERE status IS NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_simulated_trades_status ON simulated_trades(status);
CREATE INDEX IF NOT EXISTS idx_simulated_trades_subscription_status ON simulated_trades(challenge_subscription_id, status);

-- ============================================
-- 2. Price History Table
-- ============================================
CREATE TABLE IF NOT EXISTS price_history (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('kalshi', 'polymarket')),
  market_id TEXT NOT NULL,
  price NUMERIC(8, 4) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Note: We'll handle duplicate prevention in application code
-- The worker checks before inserting to avoid too many entries per minute

CREATE INDEX IF NOT EXISTS idx_price_history_market ON price_history(provider, market_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_timestamp ON price_history(timestamp DESC);

-- ============================================
-- 3. Market Metadata Table
-- ============================================
CREATE TABLE IF NOT EXISTS market_metadata (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('kalshi', 'polymarket')),
  market_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  resolution_date TIMESTAMPTZ,
  category TEXT,
  tags TEXT[],
  volume_24h NUMERIC(18, 2),
  liquidity NUMERIC(18, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, market_id)
);

CREATE INDEX IF NOT EXISTS idx_market_metadata_provider ON market_metadata(provider);
CREATE INDEX IF NOT EXISTS idx_market_metadata_category ON market_metadata(category);

-- ============================================
-- 4. Market Resolutions Table
-- ============================================
CREATE TABLE IF NOT EXISTS market_resolutions (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('kalshi', 'polymarket')),
  market_id TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('yes', 'no')),
  resolution_price NUMERIC(8, 4) NOT NULL,
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, market_id)
);

CREATE INDEX IF NOT EXISTS idx_market_resolutions_provider ON market_resolutions(provider);
CREATE INDEX IF NOT EXISTS idx_market_resolutions_resolved_at ON market_resolutions(resolved_at DESC);

-- ============================================
-- 5. Add Last Trade Tracking for Inactivity
-- ============================================
ALTER TABLE challenge_subscriptions
ADD COLUMN IF NOT EXISTS last_trade_at TIMESTAMPTZ;

-- Update existing subscriptions
UPDATE challenge_subscriptions 
SET last_trade_at = (
  SELECT MAX(executed_at) 
  FROM simulated_trades 
  WHERE challenge_subscription_id = challenge_subscriptions.id
)
WHERE last_trade_at IS NULL;

-- Note: days_since_last_trade should be calculated in queries, not as a generated column
-- because NOW() is not IMMUTABLE. Use this in queries instead:
-- EXTRACT(DAY FROM NOW() - last_trade_at) AS days_since_last_trade

-- ============================================
-- 6. Performance Metrics
-- ============================================
ALTER TABLE challenge_subscriptions
ADD COLUMN IF NOT EXISTS total_trades INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS winning_trades INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_realized_pnl NUMERIC(14, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS largest_win NUMERIC(14, 2),
ADD COLUMN IF NOT EXISTS largest_loss NUMERIC(14, 2);

