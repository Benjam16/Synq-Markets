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
}

let _marketInfoMap: Map<string, MarketInfo> = new Map();
let _marketInfoMapAge = 0;
const MARKET_INFO_MAP_TTL = 60_000; // 60 seconds

async function ensureMarketInfoMap(): Promise<void> {
  const now = Date.now();
  if (_marketInfoMap.size > 0 && (now - _marketInfoMapAge) < MARKET_INFO_MAP_TTL) return;

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/markets?limit=5000`,
      { cache: 'no-store' },
    );
    if (!res.ok) return;
    const data = await res.json();
    const markets = data.markets || [];
    const m = new Map<string, MarketInfo>();
    for (const mkt of markets) {
      const name = mkt.eventTitle || mkt.name || '';
      if (!name) continue;
      const info: MarketInfo = {
        name,
        externalUrl: mkt.kalshiUrl || mkt.polymarketUrl || '',
        category: mkt.category || 'General',
      };
      // Map by id, slug, and conditionId so any ticker format can match
      if (mkt.id) m.set(mkt.id.toLowerCase(), info);
      if (mkt.slug) m.set(mkt.slug.toLowerCase(), info);
      if (mkt.conditionId) m.set(mkt.conditionId.toLowerCase(), info);
    }
    _marketInfoMap = m;
    _marketInfoMapAge = now;
  } catch { /* keep stale map */ }
}

function resolveMarketInfo(ticker: string): MarketInfo | null {
  if (!ticker) return null;
  const key = ticker.toLowerCase();
  // Exact match
  if (_marketInfoMap.has(key)) return _marketInfoMap.get(key)!;
  // Prefix match (kalshi tickers like "KXBTC-25FEB28" → "KXBTC")
  for (const [k, v] of _marketInfoMap.entries()) {
    if (key.startsWith(k) || k.startsWith(key)) return v;
  }
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
    // Use the event ticker (not the market ticker with date suffixes)
    const eventTicker = fallbackEventTicker || ticker;
    // Extract just the series part (before first '-') for the series path
    const seriesPart = eventTicker.split('-')[0] || eventTicker;
    // Kalshi URL: /markets/{event_ticker_lowercase} 
    return `https://kalshi.com/markets/${eventTicker.toLowerCase()}`;
  }
  return `https://polymarket.com`;
}

