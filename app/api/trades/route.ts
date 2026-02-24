import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

type TradeRow = {
  id: number;
  provider: string;
  market_id: string;
  side: string;
  price: string;
  quantity: string;
  executed_at: string;
  status?: string;
  close_price?: string;
  closed_at?: string;
};

export async function GET(req: NextRequest) {
  try {
    const userIdParam = req.nextUrl.searchParams.get("userId");
    
    if (!userIdParam) {
      return NextResponse.json(
        { error: "userId parameter required" },
        { status: 400 }
      );
    }

    const userId = parseInt(userIdParam, 10);
    if (isNaN(userId)) {
      return NextResponse.json(
        { error: "Invalid userId" },
        { status: 400 }
      );
    }

    // Fetch all trades for the user, including closed ones
    const rows = await query<TradeRow>(
      `
      SELECT 
        st.id,
        st.provider,
        st.market_id,
        st.side,
        st.price,
        st.quantity,
        st.executed_at,
        st.status,
        st.close_price,
        st.closed_at
      FROM simulated_trades st
      JOIN challenge_subscriptions cs ON cs.id = st.challenge_subscription_id
      WHERE cs.user_id = $1
      ORDER BY st.executed_at DESC
      LIMIT 100;
      `,
      [userId],
    );

    const trades = rows.rows.map((row) => ({
      id: row.id,
      executed_at: row.executed_at,
      side: row.side.toLowerCase() as 'yes' | 'no',
      price: Number(row.price),
      quantity: Number(row.quantity),
      market_id: row.market_id,
      provider: row.provider,
      close_price: row.close_price ? Number(row.close_price) : undefined,
      status: (row.status || 'open') as 'open' | 'closed' | 'settled',
    }));

    return NextResponse.json({ trades });
  } catch (error) {
    console.error("Failed to load trades:", error);
    return NextResponse.json(
      { error: "Failed to load trades" },
      { status: 500 }
    );
  }
}

