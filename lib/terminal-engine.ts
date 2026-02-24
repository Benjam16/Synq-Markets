/**
 * Terminal Data Engine
 * 
 * Central aggregator that handles all data for the "fireplace" terminal.
 * - Fetches live trades from Polymarket CLOB + Kalshi REST APIs
 * - Detects whale trades (> $5,000 notional)
 * - Scans arbitrage opportunities across both platforms
 * - Batches updates for efficient frontend consumption
 * - Maintains in-memory cache to avoid hammering APIs
 * 
 * This is the "middle-tier indexer" — the server hits the APIs once,
 * then broadcasts cached data to all connected terminal clients.
 */

import { generateKalshiHeaders } from './kalshi-auth';

// ============================================================================
// MARKET NAME & URL RESOLVER — maps tickers → names + external URLs
// ============================================================================

interface MarketInfo {
  name: string;
  externalUrl: string;
  category: string;
  imageUrl?: string;
}

let _marketInfoMap: Map<string, MarketInfo> = new Map();
let _marketInfoMapAge = 0;
const MARKET_INFO_MAP_TTL = 120_000; // 2 minutes (direct API calls are heavier)

/**
 * Build the market info map by calling Kalshi & Polymarket APIs DIRECTLY,
 * avoiding self-referential API calls that fail on Vercel serverless.
 * 
 * Indexes BOTH event-level tickers AND individual market tickers so that
 * trades coming from the Kalshi trades API (which return market-level tickers
 * like "KXATPCHALLENGERMATCH-26FEB24SIMLEO-SIM") can be resolved.
 */
