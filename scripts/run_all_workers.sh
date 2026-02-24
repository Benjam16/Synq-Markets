#!/bin/bash
# Master script to run all market data workers
# This runs both Kalshi WebSocket (when working) and REST polling for both providers

echo "Starting unified market data workers..."

# Load environment
source scripts/set_kalshi_env.sh 2>/dev/null || true
export $(grep -v '^#' .env.local | xargs) 2>/dev/null || true

# Start the unified REST polling worker (works for both Kalshi and Polymarket)
echo "Starting unified market data worker (REST polling for Kalshi + Polymarket)..."
python3 scripts/market_data_worker.py &

WORKER_PID=$!
echo "Market data worker started (PID: $WORKER_PID)"
echo "Press Ctrl+C to stop all workers"

# Wait for interrupt
trap "kill $WORKER_PID 2>/dev/null; exit" INT TERM
wait $WORKER_PID

