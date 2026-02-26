-- ============================================================
-- Migration: Add 3-phase challenge progression + parlay bets
-- ============================================================

-- ── 1. Extend challenge_subscriptions with phase tracking ──
ALTER TABLE challenge_subscriptions
  ADD COLUMN IF NOT EXISTS phase TEXT NOT NULL DEFAULT 'phase1'
    CHECK (phase IN ('phase1', 'phase2', 'funded')),
  ADD COLUMN IF NOT EXISTS phase_started_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS profit_split_pct NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_trade_at TIMESTAMPTZ;

-- Backfill: existing passed rows are treated as having completed phase1
UPDATE challenge_subscriptions
SET phase = 'phase1'
WHERE phase IS NULL OR phase = '';

-- ── 2. Create parlay_bets table ──────────────────────────────
CREATE TABLE IF NOT EXISTS parlay_bets (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  challenge_subscription_id BIGINT NOT NULL REFERENCES challenge_subscriptions(id),
  stake NUMERIC(14,2) NOT NULL CHECK (stake > 0),
  combined_multiplier NUMERIC(14,4) NOT NULL,
  potential_payout NUMERIC(14,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'won', 'lost', 'cancelled')),
  -- JSONB array of legs:
  -- [{ marketId, provider, outcome, price, marketName, status: 'pending'|'won'|'lost' }]
  legs JSONB NOT NULL,
  placed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_parlay_bets_user ON parlay_bets(user_id);
CREATE INDEX IF NOT EXISTS idx_parlay_bets_status ON parlay_bets(status);
CREATE INDEX IF NOT EXISTS idx_parlay_bets_sub ON parlay_bets(challenge_subscription_id);