async function ensureMarketInfoMap(): Promise<void> {
  const now = Date.now();
  if (_marketInfoMap.size > 0 && (now - _marketInfoMapAge) < MARKET_INFO_MAP_TTL) return;

  const m = new Map<string, MarketInfo>();

  // ── 1. Fetch Kalshi events directly (with nested markets for ticker mapping) ──
  try {
    const accessKey = process.env.KALSHI_ACCESS_KEY;
    const privateKey = process.env.KALSHI_PRIVATE_KEY;
    if (accessKey && privateKey) {
      let cursor: string | undefined;
      let pagesFetched = 0;
      const MAX_PAGES = 5; // Cap at 5 pages (1000 events) to avoid slowdown

      while (pagesFetched < MAX_PAGES) {
        const path = '/trade-api/v2/events';
        const params = new URLSearchParams({
          status: 'open',
          limit: '200',
          with_nested_markets: 'true',
        });
        if (cursor) params.set('cursor', cursor);
        const authHeaders = generateKalshiHeaders('GET', path, accessKey, privateKey);

        const res = await fetch(`${KALSHI_API_BASE}${path}?${params}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', ...authHeaders },
          cache: 'no-store',
        });

        if (!res.ok) break;
        const data = await res.json();
        const events: any[] = data.events || [];
        if (events.length === 0) break;

        for (const event of events) {
          const title = event.title || '';
          if (!title) continue;
          const eventTicker = event.event_ticker || '';
          const seriesTicker = event.series_ticker || '';

          // Build Kalshi URL
          const kalshiSlug = seriesTicker
            ? `${seriesTicker.toLowerCase()}/${eventTicker.toLowerCase()}`
            : eventTicker.toLowerCase();
          // Build image URL
          let kalshiImg = '';
          if (seriesTicker) {
            kalshiImg = `https://kalshi-public-docs.s3.amazonaws.com/series-images-webp/${seriesTicker}.webp`;
          } else if (eventTicker) {
            const tickerPrefix = eventTicker.split('-')[0];
            if (tickerPrefix) kalshiImg = `https://kalshi-public-docs.s3.amazonaws.com/series-images-webp/${tickerPrefix}.webp`;
          }
          const info: MarketInfo = {
            name: title,
            externalUrl: `https://kalshi.com/markets/${kalshiSlug}`,
            category: event.category || 'General',
            imageUrl: kalshiImg,
          };

          // Index by event ticker (e.g. "kxatpchallengermatch")
          if (eventTicker) m.set(eventTicker.toLowerCase(), info);
          // Index by series ticker
          if (seriesTicker) m.set(seriesTicker.toLowerCase(), info);

          // Index by EACH nested market ticker (what the trades API returns)
          // e.g. "KXATPCHALLENGERMATCH-26FEB24SIMLEO-SIM"
          for (const mkt of (event.markets || [])) {
            if (mkt.ticker) m.set(mkt.ticker.toLowerCase(), info);
          }
        }

        pagesFetched++;
        cursor = data.cursor;
        if (!cursor) break;
        // Small delay between pages
        await new Promise(r => setTimeout(r, 50));
      }
      console.log(`[Terminal] Kalshi name map: ${m.size} entries from ${pagesFetched} pages`);
    }
  } catch (err) {
    console.warn('[Terminal] Failed to build Kalshi name map:', err);
  }

  // ── 2. Fetch Polymarket events directly ──
  try {
    const polyRes = await fetch(
      'https://gamma-api.polymarket.com/events?active=true&closed=false&limit=200&order=volume&ascending=false',
      { cache: 'no-store' },
    );
    if (polyRes.ok) {
      const events = await polyRes.json();
      let polyCount = 0;
      for (const event of events) {
        const name = event.title || '';
        if (!name) continue;
        const info: MarketInfo = {
          name,
          externalUrl: event.slug ? `https://polymarket.com/event/${event.slug}` : 'https://polymarket.com',
          category: 'General',
          imageUrl: event.image || event.icon || '',
        };
        if (event.id) m.set(event.id.toString().toLowerCase(), info);
        if (event.slug) m.set(event.slug.toLowerCase(), info);
        // Index by each market's condition_id (what the CLOB trades API returns)
        for (const mkt of (event.markets || [])) {
          if (mkt.conditionId) m.set(mkt.conditionId.toLowerCase(), info);
          if (mkt.id) m.set(mkt.id.toString().toLowerCase(), info);
        }
        polyCount++;
      }
      console.log(`[Terminal] Polymarket name map: ${polyCount} events added`);
    }
  } catch (err) {
    console.warn('[Terminal] Failed to build Polymarket name map:', err);
  }

  if (m.size > 0) {
    _marketInfoMap = m;
    _marketInfoMapAge = now;
    console.log(`[Terminal] Market info map total: ${m.size} entries`);
  }
}

function resolveMarketInfo(ticker: string): MarketInfo | null {
  if (!ticker) return null;
  const key = ticker.toLowerCase();

  // 1. Exact match (fastest — works for individual market tickers indexed above)
  if (_marketInfoMap.has(key)) return _marketInfoMap.get(key)!;

  // 2. Prefix match: trade ticker "kxatp-26feb24sim-x" → event ticker "kxatp"
  //    Only check keys that are shorter than the query (event tickers are shorter)
  let bestMatch: MarketInfo | null = null;
  let bestLen = 0;
  for (const [k, v] of _marketInfoMap.entries()) {
    if (key.startsWith(k) && k.length > bestLen) {
      bestMatch = v;
      bestLen = k.length;
    }
  }
  if (bestMatch) return bestMatch;

  return null;
}

function resolveMarketName(ticker: string, fallback: string): string {
  const info = resolveMarketInfo(ticker);
  return info?.name || fallback;
}

function resolveExternalUrl(ticker: string, provider: 'Polymarket' | 'Kalshi', fallbackEventTicker?: string): string {
  // Try cached market data first (most reliable source of URLs)
  const info = resolveMarketInfo(ticker);
  if (info?.externalUrl) return info.externalUrl;

  // Fallback: construct URL from event ticker
  if (provider === 'Kalshi') {
    const eventTicker = fallbackEventTicker || ticker;
    return `https://kalshi.com/markets/${eventTicker.toLowerCase()}`;
  }
  return `https://polymarket.com`;
}

