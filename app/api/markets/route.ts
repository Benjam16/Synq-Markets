import { NextRequest, NextResponse } from "next/server";
import { fetchAllMarkets } from "@/lib/market-fetchers";
import { query } from "@/lib/db";

export const revalidate = 0; // Fresh updates for the terminal

// In-memory cache for markets (60 second TTL - increased for better performance)
let cachedMarkets: { markets: any[]; timestamp: number } | null = null;
const CACHE_TTL = 60000; // 60 seconds - markets don't change that frequently

export async function GET(req: NextRequest) {
  try {
    // Fetch all markets - allow up to 5000 to get all 3000+ markets
    const limitParam = req.nextUrl.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 5000; // Default to 5000 to get all markets
    
    // Check cache first (only for full market list, not limited queries)
    const now = Date.now();
    if (limit >= 3000 && cachedMarkets && (now - cachedMarkets.timestamp) < CACHE_TTL) {
      const cacheAge = Math.round((now - cachedMarkets.timestamp) / 1000);
      console.log(`[Markets API] ✅ Serving from cache (${cacheAge}s old, ${cachedMarkets.markets.length} markets)`);
      
      return NextResponse.json({ markets: cachedMarkets.markets }, {
        headers: { 
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
          'X-Content-Type-Options': 'nosniff',
          'X-Cache': 'HIT',
        },
      });
    }
    
    console.log(`[Markets API] Fetching markets with limit: ${limit}`);
    const startTime = Date.now();
    const markets = await fetchAllMarkets(limit);
    const fetchTime = Date.now() - startTime;
    console.log(`[Markets API] Fetched ${markets.length} markets in ${fetchTime}ms`);

    if (markets.length > 0) {
      // Count by category for debugging
      const categoryCounts: Record<string, number> = {};
      markets.forEach((m: any) => {
        const cat = m.category || 'General';
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      });
      console.log(`[Markets API] Category distribution:`, categoryCounts);
      
      // Update cache (only for full market list)
      if (limit >= 3000) {
        cachedMarkets = { markets, timestamp: now };
        console.log(`[Markets API] ✅ Cached ${markets.length} markets`);
      }
      
      // Sync DB Cache (Top 50) - don't await, do in background
      Promise.all(
        markets.slice(0, 50).map(m =>
          query(
            `INSERT INTO market_price_cache (provider, market_id, last_price, as_of)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (provider, market_id) DO UPDATE SET last_price = EXCLUDED.last_price, as_of = EXCLUDED.as_of;`,
            [m.provider.toLowerCase(), m.id, m.price.toString()]
          ).catch(() => {}) 
        )
      ).catch(() => {});

      return NextResponse.json({ markets }, {
        headers: { 
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
          'X-Content-Type-Options': 'nosniff',
          'X-Cache': 'MISS',
        },
      });
    }

    console.warn(`[Markets API] No markets returned from fetchAllMarkets`);
    return NextResponse.json({ markets: [] });
  } catch (error) {
    console.error(`[Markets API] Error:`, error);
    return NextResponse.json({ 
      markets: [], 
      error: error instanceof Error ? error.message : "Sync failure",
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}