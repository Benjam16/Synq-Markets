# DFlow API — Integration Note for Kalshi (Onchain Feed)

## Can DFlow replace your current Polymarket + Kalshi feeds with one onchain feed?

**Short answer:**

- **Kalshi:** Yes. DFlow can replace your current Kalshi API feed and give you a **single onchain (Solana) feed** for Kalshi that is **tradeable** via Phantom/Solflare using DFlow’s Trade API.
- **Polymarket:** No. DFlow does **not** offer a Polymarket feed or tokenization. Polymarket stays as a separate source (e.g. Gamma API / CLOB as today).

So you do **not** get one unified feed for “Polymarket + Kalshi” from DFlow. You can have:

1. **One onchain, tradeable feed for Kalshi** — via DFlow (Metadata API for discovery, Trade API for Solana txs).
2. **Polymarket** — keep your current Gamma-based feed (and Polymarket’s own trading flow).

Result: two sources (DFlow Kalshi + Polymarket), but Kalshi would be fully onchain and tradeable from your app with wallet.

---

## What DFlow provides

- **Tokenization:** Kalshi markets as SPL tokens on Solana (YES/NO outcome tokens, mints, ledger).
- **Metadata API:** Events → Markets, orderbooks, trades. Use for discovery and prices.
- **Trade API:** Builds Solana transactions to buy/redeem outcome tokens (spot → outcome via settlement mint).
- **Auth:** Metadata/Trade APIs use an API key (`x-api-key`). Contact hello@dflow.net.

**Base URLs (dev):**

- Metadata: `https://dev-prediction-markets-api.dflow.net`
- Trade: `https://dev-quote-api.dflow.net`

**Key endpoints:**

- `GET /api/v1/events` — list events (query: limit, cursor, seriesTickers, status, sort).
- `GET /api/v1/markets` — list/filter markets.
- Orderbook: by market ticker or mint.
- Trade API `/order` — returns a Solana transaction for spot → outcome token.

See: [DFlow Prediction Markets](https://pond.dflow.net/build/prediction-markets/prediction-market-data-model), [Discover Markets](https://dflow.mintlify.app/build/recipes/prediction-markets/discover-markets).

---

## How you could integrate (Kalshi only)

1. **Feed (replace current Kalshi API):**
   - Add a fetcher (e.g. `fetchDflowKalshiMarkets()`) that calls DFlow Metadata API (`/api/v1/events`, `/api/v1/markets`) and maps to your existing `UnifiedMarket` shape (with `provider: 'Kalshi'` and a flag like `source: 'dflow'` if needed).
   - In `fetchAllMarkets()`, call `fetchDflowKalshiMarkets()` instead of `fetchKalshiMarkets()` for the Kalshi side; keep Polymarket as-is (Gamma).

2. **Trading (Kalshi on Solana):**
   - When the user chooses a Kalshi market that comes from DFlow, use DFlow Trade API `/order` with the market ticker (or mint), desired side/size, and user wallet. Submit the returned Solana transaction with the user’s wallet (e.g. Phantom/Solflare).
   - Your existing buy/sell routes that talk to Kalshi’s API would need a branch: for “DFlow-sourced” Kalshi markets, use DFlow Trade API + Solana sign/send instead of Kalshi REST.

3. **Environment:**
   - Add `DFLOW_API_KEY` (or similar) for Metadata and Trade API calls.

---

## Summary

| Source     | Today              | With DFlow (optional)              |
|-----------|--------------------|------------------------------------|
| Polymarket| Gamma API          | Unchanged (Gamma or other)         |
| Kalshi    | Kalshi REST API    | DFlow Metadata API + Trade API     |
| Trading   | Your backend/Kalshi| Kalshi: onchain via DFlow + wallet |

So: you **can** use the DFlow API to change how **Kalshi** markets are fed and traded (one onchain, wallet-tradeable feed). Polymarket remains a separate feed; there is no DFlow “unified Polymarket + Kalshi” single feed.