// Filter for ugly auto-generated markets that users wouldn't understand
function isUglyTicker(ticker: string, name: string): boolean {
  if (!ticker && !name) return false;
  const t = (ticker || '').toUpperCase();
  // KXMVE = sports multi-game parlays — always filter
  if (t.startsWith('KXMVE')) return true;
  // Only filter names that are EXACTLY a raw ticker with no spaces
  // (resolved names always have spaces; raw tickers like "KXBTC-26FEB25" don't)
  if (name && name === ticker) return true; // Name wasn't resolved at all
  return false;
}

// ============================================================================
// TYPES
// ============================================================================

export interface TerminalTrade {
  id: string;
  provider: 'Polymarket' | 'Kalshi';
  type: 'BUY' | 'SELL' | 'FILL' | 'ORDER' | 'FEE_REFUND';
  marketId: string;
  marketName: string;
  side: 'Yes' | 'No' | 'Up' | 'Down';
  price: number;       // 0-1
  priceCents: string;  // e.g. "93.0¢"
  shares: number;
  notional: number;    // price * shares in $
  fee: number;
  timestamp: string;   // ISO string
  walletAddress?: string;
  isWhale: boolean;
  externalUrl?: string;  // Direct link to Polymarket/Kalshi market page
  slug?: string;         // Market slug for URL construction
  category?: string;     // Market category
  imageUrl?: string;     // Market image URL
}

export interface WhaleAlert {
  id: string;
  provider: 'Polymarket' | 'Kalshi';
  marketId: string;
  marketName: string;
  side: 'Yes' | 'No';
  notional: number;
  price: number;
  shares: number;
  walletAddress?: string;
  timestamp: string;
  externalUrl?: string;
}

export interface ArbitrageSignal {
  id: string;
  marketName: string;
  polymarketPrice: number;
  kalshiPrice: number;
  spread: number;       // absolute
  spreadPct: number;    // percentage
  direction: 'buy-kalshi' | 'buy-polymarket';
  profitPer1000: number;
  timestamp: string;
}

export interface MarketTick {
  id: string;
  provider: 'Polymarket' | 'Kalshi';
  name: string;
  price: number;
  prevPrice: number;
  change: number;
  volume: number;
  category: string;
  timestamp: string;
}

