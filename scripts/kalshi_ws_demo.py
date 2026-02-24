"""
Kalshi WebSocket demo client.

Connects to:
  wss://api.elections.kalshi.com/trade-api/ws/v2

and prints incoming messages so you can verify credentials and see the
message format you want to consume (prices, trades, etc.).

Env vars required:
  KALSHI_ACCESS_KEY    - your Kalshi API key / access key (UUID format)
  KALSHI_PRIVATE_KEY   - your Kalshi RSA private key in PEM format (full key including -----BEGIN/END-----)

NOTE: This script focuses on getting a working authenticated connection
and logging messages. Once you confirm the exact message types Kalshi
uses for price updates, we can extend this to upsert into the
market_price_cache table just like kalshi_fetch.py.
"""

import asyncio
import base64
import os
import time

import websockets
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.backends import default_backend

WS_URL = "wss://api.elections.kalshi.com/trade-api/ws/v2"
WS_PATH = "/trade-api/ws/v2"


def build_headers() -> dict:
  access_key = os.environ["KALSHI_ACCESS_KEY"]
  private_key_pem = os.environ["KALSHI_PRIVATE_KEY"]

  # Load the RSA private key
  private_key = serialization.load_pem_private_key(
    private_key_pem.encode(),
    password=None,
    backend=default_backend()
  )

  timestamp = str(int(time.time() * 1000))
  # According to Kalshi docs, signature string is: timestamp + method + path
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


async def main():
  headers = build_headers()
  async with websockets.connect(WS_URL, additional_headers=list(headers.items())) as ws:
    print("✅ Connected to Kalshi WebSocket")
    print("Waiting for messages...\n")

    try:
      async for msg in ws:
        # For now just log the raw payload. Once you see the schema you care
        # about (e.g., price updates), we can parse it and persist to Postgres.
        print(msg)
    except websockets.ConnectionClosed as exc:
      print(f"WebSocket closed: {exc}")


if __name__ == "__main__":
  asyncio.run(main())



