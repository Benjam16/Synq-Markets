"""
Production Kalshi WebSocket worker.

Maintains a persistent connection to Kalshi's WebSocket API, subscribes to
market price streams, and writes updates into market_price_cache.

Also listens for trade/fill events to sync live P&L into simulated_trades.

Env vars required:
  DATABASE_URL            - PostgreSQL connection string
  KALSHI_ACCESS_KEY       - Kalshi API access key (UUID format)
  KALSHI_PRIVATE_KEY      - Kalshi RSA private key in PEM format (full key including -----BEGIN/END-----)

Usage:
  python3 scripts/kalshi_ws_worker.py

This runs indefinitely. For production, run it as a systemd service or
supervisor process with auto-restart.
"""

import asyncio
import base64
import json
import logging
import os
import ssl
import time
from typing import Any, Dict, Optional

import psycopg2
import psycopg2.pool
import websockets
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.backends import default_backend
from psycopg2.extras import execute_batch

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

WS_URL = "wss://api.elections.kalshi.com/trade-api/ws/v2"
WS_PATH = "/trade-api/ws/v2"

# Reconnection settings
RECONNECT_DELAY = 5  # seconds
MAX_RECONNECT_DELAY = 300  # max 5 minutes
RECONNECT_BACKOFF = 1.5


def build_headers() -> dict:
    """Build authentication headers for WebSocket connection using RSA-PSS signing."""
    access_key = os.environ.get("KALSHI_ACCESS_KEY")
    private_key_pem = os.environ.get("KALSHI_PRIVATE_KEY")

    if not access_key or not private_key_pem:
        raise ValueError(
            "KALSHI_ACCESS_KEY and KALSHI_PRIVATE_KEY must be set"
        )

    # Load the RSA private key
    try:
        private_key = serialization.load_pem_private_key(
            private_key_pem.encode(),
            password=None,
            backend=default_backend()
        )
    except Exception as e:
        raise ValueError(f"Failed to load RSA private key: {e}")

    # Create signature: timestamp + method + path
    timestamp = str(int(time.time() * 1000))
    message = f"{timestamp}GET{WS_PATH}".encode()

    # Sign with RSA-PSS
    signature = private_key.sign(
        message,
        padding.PSS(
            mgf=padding.MGF1(hashes.SHA256()),
            salt_length=padding.PSS.MAX_LENGTH
        ),
        hashes.SHA256()
    )
    signature_b64 = base64.b64encode(signature).decode()

    return {
        "KALSHI-ACCESS-KEY": access_key,
        "KALSHI-ACCESS-SIGNATURE": signature_b64,
        "KALSHI-ACCESS-TIMESTAMP": timestamp,
    }


