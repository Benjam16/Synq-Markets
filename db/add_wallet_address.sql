-- Add wallet_address for Solana wallet-based auth (optional migration)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS wallet_address TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_wallet_address
  ON users(wallet_address)
  WHERE wallet_address IS NOT NULL;

COMMENT ON COLUMN users.wallet_address IS 'Solana wallet public key (base58) for onchain auth';