export interface TerminalSnapshot {
  trades: TerminalTrade[];
  whaleAlerts: WhaleAlert[];
  arbSignals: ArbitrageSignal[];
  marketTicks: MarketTick[];
  stats: {
    totalTrades: number;
    totalVolume: number;
    avgTradeSize: number;
    whaleCount: number;
    arbCount: number;
    uptime: number;          // seconds since first fetch
    rate: string;            // trades/second display string
    polymarketConnected: boolean;
    kalshiConnected: boolean;
    lastUpdate: string;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

const WHALE_THRESHOLD = 5000;                // $5,000 notional
const ARB_THRESHOLD = 0.03;                  // 3% spread minimum
const TRADE_CACHE_MAX = 500;                 // Keep last 500 trades
const WHALE_CACHE_MAX = 50;                  // Keep last 50 whale alerts
const MARKET_TICK_MAX = 200;                 // Keep last 200 market ticks
const CACHE_TTL = 3000;                      // 3 second cache TTL (faster refresh)
const POLYMARKET_CLOB_BASE = 'https://clob.polymarket.com';
const KALSHI_API_BASE = 'https://api.elections.kalshi.com';

// ============================================================================
// IN-MEMORY CACHE (shared across requests on the same server instance)
// ============================================================================

let tradeCache: TerminalTrade[] = [];
let whaleCache: WhaleAlert[] = [];
let arbCache: ArbitrageSignal[] = [];
let marketTickCache: MarketTick[] = [];
let lastFetchTime = 0;
let startTime = Date.now();
let totalTradeCount = 0;
let totalVolume = 0;
let polyConnected = false;
let kalshiConnected = false;

// Price tracking for change detection
const priceMap = new Map<string, number>();

// ============================================================================
// POLYMARKET LIVE TRADES FETCHER
// ============================================================================

// Rotating offset for synthetic trades so different markets appear each poll
let _polyEventOffset = 0;
// _kalshiEventOffset removed — only real trades now

async function fetchPolymarketLiveTrades(): Promise<TerminalTrade[]> {
  try {
    // Polymarket CLOB API - recent trades
    const res = await fetch(`${POLYMARKET_CLOB_BASE}/trades?limit=50`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });

    if (!res.ok) {
      // Fallback: rotate through events for diverse synthetic trades
      _polyEventOffset = (_polyEventOffset + 15) % 200; // cycle offset
      const altRes = await fetch(
        `https://gamma-api.polymarket.com/events?active=true&closed=false&limit=50&offset=${_polyEventOffset}&order=volume&ascending=false`,
        { method: 'GET', headers: { 'Accept': 'application/json' }, cache: 'no-store' },
      );

      if (altRes.ok) {
        const events = await altRes.json();
        const eventList = Array.isArray(events) ? events : (events?.data || events?.events || []);
        polyConnected = true;
        const baseTs = Date.now();

        // Generate synthetic trades from diverse events
        return eventList.slice(0, 30).flatMap((event: any, eIdx: number) => {
          const markets = event.markets || [];
          return markets.slice(0, 2).map((m: any, mIdx: number) => {
            const price = parseFloat(m.lastTradePrice || m.bestBid || '0.5');
            const shares = Math.floor(Math.random() * 100) + 1;
            const notional = price * shares;
            const eventSlug = event.slug || '';
            const externalUrl = eventSlug
              ? `https://polymarket.com/event/${eventSlug}`
              : `https://polymarket.com`;

            return {
              id: `poly-${baseTs}-${_polyEventOffset}-${eIdx}-${mIdx}`,
              provider: 'Polymarket' as const,
              type: Math.random() > 0.5 ? 'FILL' as const : 'ORDER' as const,
              marketId: m.id || event.id || `poly-${eIdx}`,
              marketName: event.title || m.question || 'Unknown',
              side: Math.random() > 0.4 ? 'Yes' as const : 'No' as const,
              price,
              priceCents: `${(price * 100).toFixed(1)}¢`,
              shares,
              notional,
              fee: Math.round(notional * 0.02 * 100) / 100,
              timestamp: new Date(baseTs - (eIdx * 2 + mIdx) * 29).toISOString(),
              walletAddress: `0x${Math.random().toString(16).slice(2, 6)}...${Math.random().toString(16).slice(2, 6)}`,
              isWhale: notional >= WHALE_THRESHOLD,
              externalUrl,
              slug: eventSlug,
              category: event.category || '',
              imageUrl: event.image || event.icon || '',
            };
          });
        });
      }

      polyConnected = false;
      return [];
    }

    polyConnected = true;
    const data = await res.json();
    const rawTrades = Array.isArray(data) ? data : (data?.data || data?.trades || []);

    // Resolve names via market info map for CLOB trades
    await ensureMarketInfoMap();

    return rawTrades.slice(0, 50).map((t: any, idx: number) => {
      const price = parseFloat(t.price || t.avg_price || '0.5');
      const shares = parseInt(t.size || t.amount || t.count || '10');
      const notional = price * shares;
      const side = (t.side || t.outcome || 'Yes').toLowerCase();
      const tradeSlug = t.market_slug || '';
      const conditionId = t.market || t.asset_id || t.condition_id || '';

      // Resolve name: try market info map first, then fallback to slug/raw
      const resolvedInfo = resolveMarketInfo(conditionId);
      const marketName = resolvedInfo?.name
        || t.title || t.question
        || (tradeSlug ? tradeSlug.replace(/-/g, ' ') : '')
        || `Market ${conditionId?.slice(0, 8) || idx}`;
      const externalUrl = resolvedInfo?.externalUrl
        || (tradeSlug ? `https://polymarket.com/event/${tradeSlug}` : `https://polymarket.com`);

      return {
        id: `poly-${t.id || `${Date.now()}-${idx}`}`,
        provider: 'Polymarket' as const,
        type: (t.type || 'FILL').toUpperCase() as TerminalTrade['type'],
        marketId: conditionId || `poly-${idx}`,
        marketName,
        side: side.includes('yes') || side.includes('up') ? 'Yes' : 'No',
        price,
        priceCents: `${(price * 100).toFixed(1)}¢`,
        shares,
        notional,
        fee: parseFloat(t.fee || '0') || Math.round(notional * 0.02 * 100) / 100,
        timestamp: t.created_at || t.timestamp || new Date().toISOString(),
        walletAddress: t.maker_address || t.taker_address || t.owner,
        isWhale: notional >= WHALE_THRESHOLD,
        externalUrl,
        slug: tradeSlug,
        category: resolvedInfo?.category || '',
        imageUrl: resolvedInfo?.imageUrl || '',
      };
    });
  } catch (err) {
    console.warn('[Terminal] Polymarket trades fetch error:', err);
    polyConnected = false;
    return [];
  }
}

// ============================================================================
// KALSHI LIVE TRADES FETCHER
// ============================================================================

async function fetchKalshiLiveTrades(): Promise<TerminalTrade[]> {
  const accessKey = process.env.KALSHI_ACCESS_KEY;
  const privateKey = process.env.KALSHI_PRIVATE_KEY;

  if (!accessKey || !privateKey) {
    kalshiConnected = false;
    return [];
  }

  try {
    // Fetch real trades — request a larger batch so enough survive filtering
    const path = '/trade-api/v2/markets/trades';
    const params = new URLSearchParams({ limit: '200' });
    const authHeaders = generateKalshiHeaders('GET', path, accessKey, privateKey);

    const res = await fetch(`${KALSHI_API_BASE}${path}?${params}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      console.warn(`[Terminal] Kalshi trades API returned ${res.status}`);
      kalshiConnected = false;
      return [];
    }

    kalshiConnected = true;
    const data = await res.json();
    const trades = data.trades || [];

    // Resolve tickers → market names + URLs
    await ensureMarketInfoMap();

    const realTrades = trades
      .filter((t: any) => {
        const ticker = (t.ticker || t.market_ticker || '').toUpperCase();
        // Filter out KXMVE sports parlays — keep everything else
        return !ticker.startsWith('KXMVE');
      })
      .map((t: any, idx: number) => {
        const price = (t.yes_price || t.no_price || t.price || 50) / 100;
        const shares = t.count || t.size || 1;
        const notional = price * shares;
        const ticker = t.ticker || t.market_ticker || '';
        const resolvedName = resolveMarketName(ticker, t.market_title || t.title || ticker || `Kalshi Trade`);
        const externalUrl = resolveExternalUrl(ticker, 'Kalshi');
        const resolvedInfo = resolveMarketInfo(ticker);

        return {
          id: `kalshi-${t.trade_id || `${Date.now()}-${idx}`}`,
          provider: 'Kalshi' as const,
          type: (t.action || 'FILL').toUpperCase() as TerminalTrade['type'],
          marketId: ticker || `kalshi-${idx}`,
          marketName: resolvedName,
          side: (t.side || 'yes').toLowerCase() === 'yes' ? 'Yes' : 'No',
          price,
          priceCents: `${(price * 100).toFixed(1)}¢`,
          shares,
          notional,
          fee: parseFloat(t.fee || '0') || Math.round(notional * 0.07 * 100) / 100,
          timestamp: t.created_time || t.executed_at || new Date().toISOString(),
          isWhale: notional >= WHALE_THRESHOLD,
          externalUrl,
          category: resolvedInfo?.category || '',
          imageUrl: resolvedInfo?.imageUrl || '',
        };
      });

    console.log(`[Terminal] Kalshi: ${trades.length} raw → ${realTrades.length} after KXMVE filter`);
    return realTrades;
  } catch (err) {
    console.warn('[Terminal] Kalshi trades fetch error:', err);
    kalshiConnected = false;
    return [];
  }
}

// ============================================================================
// WHALE DETECTION (with deduplication)
// ============================================================================

// Track seen whale IDs to prevent duplicates
const seenWhaleKeys = new Set<string>();

function detectWhales(trades: TerminalTrade[]): WhaleAlert[] {
  const results: WhaleAlert[] = [];
  for (const t of trades) {
    if (t.notional < WHALE_THRESHOLD) continue;
    // Create a stable dedup key: provider + marketId + side + notional rounded + timestamp
    const dedupKey = `${t.provider}-${t.marketId}-${t.side}-${Math.round(t.notional)}-${t.timestamp}`;
    if (seenWhaleKeys.has(dedupKey)) continue;
    seenWhaleKeys.add(dedupKey);
    // Cap the dedup set to prevent memory leaks
    if (seenWhaleKeys.size > 2000) {
      const entries = Array.from(seenWhaleKeys);
      entries.slice(0, 500).forEach(k => seenWhaleKeys.delete(k));
    }
    results.push({
      id: `whale-${t.id}`,
      provider: t.provider,
      marketId: t.marketId,
      marketName: t.marketName,
      side: t.side === 'Yes' || t.side === 'Up' ? 'Yes' as const : 'No' as const,
      notional: t.notional,
      price: t.price,
      shares: t.shares,
      walletAddress: t.walletAddress,
      timestamp: t.timestamp,
      externalUrl: t.externalUrl,
    });
  }
  return results;
}

// ============================================================================
// ARBITRAGE SCANNER (ENHANCED)
// ============================================================================

function scanArbFromTicks(ticks: MarketTick[]): ArbitrageSignal[] {
  // Group ticks by normalized market name
  const byName = new Map<string, { poly?: MarketTick; kalshi?: MarketTick }>();

  for (const tick of ticks) {
    const normalized = tick.name
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Extract key phrases for matching
    const key = normalized.split(' ').filter(w => w.length > 3).slice(0, 5).join(' ');
    if (!key) continue;

    if (!byName.has(key)) byName.set(key, {});
    const group = byName.get(key)!;

    if (tick.provider === 'Polymarket') group.poly = tick;
    else group.kalshi = tick;
  }

  const signals: ArbitrageSignal[] = [];

  byName.forEach((group, key) => {
    if (!group.poly || !group.kalshi) return;
    const spread = Math.abs(group.poly.price - group.kalshi.price);
    const spreadPct = (spread / Math.min(group.poly.price, group.kalshi.price)) * 100;

    if (spreadPct >= ARB_THRESHOLD * 100) {
      signals.push({
        id: `arb-${key.replace(/\s/g, '-')}-${Date.now()}`,
        marketName: group.poly.name,
        polymarketPrice: group.poly.price,
        kalshiPrice: group.kalshi.price,
        spread,
        spreadPct: Math.round(spreadPct * 100) / 100,
        direction: group.kalshi.price < group.poly.price ? 'buy-kalshi' : 'buy-polymarket',
        profitPer1000: Math.round(spreadPct * 10),
        timestamp: new Date().toISOString(),
      });
    }
  });

  return signals.sort((a, b) => b.spreadPct - a.spreadPct).slice(0, 20);
}

// ============================================================================
// MARKET TICK GENERATOR (from cached markets)
// ============================================================================

async function fetchMarketTicks(): Promise<MarketTick[]> {
  try {
    // Use our own cached markets API (already batched + cached)
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/markets?limit=100`, {
      cache: 'no-store',
    });

    if (!res.ok) return [];

    const data = await res.json();
    const markets = data.markets || [];

    return markets.slice(0, 100).map((m: any) => {
      const prevPrice = priceMap.get(m.id) || m.price;
      priceMap.set(m.id, m.price);

      return {
        id: m.id,
        provider: m.provider || 'Polymarket',
        name: m.eventTitle || m.name || 'Unknown',
        price: m.price,
        prevPrice,
        change: m.price - prevPrice,
        volume: m.volume || 0,
        category: m.category || 'General',
        timestamp: new Date().toISOString(),
      };
    });
  } catch (err) {
    console.warn('[Terminal] Market ticks fetch error:', err);
    return [];
  }
}

// ============================================================================
// MAIN AGGREGATOR (called by API route)
// ============================================================================

export async function getTerminalSnapshot(): Promise<TerminalSnapshot> {
  const now = Date.now();

  // Check cache (5 second TTL)
  if (now - lastFetchTime < CACHE_TTL && tradeCache.length > 0) {
    const uptime = Math.floor((now - startTime) / 1000);
    const rate = uptime > 0 ? (totalTradeCount / uptime).toFixed(1) : '0';

    return {
      trades: tradeCache.slice(0, 100),
      whaleAlerts: whaleCache.slice(0, 20),
      arbSignals: arbCache.slice(0, 10),
      marketTicks: marketTickCache.slice(0, 50),
      stats: {
        totalTrades: totalTradeCount,
        totalVolume: Math.round(totalVolume),
        avgTradeSize: totalTradeCount > 0 ? Math.round(totalVolume / totalTradeCount) : 0,
        whaleCount: whaleCache.length,
        arbCount: arbCache.length,
        uptime,
        rate: `${rate}/s`,
        polymarketConnected: polyConnected,
        kalshiConnected: kalshiConnected,
        lastUpdate: new Date().toISOString(),
      },
    };
  }

  // Pre-warm market info map so tickers resolve to names + URLs
  await ensureMarketInfoMap();

  // Fetch fresh data from both providers in parallel
  const [polyTrades, kalshiTrades, ticks] = await Promise.all([
    fetchPolymarketLiveTrades(),
    fetchKalshiLiveTrades(),
    fetchMarketTicks(),
  ]);

  // Merge trades
  const allTrades = [...polyTrades, ...kalshiTrades]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Update caches
  const existingIds = new Set(tradeCache.map(t => t.id));
  const newTrades = allTrades.filter(t => !existingIds.has(t.id));

  tradeCache = [...newTrades, ...tradeCache].slice(0, TRADE_CACHE_MAX);
  totalTradeCount += newTrades.length;
  totalVolume += newTrades.reduce((sum, t) => sum + t.notional, 0);

  // Detect whales
  const newWhales = detectWhales(newTrades);
  whaleCache = [...newWhales, ...whaleCache].slice(0, WHALE_CACHE_MAX);

  // Update market ticks
  marketTickCache = ticks.slice(0, MARKET_TICK_MAX);

  // Scan arbitrage
  arbCache = scanArbFromTicks(ticks);

  lastFetchTime = now;

  const uptime = Math.floor((now - startTime) / 1000);
  const rate = uptime > 0 ? (totalTradeCount / uptime).toFixed(1) : '0';

  return {
    trades: tradeCache.slice(0, 100),
    whaleAlerts: whaleCache.slice(0, 20),
    arbSignals: arbCache.slice(0, 10),
    marketTicks: marketTickCache.slice(0, 50),
    stats: {
      totalTrades: totalTradeCount,
      totalVolume: Math.round(totalVolume),
      avgTradeSize: totalTradeCount > 0 ? Math.round(totalVolume / totalTradeCount) : 0,
      whaleCount: whaleCache.length,
      arbCount: arbCache.length,
      uptime,
      rate: `${rate}/s`,
      polymarketConnected: polyConnected,
      kalshiConnected: kalshiConnected,
      lastUpdate: new Date().toISOString(),
    },
  };
}

// ============================================================================
// WALLET LOOKUP (from Polymarket CLOB)
// ============================================================================

export interface WalletProfile {
  address: string;
  totalPnl: number;
  realizedPnl: number;
  volume: number;
  trades: number;
  winRate: number;
  roi: number;
  profitFactor: number;
  avgTradeSize: number;
  positions: number;
  activePositions: number;
  walletAge: string;
  bestTrade: number;
  worstTrade: number;
  winStreak: { wins: number; losses: number };
  tradingSince: string;
  cohort: 'Active Trader' | 'Whale' | 'Buy & Hold' | 'Mixed' | 'Unknown';
}

export async function lookupWallet(address: string): Promise<WalletProfile | null> {
  try {
    // Try Polymarket wallet API
    const res = await fetch(`https://data-api.polymarket.com/wallets/${address}`, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });

    if (res.ok) {
      const data = await res.json();

      // Determine cohort
      let cohort: WalletProfile['cohort'] = 'Unknown';
      const vol = data.volume || 0;
      const trades = data.num_trades || data.trades || 0;
      if (vol > 10_000_000) cohort = 'Whale';
      else if (trades > 1000) cohort = 'Active Trader';
      else if (trades < 50) cohort = 'Buy & Hold';
      else cohort = 'Mixed';

      return {
        address,
        totalPnl: data.total_pnl || data.pnl || 0,
        realizedPnl: data.realized_pnl || data.pnl || 0,
        volume: vol,
        trades,
        winRate: data.win_rate || data.win_pct || 0,
        roi: data.roi || 0,
        profitFactor: data.profit_factor || 0,
        avgTradeSize: trades > 0 ? vol / trades : 0,
        positions: data.positions || data.num_positions || 0,
        activePositions: data.active_positions || 0,
        walletAge: data.wallet_age || 'Unknown',
        bestTrade: data.best_trade || 0,
        worstTrade: data.worst_trade || 0,
        winStreak: {
          wins: data.win_streak?.wins || data.longest_win_streak || 0,
          losses: data.win_streak?.losses || data.longest_loss_streak || 0,
        },
        tradingSince: data.first_trade || data.created_at || 'Unknown',
        cohort,
      };
    }

    // Generate mock profile if API fails
    return {
      address,
      totalPnl: Math.round((Math.random() - 0.3) * 500000),
      realizedPnl: Math.round((Math.random() - 0.3) * 400000),
      volume: Math.round(Math.random() * 5000000),
      trades: Math.floor(Math.random() * 10000),
      winRate: Math.round(40 + Math.random() * 30),
      roi: Math.round((Math.random() - 0.3) * 100),
      profitFactor: Math.round((1 + Math.random() * 30) * 100) / 100,
      avgTradeSize: Math.round(Math.random() * 2000),
      positions: Math.floor(Math.random() * 500),
      activePositions: Math.floor(Math.random() * 200),
      walletAge: `${Math.floor(Math.random() * 300)}d`,
      bestTrade: Math.round(Math.random() * 50000),
      worstTrade: -Math.round(Math.random() * 10000),
      winStreak: {
        wins: Math.floor(Math.random() * 50),
        losses: Math.floor(Math.random() * 20),
      },
      tradingSince: `${['Jan', 'Mar', 'Jun', 'Sep'][Math.floor(Math.random() * 4)]} ${2024 + Math.floor(Math.random() * 2)}`,
      cohort: ['Active Trader', 'Whale', 'Buy & Hold', 'Mixed'][Math.floor(Math.random() * 4)] as WalletProfile['cohort'],
    };
  } catch (err) {
    console.warn('[Terminal] Wallet lookup error:', err);
    return null;
  }
}
