"""
Enhanced market data worker with better API integration for Kalshi and Polymarket.

This version uses more reliable endpoints and better error handling.
"""

import asyncio
import json
import logging
import os
import time
from typing import Any, Dict, List, Optional
from datetime import datetime

import psycopg2
import psycopg2.pool
import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# API Endpoints
KALSHI_PUBLIC_API = "https://api.elections.kalshi.com/trade-api/v2"
POLYMARKET_API = "https://clob.polymarket.com"
POLYMARKET_GRAPHQL = "https://api.thegraph.com/subgraphs/name/polymarket"


class EnhancedMarketWorker:
    """Enhanced worker with better API integration."""

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

    def upsert_market_price(self, provider: str, market_id: str, price: float):
        """Upsert market price."""
        conn = None
        try:
            conn = self.db_pool.getconn()
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO market_price_cache (provider, market_id, last_price, as_of)
                    VALUES (%s, %s, %s, NOW())
                    ON CONFLICT (provider, market_id)
                    DO UPDATE SET last_price = EXCLUDED.last_price, as_of = NOW();
                    """,
                    (provider, market_id, price),
                )
                # Store in price history (once per minute)
                cur.execute(
                    """
                    SELECT COUNT(*) FROM price_history
                    WHERE provider = %s AND market_id = %s 
                      AND timestamp >= DATE_TRUNC('minute', NOW())
                    """,
                    (provider, market_id),
                )
                if cur.fetchone()[0] == 0:
                    cur.execute(
                        """
                        INSERT INTO price_history (provider, market_id, price, timestamp)
                        VALUES (%s, %s, %s, NOW());
                        """,
                        (provider, market_id, price),
                    )
            conn.commit()
        except Exception as e:
            logger.error(f"Failed to upsert price: {e}")
            if conn:
                conn.rollback()
        finally:
            if conn:
                self.db_pool.putconn(conn)

    def upsert_market_metadata(
        self, provider: str, market_id: str, name: str, 
        description: str = None, resolution_date: str = None, category: str = None
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
            logger.error(f"Failed to upsert metadata: {e}")
            if conn:
                conn.rollback()
        finally:
            if conn:
                self.db_pool.putconn(conn)

    def fetch_polymarket_markets(self) -> List[Dict[str, Any]]:
        """Fetch markets from Polymarket using GraphQL API."""
        try:
            # Polymarket GraphQL query for active markets
            query = """
            {
              markets(
                first: 50
                where: { 
                  active: true
                  closed: false
                }
                orderBy: volume
                orderDirection: desc
              ) {
                id
                question
                description
                endDate
                volume
                outcomes {
                  id
                  price
                  title
                }
                tags {
                  name
                }
              }
            }
            """
            
            resp = requests.post(
                POLYMARKET_GRAPHQL,
                json={"query": query},
                timeout=15,
                headers={"Content-Type": "application/json"},
            )
            
            if resp.status_code == 200:
                data = resp.json()
                markets = []
                
                if "data" in data and "markets" in data["data"]:
                    for market in data["data"]["markets"]:
                        market_id = market.get("id")
                        question = market.get("question", "")
                        
                        # Get YES outcome price
                        outcomes = market.get("outcomes", [])
                        yes_outcome = next((o for o in outcomes if o.get("title", "").upper() == "YES"), None)
                        price = float(yes_outcome.get("price", 0.5)) if yes_outcome else 0.5
                        
                        # Get category from tags
                        tags = market.get("tags", [])
                        category = tags[0].get("name") if tags else None
                        
                        if market_id and question:
                            markets.append({
                                "provider": "polymarket",
                                "market_id": str(market_id),
                                "price": price,
                                "name": question,
                                "description": market.get("description"),
                                "resolution_date": market.get("endDate"),
                                "category": category,
                            })
                
                logger.info(f"✅ Fetched {len(markets)} Polymarket markets")
                return markets
            else:
                logger.warning(f"Polymarket API returned {resp.status_code}")
                return []
        except Exception as e:
            logger.warning(f"Error fetching Polymarket: {e}")
            return []

    def fetch_kalshi_markets(self) -> List[Dict[str, Any]]:
        """Fetch markets from Kalshi public API."""
        try:
            # Try to fetch from public endpoint
            # Note: Kalshi may require authentication for full access
            resp = requests.get(
                f"{KALSHI_PUBLIC_API}/markets",
                params={"limit": 50, "status": "open"},
                timeout=15,
            )
            
            if resp.status_code == 200:
                data = resp.json()
                markets = []
                
                market_list = data if isinstance(data, list) else data.get("markets", []) or data.get("data", [])
                
                for market in market_list[:50]:
                    market_id = market.get("ticker") or market.get("event_ticker") or market.get("id")
                    price = market.get("yes_bid") or market.get("last_price") or market.get("price")
                    name = market.get("title") or market.get("subtitle") or str(market_id)
                    
                    if market_id and price is not None:
                        try:
                            markets.append({
                                "provider": "kalshi",
                                "market_id": str(market_id),
                                "price": float(price),
                                "name": str(name),
                                "description": market.get("description"),
                                "resolution_date": market.get("expected_expiration_time") or market.get("expiration_time"),
                                "category": market.get("category") or market.get("series_ticker"),
                            })
                        except (ValueError, TypeError):
                            continue
                
                logger.info(f"✅ Fetched {len(markets)} Kalshi markets")
                return markets
            else:
                logger.warning(f"Kalshi API returned {resp.status_code}")
                return []
        except Exception as e:
            logger.warning(f"Error fetching Kalshi: {e}")
            return []

    def process_markets(self, markets: List[Dict[str, Any]]):
        """Process and store market data."""
        for market in markets:
            provider = market.get("provider")
            market_id = market.get("market_id")
            price = market.get("price")
            name = market.get("name")
            
            if provider and market_id and price is not None:
                self.upsert_market_price(provider, market_id, float(price))
                if name:
                    self.upsert_market_metadata(
                        provider, market_id, name,
                        market.get("description"),
                        market.get("resolution_date"),
                        market.get("category"),
                    )

    async def run_polling(self):
        """Run polling loop."""
        logger.info("🚀 Starting enhanced market data worker...")
        
        while self.running:
            try:
                # Fetch from both providers
                polymarket_markets = self.fetch_polymarket_markets()
                kalshi_markets = self.fetch_kalshi_markets()
                
                # Process markets
                self.process_markets(polymarket_markets)
                self.process_markets(kalshi_markets)
                
                total = len(polymarket_markets) + len(kalshi_markets)
                logger.info(f"📊 Processed {total} total markets")
                
                # Wait 60 seconds before next poll
                await asyncio.sleep(60)
            except Exception as e:
                logger.error(f"Error in polling loop: {e}", exc_info=True)
                await asyncio.sleep(60)

    async def run(self):
        """Main worker loop."""
        self.init_db_pool()
        try:
            await self.run_polling()
        except KeyboardInterrupt:
            logger.info("Shutting down...")
            self.running = False
        finally:
            self.close_db_pool()


async def main():
    worker = EnhancedMarketWorker()
    try:
        await worker.run()
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    asyncio.run(main())

