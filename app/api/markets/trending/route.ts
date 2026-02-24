import { NextRequest, NextResponse } from "next/server";
import { fetchAllMarkets } from "@/lib/market-fetchers";

// Mark as dynamic since we use searchParams
export const dynamic = 'force-dynamic';
export const revalidate = 10; // Cache for 10 seconds

/**
 * Optimized endpoint for home page - fetches only top 50 trending markets
 * Returns 6 markets sorted by volume (highest first)
 * This is much faster than fetching all 3500+ markets
 * 
 * Strategy: 
 * 1. Fetch only first 50 markets (stops pagination early)
 * 2. Sort by volume descending (trending = highest volume)
 * 3. Return top 6
 */
export async function GET(req: NextRequest) {
  try {
    const limitParam = req.nextUrl.searchParams.get("limit");
    const count = limitParam ? parseInt(limitParam, 10) : 6; // Default to 6 for home page
    
    console.log(`[Trending Markets API] Fetching top ${count} trending markets (from first 50)...`);
    const startTime = Date.now();
    
    // Fetch only 50 markets - this is much faster since it stops after first batch
    // The limit parameter tells fetchAllMarkets to stop early
    const allMarkets = await fetchAllMarkets(50);
    
    // Sort by volume descending (trending = highest volume first)
    const sortedMarkets = allMarkets.sort((a: any, b: any) => (b.volume || 0) - (a.volume || 0));
    
    // Return only the requested count (default 6)
    const trendingMarkets = sortedMarkets.slice(0, count);
    
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
