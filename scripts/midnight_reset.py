"""
Midnight reset (12:00 AM EST). Schedules via cron:
0 0 * * * TZ=America/New_York python scripts/midnight_reset.py
"""

import os
from datetime import date

import psycopg2


def get_connection():
  return psycopg2.connect(os.environ["DATABASE_URL"])


def snapshot_and_reset():
  conn = get_connection()
  with conn.cursor() as cur:
    # Record ending balance into daily snapshots.
    cur.execute(
      """
      INSERT INTO daily_balance_snapshots (
        challenge_subscription_id,
        snapshot_date,
        starting_balance,
        ending_balance,
        equity,
        cash_balance
      )
      SELECT
        id,
        CURRENT_DATE,
        day_start_balance,
        current_balance,
        current_balance,
        current_balance
      FROM challenge_subscriptions
      WHERE status = 'active'
      ON CONFLICT (challenge_subscription_id, snapshot_date) DO NOTHING;
      """
    )

    # Reset day_start_balance for the new day.
    cur.execute(
      """
      UPDATE challenge_subscriptions
      SET day_start_balance = current_balance
      WHERE status = 'active';
      """
    )

  conn.commit()
  conn.close()


if __name__ == "__main__":
  snapshot_and_reset()

