-- PostgreSQL schema for a prediction market prop firm.
-- Focused on challenge tiers, subscriptions, trades, balances, and affiliates.

CREATE TABLE account_tiers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  account_size NUMERIC(14, 2) NOT NULL CHECK (account_size > 0),
  challenge_fee NUMERIC(14, 2) NOT NULL CHECK (challenge_fee >= 0),
  target_audience TEXT,
  max_total_drawdown_pct NUMERIC(5, 2) NOT NULL DEFAULT 10.00,  -- e.g., 10 = kill at -10%
  max_daily_loss_pct NUMERIC(5, 2) NOT NULL DEFAULT 5.00,      -- e.g., 5 = kill at -5% daily
  max_position_pct NUMERIC(5, 2) NOT NULL DEFAULT 20.00,        -- % of equity per single event
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE affiliates (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  contact_email TEXT,
  payout_bps INT NOT NULL DEFAULT 200 CHECK (payout_bps >= 0), -- basis points (e.g., 200 = 2%)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  email CITEXT NOT NULL UNIQUE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'trader', -- trader | admin | risk
  affiliate_id BIGINT REFERENCES affiliates(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE challenge_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  tier_id BIGINT NOT NULL REFERENCES account_tiers(id),
  status TEXT NOT NULL DEFAULT 'active', -- active | failed | passed | cancelled
  start_balance NUMERIC(14, 2) NOT NULL,
  current_balance NUMERIC(14, 2) NOT NULL,
  day_start_balance NUMERIC(14, 2) NOT NULL,
  fail_reason TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  CONSTRAINT chk_balances_positive CHECK (start_balance >= 0 AND current_balance >= 0)
);

CREATE INDEX idx_challenge_subscriptions_user ON challenge_subscriptions(user_id);
CREATE INDEX idx_challenge_subscriptions_status ON challenge_subscriptions(status);

CREATE TABLE simulated_trades (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  challenge_subscription_id BIGINT NOT NULL REFERENCES challenge_subscriptions(id),
  provider TEXT NOT NULL CHECK (provider IN ('kalshi', 'polymarket')),
  market_id TEXT NOT NULL,               -- external market identifier
  side TEXT NOT NULL CHECK (side IN ('yes', 'no')),
  price NUMERIC(8, 4) NOT NULL CHECK (price >= 0),
  quantity NUMERIC(18, 4) NOT NULL CHECK (quantity > 0),
  notional NUMERIC(18, 4) GENERATED ALWAYS AS (price * quantity) STORED,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (challenge_subscription_id, market_id, executed_at)
);

CREATE INDEX idx_simulated_trades_user ON simulated_trades(user_id);
CREATE INDEX idx_simulated_trades_market ON simulated_trades(market_id);

CREATE TABLE daily_balance_snapshots (
  id BIGSERIAL PRIMARY KEY,
  challenge_subscription_id BIGINT NOT NULL REFERENCES challenge_subscriptions(id),
  snapshot_date DATE NOT NULL,
  starting_balance NUMERIC(14, 2) NOT NULL,
  ending_balance NUMERIC(14, 2) NOT NULL,
  equity NUMERIC(14, 2) NOT NULL,
  cash_balance NUMERIC(14, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (challenge_subscription_id, snapshot_date)
);

-- Simple table for storing the latest market prices used by drawdown monitor.
CREATE TABLE market_price_cache (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('kalshi', 'polymarket')),
  market_id TEXT NOT NULL,
  last_price NUMERIC(8, 4) NOT NULL,
  as_of TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, market_id)
);

-- Lightweight event log for risk triggers (drawdown, inactivity, size).
CREATE TABLE risk_events (
  id BIGSERIAL PRIMARY KEY,
  challenge_subscription_id BIGINT NOT NULL REFERENCES challenge_subscriptions(id),
  event_type TEXT NOT NULL, -- daily_drawdown | total_drawdown | position_limit | inactivity
  detail JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- View to quickly see if a subscription is breaching daily drawdown (-5%).
CREATE VIEW v_daily_drawdown_breach AS
SELECT
  cs.id AS subscription_id,
  cs.user_id,
  cs.day_start_balance,
  cs.current_balance,
  (cs.current_balance - cs.day_start_balance) / cs.day_start_balance * 100 AS drawdown_pct
FROM challenge_subscriptions cs
WHERE (cs.current_balance - cs.day_start_balance) / cs.day_start_balance <= -0.05;

