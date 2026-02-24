Prop Market – Prediction Market Prop Firm Dashboard
===================================================

This app is a Next.js dashboard for a prediction-market style prop firm (Kalshi / Polymarket).

## Quick start

1. **Install dependencies**

```bash
npm install
```

2. **Configure database (Supabase Postgres)**

Create a file named `.env.local` in the project root with:

```bash
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.iphqnpapflhznzsaqkah.supabase.co:5432/postgres?sslmode=require"
PGSSLMODE=require
```

Replace `YOUR_PASSWORD` with the password from your Supabase project settings (Database → Connection string → URI).

3. **Prepare Postgres**

In Supabase SQL editor:

```sql
CREATE EXTENSION IF NOT EXISTS citext;
```

Then copy–paste and run the contents of `db/schema.sql`.

4. **Seed tiers + demo user + active challenge**

From the project root:

```bash
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.iphqnpapflhznzsaqkah.supabase.co:5432/postgres?sslmode=require" npm run seed
```

This will:

- Upsert account tiers (Scout, Analyst, Strategist, Whale, VIP)
- Create a `demo@prop.local` trader
- Create a 100k “Strategist” challenge subscription for that user

5. **Run the app**

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

6. **Set the user id in the browser (temporary auth)**

Open your browser devtools console on `http://localhost:3000` and run:

```js
localStorage.setItem("userId", "1");
location.reload();
```

Once you plug in a real auth system, replace this with your logged-in user’s id.

## Background workers (optional, for live risk & prices)

These scripts assume the same `DATABASE_URL` and (for Kalshi) API keys in the environment.

### Install Python dependencies

```bash
python3 -m pip install -r requirements.txt
```

### 1. **Unified Market Data Worker (Kalshi + Polymarket)**

**Recommended:** Use the unified worker that handles both Kalshi and Polymarket via REST API polling. This is the most reliable approach and works immediately.

```bash
source scripts/set_kalshi_env.sh
export $(grep -v '^#' .env.local | xargs)
python3 scripts/market_data_worker.py
```

Or use the master script:

```bash
./scripts/run_all_workers.sh
```

This worker:
- Fetches market data from both Kalshi and Polymarket every 30 seconds
- Writes prices to `market_price_cache` table
- Works without needing WebSocket subscription formats

**Kalshi WebSocket (optional, for real-time):**

If you want to use Kalshi WebSocket for real-time updates (once subscription format is confirmed):

```bash
source scripts/set_kalshi_env.sh
export $(grep -v '^#' .env.local | xargs)
python3 scripts/kalshi_ws_worker.py
```

**Note:** The WebSocket worker connects successfully but needs the correct subscription format from Kalshi's API docs. The worker logs all messages so you can see what Kalshi sends and adjust accordingly.

### 2. **Drawdown monitor (every minute)**

Cron entry:

```bash
* * * * * TZ=America/New_York DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.iphqnpapflhznzsaqkah.supabase.co:5432/postgres?sslmode=require" python scripts/drawdown_monitor.py
```

3. **Midnight reset (12:00 AM ET)**

```bash
0 0 * * * TZ=America/New_York DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.iphqnpapflhznzsaqkah.supabase.co:5432/postgres?sslmode=require" python scripts/midnight_reset.py
```

You can move these into a small worker VM or container in production.