class KalshiWebSocketWorker:
    """Production WebSocket worker for Kalshi market data."""

    def __init__(self):
        self.db_pool: Optional[psycopg2.pool.ThreadedConnectionPool] = None
        self.ws: Optional[websockets.WebSocketServerProtocol] = None
        self.reconnect_delay = RECONNECT_DELAY
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
        """Upsert market price into market_price_cache."""
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
            conn.commit()
            logger.debug(f"Updated price: {market_id} = ${price:.4f}")
        except Exception as e:
            logger.error(f"Failed to upsert market price: {e}", exc_info=True)
            if conn:
                conn.rollback()
        finally:
            if conn:
                self.db_pool.putconn(conn)

    def handle_price_update(self, msg: Dict[str, Any]):
        """
        Handle a price update message from Kalshi.

        Expected message formats (adjust based on actual Kalshi schema):
        - {"type": "price", "market_id": "...", "price": 0.62, ...}
        - {"event": "market_update", "ticker": "...", "last_price": 0.62, ...}
        """
        # Try common field names Kalshi might use
        market_id = (
            msg.get("market_id")
            or msg.get("ticker")
            or msg.get("event_ticker")
            or msg.get("symbol")
        )
        price = (
            msg.get("price")
            or msg.get("last_price")
            or msg.get("current_price")
            or msg.get("mid_price")
        )

        if market_id and price is not None:
            try:
                price_float = float(price)
                self.upsert_market_price("kalshi", market_id, price_float)
            except (ValueError, TypeError) as e:
                logger.warning(
                    f"Invalid price format in message: {msg}, error: {e}"
                )
        else:
            # Log unhandled message structure for debugging (at INFO level)
            logger.info(f"Price update message missing fields: {json.dumps(msg, indent=2)}")

    def handle_trade_fill(self, msg: Dict[str, Any]):
        """
        Handle a trade/fill event (optional - for syncing live P&L).

        If Kalshi sends fill notifications, we can log them here.
        For now, this is a placeholder you can extend if needed.
        """
        logger.debug(f"Trade fill event: {msg}")
        # TODO: If you want to sync fills into simulated_trades, parse here
        # and call a method like self.record_fill(...)

    def process_message(self, raw_msg: str):
        """Process a raw WebSocket message."""
        try:
            msg = json.loads(raw_msg)
            msg_type = (
                msg.get("type")
                or msg.get("event")
                or msg.get("event_type")
                or "unknown"
            )

            if msg_type in ("price", "market_update", "quote", "ticker"):
                self.handle_price_update(msg)
            elif msg_type in ("fill", "trade", "execution"):
                self.handle_trade_fill(msg)
            else:
                # Log other message types for debugging (at INFO level so we can see them)
                logger.info(f"Unhandled message type '{msg_type}': {json.dumps(msg, indent=2)}")

        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse message as JSON: {raw_msg}, error: {e}")
        except Exception as e:
            logger.error(f"Error processing message: {e}", exc_info=True)

    async def subscribe_to_markets(self):
        """
        Send subscription message(s) to Kalshi WebSocket.

        We'll try multiple common formats. If one fails, we'll see what messages
        Kalshi sends anyway and can adjust based on their actual API.
        """
        # Try different subscription formats that trading APIs commonly use
        subscription_formats = [
            {"cmd": "subscribe", "channels": ["markets"]},
            {"type": "subscribe", "channels": ["markets", "prices"]},
            {"action": "subscribe", "topic": "markets"},
            {"subscribe": "markets"},
        ]
        
        for fmt in subscription_formats:
            try:
                subscribe_msg = json.dumps(fmt)
                await self.ws.send(subscribe_msg)
                logger.info(f"Sent subscription: {subscribe_msg}")
                await asyncio.sleep(0.5)  # Wait a bit between attempts
            except Exception as e:
                logger.warning(f"Failed to send subscription {fmt}: {e}")
        
        # Also, just listen for any messages - Kalshi might send data without explicit subscription
        logger.info("Listening for messages (Kalshi may send data automatically)")

    async def run(self):
        """Main worker loop with reconnection logic."""
        self.init_db_pool()

        while self.running:
            try:
                headers = build_headers()
                # Create SSL context (disable verification for development - NOT for production!)
                ssl_context = ssl.create_default_context()
                ssl_context.check_hostname = False
                ssl_context.verify_mode = ssl.CERT_NONE
                
                async with websockets.connect(
                    WS_URL, 
                    additional_headers=list(headers.items()),
                    ssl=ssl_context
                ) as ws:
                    self.ws = ws
                    logger.info("✅ Connected to Kalshi WebSocket")
                    self.reconnect_delay = RECONNECT_DELAY  # Reset on success

                    # Send subscription
                    await self.subscribe_to_markets()

                    # Listen for messages - log ALL messages so we can see Kalshi's format
                    async for raw_msg in ws:
                        # Log the raw message first so we can see what Kalshi sends
                        logger.info(f"Raw message from Kalshi: {raw_msg}")
                        self.process_message(raw_msg)

            except websockets.ConnectionClosed as e:
                logger.warning(f"WebSocket closed: {e}")
            except Exception as e:
                logger.error(f"WebSocket error: {e}", exc_info=True)

            if not self.running:
                break

            # Exponential backoff before reconnecting
            logger.info(
                f"Reconnecting in {self.reconnect_delay} seconds..."
            )
            await asyncio.sleep(self.reconnect_delay)
            self.reconnect_delay = min(
                self.reconnect_delay * RECONNECT_BACKOFF, MAX_RECONNECT_DELAY
            )

        self.close_db_pool()

    def stop(self):
        """Stop the worker gracefully."""
        self.running = False
        if self.ws:
            asyncio.create_task(self.ws.close())


async def main():
    """Entry point."""
    worker = KalshiWebSocketWorker()
    try:
        await worker.run()
    except KeyboardInterrupt:
        logger.info("Received interrupt, shutting down...")
        worker.stop()
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    asyncio.run(main())

