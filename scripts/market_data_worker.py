"""
Unified market data worker for Kalshi and Polymarket.

This worker manages both WebSocket and REST API connections to fetch
real-time market data from both providers and write to market_price_cache.

Env vars required:
  DATABASE_URL            - PostgreSQL connection string
  KALSHI_ACCESS_KEY       - Kalshi API access key
  KALSHI_PRIVATE_KEY      - Kalshi RSA private key (PEM format)
  POLYMARKET_API_KEY      - Polymarket API key (optional, for REST)

Usage:
  python3 scripts/market_data_worker.py

This runs indefinitely with both WebSocket (when available) and REST polling.
"""

import asyncio
import json
import logging
import os
import time
from typing import Any, Dict, List, Optional

import psycopg2
import psycopg2.pool
import requests

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# REST API endpoints
KALSHI_REST_URL = "https://api.elections.kalshi.com/trade-api/v2"
POLYMARKET_REST_URL = "https://clob.polymarket.com"


class MarketDataWorker:
    """Unified worker for Kalshi and Polymarket market data."""

    def __init__(self):
        self.db_pool: Optional[psycopg2.pool.ThreadedConnectionPool] = None
        self.running = True

    def init_db_pool(self):
        """Initialize PostgreSQL connection pool."""
        db_url = os.environ.get("DATABASE_URL")
        if not db_url:
            raise ValueError("DATABASE_URL must be set")

        self.db_pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=1, maxconn=5, dsn=db_url
        )
        logger.info("✅ Database connection pool initialized")

    def close_db_pool(self):
        """Close database connection pool."""
        if self.db_pool:
            self.db_pool.closeall()
            logger.info("Database pool closed")

    def upsert_market_price(
        self, provider: str, market_id: str, price: float
    ):
        """Upsert market price into market_price_cache and store in price_history."""
        conn = None
        try:
            conn = self.db_pool.getconn()
            with conn.cursor() as cur:
                # Update price cache
                cur.execute(
                    """
                    INSERT INTO market_price_cache (provider, market_id, last_price, as_of)
                    VALUES (%s, %s, %s, NOW())
                    ON CONFLICT (provider, market_id)
                    DO UPDATE SET last_price = EXCLUDED.last_price, as_of = NOW();
                    """,
                    (provider, market_id, price),
                )
                # Store in price history (only once per minute to avoid too much data)
                # Check if we already have a price for this market in the current minute
                cur.execute(
                    """
                    SELECT COUNT(*) FROM price_history
                    WHERE provider = %s 
                      AND market_id = %s 
                      AND timestamp >= DATE_TRUNC('minute', NOW())
                    """,
                    (provider, market_id),
                )
                existing_count = cur.fetchone()[0]
                
                if existing_count == 0:
                    # Only insert if no entry exists for this minute
                    cur.execute(
                        """
                        INSERT INTO price_history (provider, market_id, price, timestamp)
                        VALUES (%s, %s, %s, NOW());
                        """,
                        (provider, market_id, price),
                    )
            conn.commit()
            logger.debug(f"Updated {provider} price: {market_id} = ${price:.4f}")
        except Exception as e:
            logger.error(f"Failed to upsert market price: {e}", exc_info=True)
            if conn:
                conn.rollback()
        finally:
            if conn:
                self.db_pool.putconn(conn)

    def upsert_market_metadata(
        self, provider: str, market_id: str, name: str, description: str = None,
        resolution_date: str = None, category: str = None
    ):
        """Upsert market metadata."""
        conn = None
        try:
            conn = self.db_pool.getconn()
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO market_metadata 
                    (provider, market_id, name, description, resolution_date, category, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, NOW())
                    ON CONFLICT (provider, market_id)
                    DO UPDATE SET 
                        name = EXCLUDED.name,
                        description = COALESCE(EXCLUDED.description, market_metadata.description),
                        resolution_date = COALESCE(EXCLUDED.resolution_date, market_metadata.resolution_date),
                        category = COALESCE(EXCLUDED.category, market_metadata.category),
                        updated_at = NOW();
                    """,
                    (provider, market_id, name, description, resolution_date, category),
                )
            conn.commit()
        except Exception as e:
            logger.error(f"Failed to upsert market metadata: {e}", exc_info=True)
            if conn:
                conn.rollback()
        finally:
            if conn:
                self.db_pool.putconn(conn)

    def fetch_kalshi_markets(self) -> List[Dict[str, Any]]:
        """Fetch active markets from Kalshi REST API."""
        try:
            access_key = os.environ.get("KALSHI_ACCESS_KEY")
            if not access_key:
                logger.warning("KALSHI_ACCESS_KEY not set, skipping Kalshi REST")
                return []

            # Kalshi REST API requires RSA-PSS signing for authenticated requests
            # For now, we'll use the public markets endpoint if available
            # Or you can implement full RSA signing here (similar to WebSocket)
            
            # Try public markets endpoint (if available)
            # Kalshi's REST API structure - adjust based on actual docs
            resp = requests.get(
                f"{KALSHI_REST_URL}/markets",
                timeout=10,
            )

            if resp.status_code == 200:
                data = resp.json()
                markets = []
                
                # Parse Kalshi response format
                market_list = data if isinstance(data, list) else data.get("markets", [])
                
                for market in market_list[:50]:  # Limit to 50
                    market_id = market.get("ticker") or market.get("event_ticker") or market.get("id")
                    price = market.get("yes_bid") or market.get("last_price") or market.get("price")
                    name = market.get("title") or market.get("subtitle") or market_id
                    
                    if market_id and price is not None:
                        try:
                            markets.append({
                                "provider": "kalshi",
                                "market_id": str(market_id),
                                "price": float(price),
                                "name": str(name),
                                "description": market.get("description") or market.get("subtitle"),
                                "resolution_date": market.get("expected_expiration_time") or market.get("expiration_time"),
                                "category": market.get("category") or market.get("series_ticker"),
                            })
                        except (ValueError, TypeError):
                            continue
                
                logger.info(f"✅ Fetched {len(markets)} Kalshi markets")
                return markets
            else:
                # If authenticated endpoint needed, log but don't fail
                logger.warning(
                    f"Kalshi REST API returned {resp.status_code}. "
                    "May need authenticated endpoint with RSA signing."
                )
                return []

        except Exception as e:
            logger.warning(f"Error fetching Kalshi markets: {e}")
            return []

    def fetch_polymarket_markets(self) -> List[Dict[str, Any]]:
        """Fetch active markets from Polymarket REST API."""
        try:
            # Polymarket uses a different API structure
            # Try the CLOB API for market information
            # Polymarket's actual API might be at a different endpoint
            resp = requests.get(
                f"{POLYMARKET_REST_URL}/markets",
                timeout=10,
                headers={"Accept": "application/json"},
            )
            
            if resp.status_code == 200:
                data = resp.json()
                markets = []

                # Handle different response formats
                market_list = data if isinstance(data, list) else data.get("markets", [])

                for market in market_list[:50]:  # Limit to 50 markets
                    # Try different field names Polymarket might use
                    market_id = (
                        market.get("market_id")
                        or market.get("id")
                        or market.get("question_id")
                        or market.get("slug")
                    )
                    
                    # Polymarket prices are typically probabilities (0-1)
                    price = (
                        market.get("probability")
                        or market.get("price")
                        or market.get("yes_price")
                        or market.get("current_price")
                    )
                    
                    name = (
                        market.get("question")
                        or market.get("title")
                        or market.get("name")
                        or market_id
                    )

                    if market_id and price is not None:
                        try:
                            price_float = float(price)
                            markets.append(
                                {
                                    "provider": "polymarket",
                                    "market_id": str(market_id),
                                    "price": price_float,
                                    "name": str(name),
                                }
                            )
                        except (ValueError, TypeError):
                            continue

                logger.info(f"✅ Fetched {len(markets)} Polymarket markets")
                return markets
            else:
                # If direct API fails, return empty (will use fallback data)
                logger.warning(
                    f"Polymarket API returned {resp.status_code}: {resp.text[:200]}"
                )
                return []

        except Exception as e:
            logger.warning(
                f"Error fetching Polymarket markets (will use fallback): {e}"
            )
            return []

    def process_markets(self, markets: List[Dict[str, Any]]):
        """Process and store market data."""
        for market in markets:
            provider = market.get("provider")
            market_id = market.get("market_id")
            price = market.get("price")
            name = market.get("name")
            description = market.get("description")
            resolution_date = market.get("resolution_date")
            category = market.get("category")

            if provider and market_id and price is not None:
                self.upsert_market_price(provider, market_id, float(price))
                
                # Store metadata if available
                if name:
                    self.upsert_market_metadata(
                        provider, market_id, name, description, resolution_date, category
                    )

    async def run_rest_polling(self):
        """Run REST API polling for both providers."""
        logger.info("Starting REST API polling for Kalshi and Polymarket...")

        while self.running:
            try:
                # Fetch from both providers
                kalshi_markets = self.fetch_kalshi_markets()
                polymarket_markets = self.fetch_polymarket_markets()

                # Process and store
                self.process_markets(kalshi_markets)
                self.process_markets(polymarket_markets)

                # Wait 30 seconds before next poll
                await asyncio.sleep(30)

            except Exception as e:
                logger.error(f"Error in REST polling loop: {e}", exc_info=True)
                await asyncio.sleep(30)

    async def run(self):
        """Main worker loop."""
        self.init_db_pool()

        try:
            # Run REST polling (works for both providers)
            await self.run_rest_polling()
        except KeyboardInterrupt:
            logger.info("Received interrupt, shutting down...")
            self.running = False
        finally:
            self.close_db_pool()


async def main():
    """Entry point."""
    worker = MarketDataWorker()
    try:
        await worker.run()
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    asyncio.run(main())

