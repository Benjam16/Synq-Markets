import { NextRequest, NextResponse } from "next/server";

import { query } from "@/lib/db";
import { Position, Tier } from "@/lib/types";
import { fetchAllMarkets } from "@/lib/market-fetchers";

export const dynamic = 'force-dynamic';

type TradeRow = {
  id: number;
  market_id: string;
  provider: string;
  side: string;
  price: string;
  quantity: string;
  executed_at: string;
  market_name?: string;
  outcome?: string; // The specific outcome name (e.g., "Gavin Newsom")
};

type SubscriptionRow = {
  id: number;
  current_balance: string;
  day_start_balance: string;
};

type PriceRow = {
  provider: string;
  market_id: string;
  last_price: string;
};

export async function GET(req: NextRequest) {
  try {
    const userIdParam = req.nextUrl.searchParams.get("userId");
    const userId = userIdParam ? Number(userIdParam) : NaN;
    if (!userId || Number.isNaN(userId)) {
      return NextResponse.json(
        { error: "userId is required as a number" },
        { status: 400 },
      );
    }

    let subRes;
    try {
      try {
        subRes = await query<SubscriptionRow & { start_balance?: string; status?: string; fail_reason?: string }>(
          `
          SELECT 
            cs.id, 
            cs.current_balance, 
            cs.day_start_balance,
            cs.start_balance,
            LOWER(TRIM(cs.status)) AS status,
            cs.fail_reason,
            COALESCE(cs.phase, 'phase1') AS phase,
            COALESCE(cs.profit_split_pct, 0) AS profit_split_pct
          FROM challenge_subscriptions cs
          WHERE cs.user_id = $1
          ORDER BY 
            CASE WHEN LOWER(TRIM(cs.status)) = 'active' THEN 0 ELSE 1 END,
            cs.started_at DESC
          LIMIT 1;
          `,
          [userId],
        );
      } catch (colError: any) {
        if (colError?.message?.includes('column') || colError?.code === '42703') {
          console.warn('[Dashboard API] phase/profit_split_pct columns missing, querying without them');
          subRes = await query<SubscriptionRow & { start_balance?: string; status?: string; fail_reason?: string }>(
            `
            SELECT 
              cs.id, 
              cs.current_balance, 
              cs.day_start_balance,
              cs.start_balance,
              LOWER(TRIM(cs.status)) AS status,
              cs.fail_reason,
              'phase1' AS phase,
              0 AS profit_split_pct
            FROM challenge_subscriptions cs
            WHERE cs.user_id = $1
            ORDER BY 
              CASE WHEN LOWER(TRIM(cs.status)) = 'active' THEN 0 ELSE 1 END,
              cs.started_at DESC
            LIMIT 1;
            `,
            [userId],
          );
        } else {
          throw colError;
        }
      }
    } catch (dbError: any) {
      console.error('[Dashboard API] Database query error:', dbError);
      if (dbError?.code === '57P01' || 
          dbError?.message?.includes('terminating connection') ||
          dbError?.message?.includes('timeout') ||
          dbError?.message?.includes('connection')) {
        return NextResponse.json(
          {
            currentEquity: 0,
            cashBalance: 0,
            dayStartBalance: 0,
            dailyDrawdownPct: 0,
            positions: [],
            tiers: [],
            error: 'Database connection error. Please try again in a moment.',
          },
          { status: 503 }
        );
      }
      throw dbError;
    }

    const subscription = subRes.rows[0];
    
    // Check if account is closed/failed - normalize status (trim whitespace, lowercase)
    const rawStatus = subscription?.status || null;
    const normalizedStatus = rawStatus ? String(rawStatus).trim().toLowerCase() : 'inactive';
    const accountStatus = normalizedStatus === 'active' ? 'active' : normalizedStatus;
    const failReason = subscription?.fail_reason || null;
    
    // Debug logging to help diagnose the issue (always log, not just in dev)
    console.log('[Dashboard API] User:', userId, {
      subscriptionFound: !!subscription,
      subscriptionId: subscription?.id,
      rawStatus: rawStatus,
      normalizedStatus: normalizedStatus,
      accountStatus: accountStatus,
      failReason: failReason,
    });
    
    // Only proceed with dashboard data if subscription exists AND is active
    // Check normalized status to handle case/whitespace issues
    if (!subscription || normalizedStatus !== 'active') {
      if (subscription) {
        console.log('[Dashboard API] Subscription exists but not active.', {
          subscriptionId: subscription.id,
          rawStatus: rawStatus,
          normalizedStatus: normalizedStatus,
          expected: 'active',
        });
      } else {
        console.log('[Dashboard API] No subscription found for user:', userId);
      }
      // Return empty dashboard data instead of error
      // Also run risk check to see if any accounts need closing
      try {
        await fetch(`${req.nextUrl.origin}/api/risk-check`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }).catch(() => {});
      } catch {}
      let tiersRes;
      try {
        tiersRes = await query<Tier>(
          `
          SELECT id, name, account_size AS "accountSize", challenge_fee AS fee, target_audience AS target
          FROM account_tiers
          ORDER BY account_size ASC;
          `,
        );
      } catch (tierError: any) {
        console.error('Error fetching tiers:', tierError);
        // Return empty tiers on error
        return NextResponse.json({
          currentEquity: 0,
          cashBalance: 0,
          dayStartBalance: 0,
          dailyDrawdownPct: 0,
          positions: [],
          tiers: [],
        });
      }

      return NextResponse.json({
        currentEquity: 0,
        cashBalance: 0,
        dayStartBalance: 0,
        dailyDrawdownPct: 0,
        positions: [],
        tiers: tiersRes.rows.map((t: Tier) => ({
          ...t,
          accountSize: Number((t as any).accountSize ?? t.accountSize ?? 0),
          fee: Number((t as any).fee ?? t.fee ?? 0),
        })),
        accountStatus: accountStatus, // Use actual status (inactive, failed, closed, etc.)
        failReason: failReason, // Include fail reason if account was closed
        subscriptionId: subscription?.id || undefined, // Include subscription ID even if inactive
      });
    }

    let tradesRes;
    try {
      // First, let's check if there are ANY trades for this subscription (for debugging)
      const allTradesCheck = await query(
        `SELECT COUNT(*) as count FROM simulated_trades WHERE challenge_subscription_id = $1`,
        [subscription.id],
      );
      console.log('[Dashboard] Total trades for subscription', subscription.id, ':', allTradesCheck.rows[0]?.count || 0);

      // Try query with all columns first, then fallback if columns don't exist
      try {
        // First try with status and outcome columns
        tradesRes = await query<TradeRow & { market_name?: string; outcome?: string; status?: string }>(
          `
          SELECT 
            st.id, 
            st.market_id, 
            st.provider, 
            st.side, 
            st.price, 
            st.quantity, 
            st.executed_at,
            st.outcome,
            st.status,
            COALESCE(mm.name, st.market_id) AS market_name
          FROM simulated_trades st
          LEFT JOIN market_metadata mm ON mm.provider = st.provider AND mm.market_id = st.market_id
          WHERE st.challenge_subscription_id = $1 AND st.status = 'open'
          ORDER BY st.executed_at DESC
          `,
          [subscription.id],
        );
        console.log('[Dashboard] Found', tradesRes.rows.length, 'positions (with status/outcome columns)');
      } catch (colError: any) {
        // If status or outcome column doesn't exist, query without them
        if (colError?.message?.includes('column') || colError?.code === '42703') {
          console.log('[Dashboard] Status/outcome columns not found, querying basic columns only');
          try {
            tradesRes = await query<TradeRow & { market_name?: string }>(
              `
              SELECT 
                st.id, 
                st.market_id, 
                st.provider, 
                st.side, 
                st.price, 
                st.quantity, 
                st.executed_at,
                COALESCE(mm.name, st.market_id) AS market_name
              FROM simulated_trades st
              LEFT JOIN market_metadata mm ON mm.provider = st.provider AND mm.market_id = st.market_id
              WHERE st.challenge_subscription_id = $1
                AND (st.status = 'open' OR st.status IS NULL)
                AND st.close_price IS NULL
                AND st.closed_at IS NULL
              ORDER BY st.executed_at DESC
              `,
              [subscription.id],
            );
            console.log('[Dashboard] Found', tradesRes.rows.length, 'positions (basic columns only)');
          } catch (basicError: any) {
            console.error('[Dashboard] Error with basic query:', basicError);
            tradesRes = { rows: [] };
          }
        } else {
          console.error('[Dashboard] Unexpected error:', colError);
          throw colError;
        }
      }
    } catch (tradeError: any) {
      console.error('[Dashboard] Error fetching trades:', tradeError);
      tradesRes = { rows: [] };
    }

    // Trigger background price refresh (non-blocking) so cache stays warm
    try {
      fetch(`${req.nextUrl.origin}/api/cron/refresh-prices`).catch(() => {});
    } catch {}

    // Use price cache (kept fresh by /api/cron/refresh-prices)
    const priceMap = new Map<string, number>();
    const yesPriceMap = new Map<string, number>();
    const noPriceMap = new Map<string, number>();
    const marketNameMap = new Map<string, string>();
    const externalUrlMap = new Map<string, string>();
    
    if (tradesRes.rows.length > 0) {
      try {
        // STEP 1: Read fresh prices from cache
        const priceRows = await query<PriceRow>(
          `
          WITH keys AS (
            SELECT unnest($1::text[]) AS key
          )
          , parsed AS (
            SELECT split_part(key, ':', 1) AS provider,
                   split_part(key, ':', 2) AS market_id
            FROM keys
          )
          SELECT m.provider, m.market_id, m.last_price
          FROM parsed p
          JOIN market_price_cache m
            ON m.provider = p.provider
           AND m.market_id = p.market_id
           AND m.as_of > NOW() - INTERVAL '30 minutes';
          `,
          [tradesRes.rows.map((t: any) => `${t.provider}:${t.market_id}`)],
        );
        
        const cachedKeys = new Set<string>();
        priceRows.rows.forEach((row: PriceRow) => {
          const key = `${row.provider}:${row.market_id}`;
          const price = Number(row.last_price ?? 0);
          priceMap.set(key, price);
          yesPriceMap.set(key, price);
          noPriceMap.set(key, 1 - price);
          cachedKeys.add(key);
        });
        
        // STEP 2: For cache misses, try live market data (in-memory 30s cache)
        const missingKeys = tradesRes.rows
          .filter((t: any) => !cachedKeys.has(`${t.provider}:${t.market_id}`))
          .map((t: any) => ({ provider: t.provider, market_id: t.market_id, price: t.price }));

        if (missingKeys.length > 0) {
          try {
            const liveMarkets = await fetchAllMarkets(500);
            for (const mk of missingKeys) {
              const key = `${mk.provider}:${mk.market_id}`;
              const found = liveMarkets.find(m =>
                m.id === mk.market_id ||
                m.conditionId === mk.market_id ||
                m.id.endsWith(mk.market_id) ||
                mk.market_id.endsWith(m.id)
              );
              if (found && found.price > 0 && found.price < 1) {
                priceMap.set(key, found.price);
                yesPriceMap.set(key, found.price);
                noPriceMap.set(key, 1 - found.price);
                cachedKeys.add(key);
              }
            }
          } catch {
            // live fetch failed — will use entry price fallback below
          }
        }

        // STEP 3: Last resort — use entry price for anything still missing
        tradesRes.rows.forEach((t: any) => {
          const key = `${t.provider}:${t.market_id}`;
          if (!cachedKeys.has(key)) {
            const entryPrice = Number(t.price);
            priceMap.set(key, entryPrice);
            yesPriceMap.set(key, entryPrice);
            noPriceMap.set(key, 1 - entryPrice);
          }
        });
      } catch (priceError: any) {
        console.error('[Dashboard] Error fetching prices from cache:', priceError);
        tradesRes.rows.forEach((t: any) => {
          const key = `${t.provider}:${t.market_id}`;
          if (!priceMap.has(key)) {
            const entryPrice = Number(t.price);
            priceMap.set(key, entryPrice);
            yesPriceMap.set(key, entryPrice);
            noPriceMap.set(key, 1 - entryPrice);
          }
        });
      }

      // STEP 3: Load external URLs from market_metadata
      try {
        const urlRows = await query<{ provider: string; market_id: string; external_url: string }>(
          `SELECT provider, market_id, external_url FROM market_metadata
           WHERE external_url IS NOT NULL AND external_url != ''
             AND (provider, market_id) IN (SELECT unnest($1::text[]), unnest($2::text[]))`,
          [
            tradesRes.rows.map((t: any) => t.provider),
            tradesRes.rows.map((t: any) => t.market_id),
          ],
        );
        urlRows.rows.forEach((r) => {
          externalUrlMap.set(`${r.provider}:${r.market_id}`, r.external_url);
        });
      } catch {
        // external_url column may not exist yet — not critical
      }
    }

    const positions: Position[] = tradesRes.rows.map((t: any) => {
      // Get current price based on side (YES or NO)
      const tradeSide = (t.side || '').toUpperCase() === "NO" ? "NO" : "YES";
      let currentPrice = priceMap.get(`${t.provider}:${t.market_id}`);
      
      // If we have side-specific prices, use them
      if (tradeSide === 'YES' && yesPriceMap.has(`${t.provider}:${t.market_id}`)) {
        currentPrice = yesPriceMap.get(`${t.provider}:${t.market_id}`);
      } else if (tradeSide === 'NO' && noPriceMap.has(`${t.provider}:${t.market_id}`)) {
        currentPrice = noPriceMap.get(`${t.provider}:${t.market_id}`);
      }
      
      // Fallback to entry price if no current price found
      if (currentPrice === undefined || currentPrice === null || isNaN(currentPrice)) {
        currentPrice = Number(t.price);
      }
      
      // Get market name - prioritize live data, then database metadata, then format the ID nicely
      let marketName: string = marketNameMap.get(`${t.provider}:${t.market_id}`) || '';
      if (!marketName) {
        marketName = (t as any).market_name || '';
      }
      if (!marketName) {
        // Format the ID to be more readable
        const idStr = t.market_id.toString();
        // If it's just numbers, try to make it more readable
        if (/^\d+$/.test(idStr)) {
          marketName = `Market ${idStr}`;
        } else {
          // Remove provider prefix if present
          const cleaned = idStr.replace(/^(polymarket|kalshi)\./i, '').replace(/_/g, ' ').replace(/-/g, ' ');
          // Capitalize first letter of each word
          marketName = cleaned.split(' ').map((word: string) => 
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          ).join(' ');
        }
      }
      
      // Build display name: "Outcome Name - Market Name" or just "Market Name" if no outcome
      const outcomeName = t.outcome || '';
      const finalMarketName = marketName || t.market_id;
      const displayName = outcomeName && outcomeName !== 'YES' && outcomeName !== 'NO'
        ? `${outcomeName} - ${finalMarketName}`
        : finalMarketName;
      
      return {
        id: `trade-${t.id}`,
        marketId: t.market_id,
        marketName: displayName,
        outcome: outcomeName,
        provider: t.provider.toLowerCase() === "kalshi" ? "Kalshi" : "Polymarket",
        side: tradeSide as "YES" | "NO",
        entryPrice: Number(t.price),
        currentPrice,
        quantity: Number(t.quantity),
        externalUrl: externalUrlMap.get(`${t.provider}:${t.market_id}`) || undefined,
      };
    });

    // Calculate unrealized P&L correctly for YES and NO positions
    // This uses LIVE prices fetched from the markets API above
    const unrealized = positions.reduce((acc, pos) => {
      if (pos.side === "YES") {
        // YES: profit when price goes up (currentPrice > entryPrice)
        return acc + (pos.currentPrice - pos.entryPrice) * pos.quantity;
      } else {
        // NO: profit when price goes down (entryPrice > currentPrice)
        return acc + (pos.entryPrice - pos.currentPrice) * pos.quantity;
      }
    }, 0);

    const cashBalance = Number(subscription.current_balance ?? 0);
    // Current equity = cash + unrealized P&L (updates in real-time as prices change)
    const currentEquity = cashBalance + unrealized;
    const dayStartBalance = Number(subscription.day_start_balance ?? 0);
    const dailyDrawdownPct = dayStartBalance
      ? ((currentEquity - dayStartBalance) / dayStartBalance) * 100
      : 0;

    let tiersRes;
    try {
      tiersRes = await query<Tier>(
        `
        SELECT id, name, account_size AS "accountSize", challenge_fee AS fee, target_audience AS target
        FROM account_tiers
        ORDER BY account_size ASC;
        `,
      );
    } catch (tierError: any) {
      console.error('Error fetching tiers:', tierError);
      // Return empty tiers on error
      return NextResponse.json({
        currentEquity: 0,
        cashBalance: 0,
        dayStartBalance: 0,
        dailyDrawdownPct: 0,
        positions: [],
        tiers: [],
        error: 'Database connection error. Please try again in a moment.',
      }, { status: 503 });
    }

    // Get initial balance from start_balance column
    const initialBalance = subscription.start_balance 
      ? Number(subscription.start_balance) 
      : null;

    const phase = (subscription as any)?.phase || 'phase1';
    const profitSplitPct = Number((subscription as any)?.profit_split_pct || 0);

    // Fetch parlays with enriched current prices for each leg
    let parlaysWithPrices: any[] = [];
    try {
      const parlayRes = await query<{
        id: number; stake: string; combined_multiplier: string;
        potential_payout: string; status: string; legs: any;
        placed_at: string; settled_at: string | null;
      }>(
        `SELECT id, stake, combined_multiplier, potential_payout, status, legs, placed_at, settled_at
         FROM parlay_bets WHERE user_id = $1 ORDER BY placed_at DESC LIMIT 50`,
        [userId],
      );
      parlaysWithPrices = parlayRes.rows.map((p) => {
        const legs = typeof p.legs === 'string' ? JSON.parse(p.legs) : (p.legs || []);
        const enrichedLegs = legs.map((leg: any) => {
          const key = `${(leg.provider || '').toLowerCase()}:${leg.marketId}`;
          const cachedYes = yesPriceMap.get(key);
          const cachedNo = noPriceMap.get(key);
          const currentPrice = leg.outcome === 'no'
            ? (cachedNo ?? leg.price)
            : (cachedYes ?? leg.price);
          return { ...leg, currentPrice };
        });
        return { ...p, legs: enrichedLegs };
      });
    } catch {
      // parlay_bets table may not exist
    }

    const data: {
      currentEquity: number;
      cashBalance: number;
      dayStartBalance: number;
      dailyDrawdownPct: number;
      positions: Position[];
      tiers: Tier[];
      initialBalance?: number;
      accountStatus?: string;
      failReason?: string | null;
      subscriptionId?: number;
      unrealizedPnl?: number;
      phase?: string;
      profitSplitPct?: number;
      parlays?: any[];
    } = {
      currentEquity,
      cashBalance,
      dayStartBalance,
      unrealizedPnl: unrealized,
      dailyDrawdownPct,
      positions,
      tiers: tiersRes.rows.map((t: Tier) => ({
        ...t,
        accountSize: Number((t as any).accountSize ?? t.accountSize ?? 0),
        fee: Number((t as any).fee ?? t.fee ?? 0),
      })),
      initialBalance: initialBalance || undefined,
      accountStatus: accountStatus,
      failReason: failReason,
      subscriptionId: subscription?.id || undefined,
      phase,
      profitSplitPct,
      parlays: parlaysWithPrices,
    };

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error: any) {
    console.error('Dashboard API error:', error);
    
    // Handle database connection errors
    if (error?.message?.includes('terminating connection') || 
        error?.message?.includes('FATAL') ||
        error?.code === '57P01') {
      return NextResponse.json(
        { 
          error: 'Database connection error. Your Supabase project may be restoring. Please wait a moment and try again.',
          currentEquity: 0,
          cashBalance: 0,
          dayStartBalance: 0,
          dailyDrawdownPct: 0,
          positions: [],
          tiers: [],
        },
        { status: 503 }
      );
    }
    
    // Generic error response
    return NextResponse.json(
      { 
        error: error?.message || 'An error occurred while loading dashboard data',
        currentEquity: 0,
        cashBalance: 0,
        dayStartBalance: 0,
        dailyDrawdownPct: 0,
        positions: [],
        tiers: [],
      },
      { status: 500 }
    );
  }
}