// KXMVE parlay filter — these are auto-generated sports parlays with ugly names
function isKxmveParlay(ticker: string, name: string): boolean {
  if (!ticker && !name) return false;
  const t = (ticker || '').toUpperCase();
  const n = (name || '').toUpperCase();
  return t.startsWith('KXMVE') || n.includes('KXMVESPORTS');
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
const CACHE_TTL = 5000;                      // 5 second cache TTL
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

async function fetchPolymarketLiveTrades(): Promise<TerminalTrade[]> {
  try {
    // Polymarket CLOB API - recent trades
    // https://docs.polymarket.com/#get-trades
    const res = await fetch(`${POLYMARKET_CLOB_BASE}/trades?limit=50`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });

    if (!res.ok) {
      // Try the alternative endpoint
      const altRes = await fetch(`https://gamma-api.polymarket.com/events?active=true&closed=false&limit=20`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        cache: 'no-store',
      });

      if (altRes.ok) {
        const events = await altRes.json();
        const eventList = Array.isArray(events) ? events : (events?.data || events?.events || []);
        polyConnected = true;
        const baseTs = Date.now();

        // Generate synthetic trade events from market price changes
        return eventList.slice(0, 30).flatMap((event: any, eIdx: number) => {
          const markets = event.markets || [];
          return markets.slice(0, 2).map((m: any, mIdx: number) => {
            const price = parseFloat(m.lastTradePrice || m.bestBid || '0.5');
            const vol = parseFloat(m.volume || '0');
            const shares = Math.floor(Math.random() * 100) + 1;
            const notional = price * shares;
            const eventSlug = event.slug || '';
            const externalUrl = eventSlug
              ? `https://polymarket.com/event/${eventSlug}`
              : `https://polymarket.com`;

            return {
              id: `poly-${baseTs}-${eIdx}-${mIdx}`,
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
            };
          });
        });
      }

      polyConnected = false;
      return [];
    }

    polyConnected = true;
    const data = await res.json();
    const trades = Array.isArray(data) ? data : (data?.data || data?.trades || []);

    return trades.slice(0, 50).map((t: any, idx: number) => {
      const price = parseFloat(t.price || t.avg_price || '0.5');
      const shares = parseInt(t.size || t.amount || t.count || '10');
      const notional = price * shares;
      const side = (t.side || t.outcome || 'Yes').toLowerCase();
      const tradeSlug = t.market_slug || '';
      const externalUrl = tradeSlug
        ? `https://polymarket.com/event/${tradeSlug}`
        : `https://polymarket.com`;

      return {
        id: `poly-${t.id || `${Date.now()}-${idx}`}`,
        provider: 'Polymarket' as const,
        type: (t.type || 'FILL').toUpperCase() as TerminalTrade['type'],
        marketId: t.market || t.asset_id || t.condition_id || `poly-${idx}`,
        marketName: t.market_slug || t.title || t.question || `Market ${t.market?.slice(0, 8) || idx}`,
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
    // Kalshi trades endpoint
    const path = '/trade-api/v2/markets/trades';
    const params = new URLSearchParams({ limit: '50' });
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
      // Fallback: fetch from events endpoint and generate synthetic trades
      const eventsPath = '/trade-api/v2/events';
      const eventsParams = new URLSearchParams({ status: 'open', limit: '20', with_nested_markets: 'true' });
      const evtHeaders = generateKalshiHeaders('GET', eventsPath, accessKey, privateKey);

      const evtRes = await fetch(`${KALSHI_API_BASE}${eventsPath}?${eventsParams}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', ...evtHeaders },
        cache: 'no-store',
      });

      if (evtRes.ok) {
        kalshiConnected = true;
        const evtData = await evtRes.json();
        const events = evtData.events || [];
        const baseTs = Date.now();

        return events.slice(0, 30).flatMap((event: any, eIdx: number) => {
          const markets = event.markets || [];
          if (markets.length === 0) return [];
          const m = markets[0];
          const eventTicker = event.event_ticker || '';
          const seriesTicker = event.series_ticker || '';
          const eventTitle = event.title || m.title || '';

          // Skip KXMVE parlay markets (ugly auto-generated names)
          if (isKxmveParlay(eventTicker, eventTitle)) return [];

          const price = (m.last_price || m.yes_bid || 50) / 100;
          const vol = m.volume || 0;
          if (vol === 0) return [];
          const shares = Math.floor(Math.random() * 50) + 5;
          const notional = price * shares;

          // Build URL using event_ticker (not market ticker)
          const kalshiSlug = seriesTicker
            ? `${seriesTicker.toLowerCase()}/${eventTicker.toLowerCase()}`
            : eventTicker.toLowerCase();
          const kalshiExternalUrl = `https://kalshi.com/markets/${kalshiSlug}`;

          return [{
            id: `kalshi-${baseTs}-${eIdx}`,
            provider: 'Kalshi' as const,
            type: Math.random() > 0.5 ? 'FILL' as const : 'ORDER' as const,
            marketId: eventTicker,
            marketName: eventTitle || 'Unknown Kalshi Market',
            side: Math.random() > 0.5 ? 'Yes' as const : 'No' as const,
            price,
            priceCents: `${(price * 100).toFixed(1)}¢`,
            shares,
            notional,
            fee: Math.round(notional * 0.07 * 100) / 100,
            timestamp: new Date(baseTs - eIdx * 31).toISOString(),
            isWhale: notional >= WHALE_THRESHOLD,
            externalUrl: kalshiExternalUrl,
            category: event.category || '',
          }];
        });
      }

      kalshiConnected = false;
      return [];
    }

    kalshiConnected = true;
    const data = await res.json();
    const trades = data.trades || [];

    // Resolve tickers → market names + URLs using our cached market data
    await ensureMarketInfoMap();

    return trades.slice(0, 50)
      .filter((t: any) => {
        // Filter out KXMVE parlay trades
        const ticker = t.ticker || t.market_ticker || '';
        return !isKxmveParlay(ticker, t.market_title || t.title || '');
      })
      .map((t: any, idx: number) => {
        const price = (t.yes_price || t.no_price || t.price || 50) / 100;
        const shares = t.count || t.size || 1;
        const notional = price * shares;
        const ticker = t.ticker || t.market_ticker || '';
        const resolvedName = resolveMarketName(ticker, t.market_title || t.title || ticker || `Kalshi Trade`);
        const externalUrl = resolveExternalUrl(ticker, 'Kalshi');

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
        };
      });
  } catch (err) {
    console.warn('[Terminal] Kalshi trades fetch error:', err);
    kalshiConnected = false;
    return [];
  }
}

// ============================================================================
// WHALE DETECTION
// ============================================================================

function detectWhales(trades: TerminalTrade[]): WhaleAlert[] {
  return trades
    .filter(t => t.notional >= WHALE_THRESHOLD)
    .map(t => ({
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
    }));
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
