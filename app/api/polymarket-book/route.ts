import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const tokenId = req.nextUrl.searchParams.get('token_id');
  if (!tokenId) {
    return NextResponse.json({ bids: [], asks: [] });
  }

  try {
    const res = await fetch(
      `https://clob.polymarket.com/book?token_id=${encodeURIComponent(tokenId)}`,
      {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      }
    );

    if (!res.ok) {
      return NextResponse.json({ bids: [], asks: [] });
    }

    const data = await res.json();
    const rawBids = (data.bids || []).slice(0, 20);
    const rawAsks = (data.asks || []).slice(0, 20);

    let bidTotal = 0;
    const bids = rawBids.map((b: { price?: string; size?: string }) => {
      const size = parseFloat(b.size || '0');
      bidTotal += size;
      return {
        price: parseFloat(b.price || '0') * 100,
        size: Math.round(size),
        total: Math.round(bidTotal),
      };
    });

    let askTotal = 0;
    const asks = rawAsks.map((a: { price?: string; size?: string }) => {
      const size = parseFloat(a.size || '0');
      askTotal += size;
      return {
        price: parseFloat(a.price || '0') * 100,
        size: Math.round(size),
        total: Math.round(askTotal),
      };
    });

    return NextResponse.json({ bids, asks });
  } catch {
    return NextResponse.json({ bids: [], asks: [] });
  }
}
