import { NextRequest, NextResponse } from "next/server";
import { fetchAllMarkets } from "@/lib/market-fetchers";

// Mark as dynamic since we use searchParams
export const dynamic = 'force-dynamic';
export const revalidate = 10; // Cache for 10 seconds

/**
 * Optimized endpoint for home page.
 * 
 * We fetch only the first 80 markets from the upstream sources and then:
 * - sort by volume descending (trending = highest volume)
 * - interleave Polymarket and Kalshi so the homepage always shows a mix of venues
 */
export async function GET(req: NextRequest) {
  try {
    const limitParam = req.nextUrl.searchParams.get("limit");
    const count = limitParam ? parseInt(limitParam, 10) : 6; // Default to 6 for home page
    
    console.log(`[Trending Markets API] Fetching top ${count} trending markets (from first 80)...`);
    const startTime = Date.now();
    
    // Fetch only 80 markets - this is much faster than full pagination but
    // gives us enough depth to include both Polymarket and Kalshi.
    const allMarkets = await fetchAllMarkets(80);
    
    // Sort by volume descending (trending = highest volume first)
    const sortedMarkets = allMarkets.sort((a: any, b: any) => (b.volume || 0) - (a.volume || 0));

    // Ensure a mix of providers on the homepage if possible.
    const poly = sortedMarkets.filter((m: any) => m.provider === "Polymarket");
    const kalshi = sortedMarkets.filter((m: any) => m.provider === "Kalshi");

    const mixed: any[] = [];
    let i = 0;
    while (mixed.length < count && (poly[i] || kalshi[i])) {
      if (poly[i]) mixed.push(poly[i]);
      if (mixed.length >= count) break;
      if (kalshi[i]) mixed.push(kalshi[i]);
      i += 1;
    }

    // If there still aren't enough, top up from the remaining sorted list.
    if (mixed.length < count) {
      const existingIds = new Set(mixed.map((m) => m.id));
      for (const m of sortedMarkets) {
        if (mixed.length >= count) break;
        if (!existingIds.has(m.id)) mixed.push(m);
      }
    }

    const trendingMarkets = mixed.slice(0, count);
    
    const fetchTime = Date.now() - startTime;
    console.log(`[Trending Markets API] Fetched ${trendingMarkets.length} trending markets from ${allMarkets.length} total in ${fetchTime}ms`);

    return NextResponse.json(
      { markets: trendingMarkets },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
          'X-Content-Type-Options': 'nosniff',
        },
      }
    );
  } catch (error) {
    console.error(`[Trending Markets API] Error:`, error);
    return NextResponse.json(
      {
        markets: [],
        error: error instanceof Error ? error.message : "Failed to fetch trending markets",
      },
      { status: 500 }
    );
  }
}
