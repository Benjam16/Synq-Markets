"""
Seed demo market data into market_price_cache.

This creates sample market data so you can see the platform working
while we set up the real API integrations.

Usage:
  DATABASE_URL="..." python3 scripts/seed_demo_markets.py
"""

import os
import psycopg2
from datetime import datetime

DEMO_MARKETS = [
    # Kalshi markets
    {"provider": "kalshi", "market_id": "kalshi.election_2024", "price": 0.62},
    {"provider": "kalshi", "market_id": "kalshi.cpi_print", "price": 0.31},
    {"provider": "kalshi", "market_id": "kalshi.fed_rate_cut", "price": 0.45},
    
    # Polymarket markets
    {"provider": "polymarket", "market_id": "polymarket.superbowl_mvp", "price": 0.44},
    {"provider": "polymarket", "market_id": "polymarket.bitcoin_100k", "price": 0.38},
    {"provider": "polymarket", "market_id": "polymarket.election_2024", "price": 0.55},
]

def seed_demo_markets():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL not set")
        return
    
    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor() as cur:
            for market in DEMO_MARKETS:
                cur.execute(
                    """
                    INSERT INTO market_price_cache (provider, market_id, last_price, as_of)
                    VALUES (%s, %s, %s, NOW())
                    ON CONFLICT (provider, market_id)
                    DO UPDATE SET last_price = EXCLUDED.last_price, as_of = NOW();
                    """,
                    (market["provider"], market["market_id"], market["price"]),
                )
        conn.commit()
        print(f"✅ Seeded {len(DEMO_MARKETS)} demo markets into market_price_cache")
    except Exception as e:
        print(f"ERROR: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    seed_demo_markets()

