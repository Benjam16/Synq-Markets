"""
Drawdown monitor runs every minute.
For each active challenge:
  equity = cash_balance + SUM((current_price * qty) - (entry_price * qty))
  If equity <= day_start_balance * 0.95 -> mark status='failed' and log event.
"""

import os
from datetime import datetime, timezone

import psycopg2
from psycopg2.extras import DictCursor


def get_connection():
  return psycopg2.connect(os.environ["DATABASE_URL"])


def fetch_active_challenges(conn):
  with conn.cursor(cursor_factory=DictCursor) as cur:
    cur.execute(
      """
      SELECT cs.id, cs.user_id, cs.day_start_balance, cs.current_balance, cs.status
      FROM challenge_subscriptions cs
      WHERE cs.status = 'active';
      """
    )
    return cur.fetchall()


def fetch_positions(conn, subscription_id: int):
  with conn.cursor(cursor_factory=DictCursor) as cur:
    cur.execute(
      """
      SELECT st.market_id, st.provider, st.price, st.quantity
      FROM simulated_trades st
      WHERE st.challenge_subscription_id = %s;
      """,
      (subscription_id,),
    )
    return cur.fetchall()


def fetch_price(conn, provider: str, market_id: str) -> float:
  with conn.cursor() as cur:
    cur.execute(
      """
      SELECT last_price
      FROM market_price_cache
      WHERE provider = %s AND market_id = %s
      ORDER BY as_of DESC
      LIMIT 1;
      """,
      (provider, market_id),
    )
    row = cur.fetchone()
    return float(row[0]) if row else 0.0


def fail_subscription(conn, subscription_id: int, reason: str, drawdown_pct: float):
  with conn.cursor() as cur:
    cur.execute(
      """
      UPDATE challenge_subscriptions
      SET status = 'failed', fail_reason = %s, ended_at = NOW()
      WHERE id = %s;
      """,
      (reason, subscription_id),
    )
    cur.execute(
      """
      INSERT INTO risk_events (challenge_subscription_id, event_type, detail)
      VALUES (%s, 'daily_drawdown', jsonb_build_object('reason', %s, 'drawdown_pct', %s, 'at', %s));
      """,
      (subscription_id, reason, drawdown_pct, datetime.now(timezone.utc).isoformat()),
    )
  conn.commit()


def check_drawdowns():
  conn = get_connection()
  challenges = fetch_active_challenges(conn)

  for cs in challenges:
    positions = fetch_positions(conn, cs["id"])
    unrealized = 0.0
    for pos in positions:
      mark = fetch_price(conn, pos["provider"], pos["market_id"])
      unrealized += (mark - float(pos["price"])) * float(pos["quantity"])

    equity = float(cs["current_balance"]) + unrealized
    drawdown_pct = (equity - float(cs["day_start_balance"])) / float(
      cs["day_start_balance"]
    )
    if drawdown_pct <= -0.05:
      fail_subscription(
        conn,
        cs["id"],
        "Daily drawdown breach (-5%)",
        round(drawdown_pct * 100, 2),
      )

  conn.close()


if __name__ == "__main__":
  check_drawdowns()

