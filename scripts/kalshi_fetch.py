"""
Fetch Kalshi market data every 30 seconds and upsert into Postgres.
Env vars expected:
  DATABASE_URL=postgresql://user:pass@host:5432/dbname
  KALSHI_API_KEY=...
  KALSHI_API_SECRET=...
"""

import os
import time
from typing import Any, Dict

import psycopg2
import requests
from psycopg2.extras import execute_batch


KALSHI_BASE_URL = "https://trading-api.kalshi.com/v1"
MARKET_ID = "market_data"  # replace with the concrete market id you want


def get_connection():
  return psycopg2.connect(os.environ["DATABASE_URL"])


def fetch_market() -> Dict[str, Any]:
  resp = requests.get(
    f"{KALSHI_BASE_URL}/markets/{MARKET_ID}",
    auth=(os.environ["KALSHI_API_KEY"], os.environ["KALSHI_API_SECRET"]),
    timeout=10,
  )
  resp.raise_for_status()
  return resp.json()


def upsert_market_price(conn, market: Dict[str, Any]):
  with conn.cursor() as cur:
    execute_batch(
      cur,
      """
      INSERT INTO market_price_cache (provider, market_id, last_price, as_of)
      VALUES (%s, %s, %s, NOW())
      ON CONFLICT (provider, market_id)
      DO UPDATE SET last_price = EXCLUDED.last_price, as_of = NOW();
      """,
      [
        ("kalshi", market["ticker"], market["last_price"]),
      ],
    )
  conn.commit()


def main():
  conn = get_connection()
  while True:
    data = fetch_market()
    upsert_market_price(conn, data)
    time.sleep(30)


if __name__ == "__main__":
  main()

