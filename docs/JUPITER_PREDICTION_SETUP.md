## Jupiter Prediction trading (real execution)

Synq uses Jupiter's Prediction Market API for real trades. The browser **never** sees the API key; it’s used only in server routes under `app/api/jup/prediction/*`.

### Environment variables

Add the following to your server environment (or `.env.local` for dev). Do not commit real secrets.

- `JUP_PREDICTION_API_KEY`: API key from `portal.jup.ag` (server-side only)
- `NEXT_PUBLIC_SOLANA_RPC_URL` (optional): RPC used by the client to send signed transactions

See `.env.example`.

### Execution model

- UI requests an **unsigned base64 Solana transaction** from Jupiter via server proxy
- Phantom/Solflare signs in-browser (wallet-adapter)
- The app sends the signed transaction to Solana and confirms it

### Endpoints used

- `POST /api/jup/prediction/orders` → create order (returns base64 tx)
- `GET /api/jup/prediction/positions?ownerPubkey=...` → list positions
- `DELETE /api/jup/prediction/positions/:positionPubkey` → close position (returns base64 tx)
- `POST /api/jup/prediction/positions/:positionPubkey/claim` → claim payout (returns base64 tx)

Docs:
- `https://dev.jup.ag/docs/prediction/events-and-markets`
- `https://dev.jup.ag/docs/prediction/open-positions`
- `https://dev.jup.ag/docs/prediction/manage-positions`
- `https://dev.jup.ag/docs/prediction/claim-payouts`
- `https://dev.jup.ag/docs/prediction/position-data`

