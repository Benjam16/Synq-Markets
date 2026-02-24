import { NextResponse } from "next/server";
import { query } from "@/lib/db";

type LeaderRow = {
  user_id: number;
  email: string;
  full_name: string | null;
  current_balance: string;
  start_balance: string;
  roi: number;
};

// Mask email for privacy: "user@example.com" -> "u***@example.com"
function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return 'Trader';
  const [local, domain] = email.split('@');
  if (local.length <= 1) return email;
  const masked = local[0] + '***';
  return `${masked}@${domain}`;
}

// Generate trading alias from name or email
function getTradingAlias(fullName: string | null, email: string, userId: number): string {
  if (fullName && fullName.trim()) {
    return fullName;
  }
  // Use masked email as alias
  return maskEmail(email) || `Trader ${userId}`;
}

export async function GET() {
  try {
    // Get top traders by ROI (Return on Investment = total return)
    const rows = await query<LeaderRow & { email: string; roi: number }>(
      `
      WITH roi_calc AS (
        SELECT 
          cs.user_id,
          u.email,
          u.full_name,
          cs.current_balance,
          cs.start_balance,
          CASE 
            WHEN cs.start_balance > 0 
            THEN ((cs.current_balance - cs.start_balance) / cs.start_balance * 100)
            ELSE 0
          END AS roi
        FROM challenge_subscriptions cs
        JOIN users u ON u.id = cs.user_id
        WHERE cs.status = 'active' AND cs.start_balance > 0
      )
      SELECT 
        user_id,
        email,
        full_name,
        current_balance,
        start_balance,
        roi
      FROM roi_calc
      ORDER BY roi DESC
      LIMIT 10;
      `,
    );

    const leaders = rows.rows.map((row) => ({
      userId: row.user_id,
      tradingAlias: getTradingAlias(row.full_name, row.email, row.user_id),
      currentEquity: Number(row.current_balance || 0),
      startBalance: Number(row.start_balance || 0),
      roi: Number(row.roi || 0),
    }));

    // If no data, return mock leaders
    if (leaders.length === 0) {
      return NextResponse.json({
        leaders: [
          { userId: 1, tradingAlias: "Trader Alpha", currentEquity: 125000, startBalance: 100000, roi: 25.0 },
          { userId: 2, tradingAlias: "Trader Beta", currentEquity: 118000, startBalance: 100000, roi: 18.0 },
          { userId: 3, tradingAlias: "Trader Gamma", currentEquity: 112000, startBalance: 100000, roi: 12.0 },
          { userId: 4, tradingAlias: "Trader Delta", currentEquity: 105000, startBalance: 100000, roi: 5.0 },
          { userId: 5, tradingAlias: "Trader Epsilon", currentEquity: 98000, startBalance: 100000, roi: -2.0 },
        ],
      });
    }

    return NextResponse.json({ leaders }, {
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error("Failed to load leaderboard:", error);
    // Return mock data on error
    return NextResponse.json({
      leaders: [
        { userId: 1, tradingAlias: "Trader Alpha", currentEquity: 125000, startBalance: 100000, roi: 25.0 },
        { userId: 2, tradingAlias: "Trader Beta", currentEquity: 118000, startBalance: 100000, roi: 18.0 },
        { userId: 3, tradingAlias: "Trader Gamma", currentEquity: 112000, startBalance: 100000, roi: 12.0 },
        { userId: 4, tradingAlias: "Trader Delta", currentEquity: 105000, startBalance: 100000, roi: 5.0 },
        { userId: 5, tradingAlias: "Trader Epsilon", currentEquity: 98000, startBalance: 100000, roi: -2.0 },
      ],
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }
}

