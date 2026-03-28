# Synq
Synq is a wallet-native onchain trading dashboard with:
- **Predictions**: Polymarket + Kalshi market browsing and activity
- **Terminal**: a unified live feed (Polymarket, Kalshi, RWAs, Bags) with fast-trade entry
- **RWAs**: tokenized RWAs (stocks) traded via **Dflow**
- **Bags**: Bags token discovery + swaps executed via the **Bags API**
- **Docs**: an in-app `/docs` page explaining the platform
---
## Quick start (local)
### 1) Install
```bash
npm install
2) Create .env.local
Create a file named .env.local in the repo root.

Minimum recommended (matches how the app is built today):

# Supabase / DB (if you use the DB-backed pages)
DATABASE_URL="..."
PGSSLMODE=require
NEXT_PUBLIC_SUPABASE_URL="..."
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
# Kalshi (Terminal + prediction data)
KALSHI_ACCESS_KEY="..."
KALSHI_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
# Jupiter (some prediction helpers)
JUPITER_API_KEY="..."
# Solana RPC
NEXT_PUBLIC_SOLANA_RPC_URL="https://api.mainnet-beta.solana.com"
# (optional, used by some server-side helpers if set)
SOLANA_RPC_URL="https://api.mainnet-beta.solana.com"
# Dflow (RWAs trading + discovery)
DFLOW_QUOTE_BASE_URL="https://e.quote-api.dflow.net"
DFLOW_PM_BASE_URL="https://e.prediction-markets-api.dflow.net"
DFLOW_API_KEY="..."
# CoinGecko (core prices + RWA stats)
COINGECKO_API_KEY="..."
COINGECKO_ONCHAIN_BASE_URL="https://api.coingecko.com/api/v3/onchain"
# Bags
BAGS_BASE_URL="https://public-api-v2.bags.fm/api/v1"
BAGS_API_KEY="..."
3) Run
npm run dev
Open http://localhost:3000.

Vercel deployment
Add environment variables
In Vercel: Project → Settings → Environment Variables

Add the same keys from .env.local (values without quotes) to:

Production
Preview (recommended)
Development (optional)
Then redeploy.

Common deployment issues
RWAs page empty with a CoinGecko 401: COINGECKO_API_KEY is missing in Vercel.
Bags page empty: BAGS_API_KEY is missing/incorrect in Vercel.
GitHub push rejected: don’t commit files > 100MB (GitHub will reject them).
How trading routes
RWAs (Dflow)
Quotes and execution are routed through Synq API routes that call Dflow.
The connected wallet signs and submits the returned Solana transaction.
Bags (Bags API)
Quotes come from Bags GET /trade/quote (proxied through Synq).
Execution uses Bags POST /trade/swap (proxied), returning a transaction your wallet signs and sends.
Key pages
/markets — Predictions markets browsing
/terminal — Unified live activity feed + filters/tags
/stocks — RWAs screener + detail panel trading
/bags — Bags tokens list + trading modal
/docs — In-app documentation
Notes
Some market stats (mcap/fdv/24h change) may be missing for very new tokens until upstream providers index them.
The app uses short-lived caching in some API routes to avoid rate limits and improve UI responsiveness.
