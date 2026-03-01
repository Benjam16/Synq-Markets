/**
 * Terminal Data Engine
 * 
 * Central aggregator that handles all data for the "fireplace" terminal.
 * - Fetches live trades from Polymarket CLOB + Kalshi REST APIs
 * - Polls MULTIPLE Kalshi categories for feed diversity
 * - Detects whale trades (> $2,000 notional) — force-inserted at top
 * - Scans arbitrage opportunities across both platforms
 * - Batches updates for efficient frontend consumption
 * - Maintains in-memory cache to avoid hammering APIs
 * - Warms global price cache for instant trade execution
 */

import { generateKalshiHeaders } from './kalshi-auth';
import { warmPriceCache } from './fast-price-lookup';

// ============================================================================
// MARKET NAME & URL RESOLVER — maps tickers → names + external URLs
// ============================================================================

interface MarketInfo {
  name: string;
  externalUrl: string;
  category: string;
  imageUrl?: string;
  tokenId?: string;
  outcomeIndex?: number;
  /** When true, market has already resolved — exclude from live feed */
  settled?: boolean;
}

let _marketInfoMap: Map<string, MarketInfo> = new Map();
let _marketInfoMapAge = 0;
const MARKET_INFO_MAP_TTL = 300_000; // 5 minutes
const _tickerFetchCache = new Map<string, number>();
const TICKER_FETCH_CACHE_TTL = 60_000; // 1 min — retry failed fetches sooner for better names

/**
 * Build the market info map from Kalshi & Polymarket APIs.
 * Indexes BOTH event-level tickers AND individual market tickers.
 */
async function ensureMarketInfoMap(): Promise<void> {
  const now = Date.now();
  if (_marketInfoMap.size > 0 && (now - _marketInfoMapAge) < MARKET_INFO_MAP_TTL) return;

  const m = new Map<string, MarketInfo>();

  // ── 1. Fetch Kalshi events (with nested markets for ticker mapping) — public API, no auth required ──
  try {
    const accessKey = process.env.KALSHI_ACCESS_KEY;
    const privateKey = process.env.KALSHI_PRIVATE_KEY;
    let cursor: string | undefined;
    let pagesFetched = 0;
    const MAX_PAGES = 5;

    while (pagesFetched < MAX_PAGES) {
      const path = '/trade-api/v2/events';
      const params = new URLSearchParams({
        status: 'open',
        limit: '200',
        with_nested_markets: 'true',
      });
      if (cursor) params.set('cursor', cursor);

      const headers: Record<string, string> = { 'Accept': 'application/json', 'Content-Type': 'application/json' };
      if (accessKey && privateKey) {
        try {
          const authHeaders = generateKalshiHeaders('GET', path, accessKey, privateKey);
          Object.assign(headers, authHeaders);
        } catch { /* proceed without auth */ }
      }

      const res = await fetch(`${KALSHI_API_BASE}${path}?${params}`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      });

      if (!res.ok) break;
      const data = await res.json();
      const events: any[] = data.events || [];
      if (events.length === 0) break;

      for (const event of events) {
        indexKalshiEvent(m, event);
      }

      pagesFetched++;
      cursor = data.cursor;
      if (!cursor) break;
      await new Promise(r => setTimeout(r, 50));
    }

    // ── 1b. Targeted fetch for sports, challenger, cricket, gov, EPL (real names instead of "T20MATCH market") ──
    const SPORTS_SERIES = [
      'KXNCAAMBSPREAD', 'KXNCAAMBGAME', 'KXNHL', 'KXNBA', 'KXNFL', 'KXMLB', 'KXNCAA', 'KXATP', 'KXWTA', 'KXEPL', 'KXLIGA', 'KXBUNDESLIGA2GAME',
      'KXATPCHALLENGERMATCH', 'KXWTACHALLENGERMATCH', 'KXSERIEA', 'KXCS2', 'KXNYCSNOWM',
      'KXT20MATCH', 'KXGOVTSHUTLENGTH', 'KXEPLTOTAL',
      'KXXRP15M', 'KXBTC15M', 'KXETH15M', 'KXSOL15M', 'KXEARNINGSMENTIONEA',
    ];
    for (const series of SPORTS_SERIES) {
      try {
        const spParams = new URLSearchParams({
          status: 'open',
          limit: '100',
          with_nested_markets: 'true',
          series_ticker: series,
        });
        const spHeaders: Record<string, string> = { 'Accept': 'application/json' };
        if (accessKey && privateKey) {
          try {
            Object.assign(spHeaders, generateKalshiHeaders('GET', '/trade-api/v2/events', accessKey, privateKey));
          } catch { /* skip auth */ }
        }
        const spRes = await fetch(`${KALSHI_API_BASE}/trade-api/v2/events?${spParams}`, {
          method: 'GET',
          headers: spHeaders,
          cache: 'no-store',
          signal: AbortSignal.timeout(5000),
        });
        if (spRes.ok) {
          const spData = await spRes.json();
          for (const ev of (spData.events || [])) {
            indexKalshiEvent(m, ev);
          }
        }
      } catch { /* skip */ }
    }
    console.log(`[Terminal] Kalshi name map: ${m.size} entries (incl. sports)`);
  } catch (err) {
    console.warn('[Terminal] Failed to build Kalshi name map:', err);
  }

  // ── 2. Fetch Polymarket events directly ──
  try {
    const polyRes = await fetch(
      'https://gamma-api.polymarket.com/events?active=true&closed=false&limit=500&order=volume&ascending=false',
      { cache: 'no-store' },
    );
    if (polyRes.ok) {
      const events = await polyRes.json();
      let polyCount = 0;
      for (const event of events) {
        indexPolymarketEvent(m, event);
        polyCount++;
      }
      console.log(`[Terminal] Polymarket name map: ${polyCount} events added`);
    }
  } catch (err) {
    console.warn('[Terminal] Failed to build Polymarket name map:', err);
  }

  // ── Tag fast crypto market entries as 'Crypto' ──
  let cryptoTagCount = 0;
  const CRYPTO_KW = ['bitcoin', 'btc', 'ethereum', 'eth', 'solana', 'sol', 'xrp', 'doge', 'avax', 'link', 'bnb', 'crypto'];
  const CRYPTO_TICKER_PREFIXES = ['kxbtc', 'kxeth', 'kxsol', 'kxxrp', 'kxdoge', 'kxavax', 'kxlink', 'kxbnb', 'kxada', 'kxmatic', 'kxdot'];
  for (const [key, info] of m.entries()) {
    if (info.category === 'Crypto') continue;
    const nameLower = info.name.toLowerCase();
    const keyLower = key.toLowerCase();
    const isCrypto =
      CRYPTO_KW.some(kw => nameLower.includes(kw)) ||
      CRYPTO_TICKER_PREFIXES.some(prefix => keyLower.startsWith(prefix));
    if (isCrypto) {
      m.set(key, { ...info, category: 'Crypto' });
      cryptoTagCount++;
    }
  }
  console.log(`[Terminal] Tagged ${cryptoTagCount} entries as Crypto`);

  if (m.size > 0) {
    _marketInfoMap = m;
    _marketInfoMapAge = now;
    console.log(`[Terminal] Market info map total: ${m.size} entries`);
  }
}

function indexKalshiEvent(m: Map<string, MarketInfo>, event: any): void {
  const title = event.title || '';
  if (!title) return;
  const eventTicker = event.event_ticker || '';
  const seriesTicker = event.series_ticker || '';
  const category = event.category || 'General';

  const kalshiSlug = seriesTicker
    ? seriesTicker.toLowerCase()
    : eventTicker.split('-')[0].toLowerCase();
  let kalshiImg = '';
  if (seriesTicker) {
    kalshiImg = `https://kalshi-public-docs.s3.amazonaws.com/series-images-webp/${seriesTicker}.webp`;
  } else if (eventTicker) {
    const tickerPrefix = eventTicker.split('-')[0];
    if (tickerPrefix) kalshiImg = `https://kalshi-public-docs.s3.amazonaws.com/series-images-webp/${tickerPrefix}.webp`;
  }

  // Map Kalshi API categories to display categories
  const catLower = (category || '').toLowerCase();
  let mappedCategory = 'General';
  if (catLower.includes('politic') || catLower.includes('election') || catLower.includes('government')) mappedCategory = 'Politics';
  else if (catLower.includes('crypto') || catLower.includes('bitcoin') || catLower.includes('digital')) mappedCategory = 'Crypto';
  else if (catLower.includes('sport') || catLower.includes('nba') || catLower.includes('nfl') || catLower.includes('mlb')) mappedCategory = 'Sports';
  else if (catLower.includes('econ') || catLower.includes('financ') || catLower.includes('market') || catLower.includes('stock')) mappedCategory = 'Economy';
  else if (catLower.includes('weather') || catLower.includes('climate') || catLower.includes('temp')) mappedCategory = 'Weather';
  else if (catLower.includes('entertain') || catLower.includes('culture') || catLower.includes('social') || catLower.includes('media')) mappedCategory = 'Pop Culture';
  else if (catLower.includes('tech') || catLower.includes('ai') || catLower.includes('company')) mappedCategory = 'Tech';
  else if (title.toLowerCase().includes('bitcoin') || title.toLowerCase().includes('ethereum') || title.toLowerCase().includes('crypto')) mappedCategory = 'Crypto';
  else if (title.toLowerCase().includes('trump') || title.toLowerCase().includes('biden') || title.toLowerCase().includes('president') || title.toLowerCase().includes('congress')) mappedCategory = 'Politics';

  const info: MarketInfo = {
    name: title,
    externalUrl: `https://kalshi.com/markets/${kalshiSlug}`,
    category: mappedCategory,
    imageUrl: kalshiImg,
  };

  if (eventTicker) m.set(eventTicker.toLowerCase(), info);
  if (seriesTicker) m.set(seriesTicker.toLowerCase(), info);

  for (const mkt of (event.markets || [])) {
    if (mkt.status === 'settled' || mkt.status === 'closed') continue;
    if (mkt.ticker) {
      const rawTitle = mkt.title || mkt.subtitle || mkt.yes_sub_title || '';
      let mktTitle = rawTitle.replace(/^::\s*/g, '').replace(/^--\s*/g, '').trim();

      if (!mktTitle && mkt.floor_strike != null && mkt.cap_strike != null) {
        const floor = Number(mkt.floor_strike);
        const cap = Number(mkt.cap_strike);
        const fmt = (n: number) => n >= 1000 ? `$${n.toLocaleString('en-US')}` : `$${n}`;
        mktTitle = `${fmt(floor)} to ${fmt(cap)}`;
      } else if (!mktTitle && mkt.floor_strike != null) {
        mktTitle = `≥ $${Number(mkt.floor_strike).toLocaleString('en-US')}`;
      } else if (!mktTitle && mkt.cap_strike != null) {
        mktTitle = `≤ $${Number(mkt.cap_strike).toLocaleString('en-US')}`;
      }

      const specificName = (mktTitle && mktTitle.toLowerCase() !== title.toLowerCase())
        ? `${mktTitle} – ${title}`
        : title;
      m.set(mkt.ticker.toLowerCase(), {
        ...info,
        name: specificName,
      });
    }
  }
}

function indexPolymarketEvent(m: Map<string, MarketInfo>, event: any): void {
  const name = event.title || '';
  if (!name) return;
  const ANON_PATTERN = /\b(Person|Player|Company|Team|Candidate|Entity)\s+[A-Z]\b/i;
  const info: MarketInfo = {
    name,
    externalUrl: event.slug ? `https://polymarket.com/event/${event.slug}` : 'https://polymarket.com',
    category: 'General',
    imageUrl: event.image || event.icon || '',
  };
  if (event.id) m.set(event.id.toString().toLowerCase(), info);
  if (event.slug) m.set(event.slug.toLowerCase(), info);

  for (let mktIdx = 0; mktIdx < (event.markets || []).length; mktIdx++) {
    const mkt = event.markets[mktIdx];
    if (mkt.closed === true || mkt.active === false) continue;
    const mktQuestion = mkt.question || '';
    const isAnonymized = ANON_PATTERN.test(mktQuestion);
    let specificName: string;
    if (mktQuestion && !isAnonymized) {
      specificName = mktQuestion;
    } else if (mkt.groupItemTitle) {
      specificName = `${mkt.groupItemTitle} – ${name}`;
    } else {
      specificName = name;
    }
    let yesTokenId: string | undefined;
    try {
      const clobIds = mkt.clobTokenIds ? JSON.parse(mkt.clobTokenIds) : [];
      if (clobIds.length > 0) yesTokenId = clobIds[0];
    } catch { /* ignore */ }
    const mktInfo: MarketInfo = {
      ...info,
      name: specificName,
      imageUrl: mkt.image || event.image || event.icon || '',
      tokenId: yesTokenId,
      outcomeIndex: mktIdx,
    };
    if (mkt.conditionId) m.set(mkt.conditionId.toLowerCase(), mktInfo);
    if (mkt.id) m.set(mkt.id.toString().toLowerCase(), mktInfo);
  }
}

/** Fetch market title from Kalshi API (public endpoint, no auth) for tickers not in map. */
async function fetchMarketTitlesForTickers(tickers: string[]): Promise<void> {
  const now = Date.now();
  // Expire failed-fetch cache entries after 2 min so we retry
  for (const [t, ts] of [..._tickerFetchCache.entries()]) {
    if (now - ts > TICKER_FETCH_CACHE_TTL) _tickerFetchCache.delete(t);
  }

  const unique = [...new Set(tickers.filter(Boolean))];
  const toFetch = unique
    .filter(t => !_marketInfoMap.has(t.toLowerCase()) && !_tickerFetchCache.has(t))
    .slice(0, 80);

  if (toFetch.length === 0) return;

  // Use public Kalshi markets API (no auth) — same as ChartModal, reliable for titles
  await Promise.all(
    toFetch.map(async (ticker) => {
      try {
        const url = `${KALSHI_API_BASE}/trade-api/v2/markets/${encodeURIComponent(ticker)}`;
        const res = await fetch(url, {
          headers: { 'Accept': 'application/json' },
          cache: 'no-store',
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) {
          _tickerFetchCache.set(ticker, now);
          return;
        }
        const data = await res.json();
        const m = data.market || data;
        // Kalshi returns: title, subtitle, yes_sub_title, no_sub_title, question
        let title = (m.title || m.subtitle || m.yes_sub_title || m.yes_subtitle || m.question || '').trim();
        // For multi-outcome markets, combine e.g. "Peter Erdo – Who will the next Pope be?"
        const yesSub = (m.yes_sub_title || m.yes_subtitle || '').trim();
        if (yesSub && yesSub !== title && !title.toLowerCase().includes(yesSub.toLowerCase())) {
          title = `${yesSub} – ${title}`;
        }
        if (title && title.length > 3) {
          const status = (m.status || '').toLowerCase();
          const settled = status === 'settled' || status === 'closed' || status === 'finalized';
          const info: MarketInfo = {
            name: title,
            externalUrl: `https://kalshi.com/markets/${(m.series_ticker || ticker.split('-')[0] || '').toLowerCase()}`,
            category: 'General',
            settled,
          };
          _marketInfoMap.set(ticker.toLowerCase(), info);
        } else {
          _tickerFetchCache.set(ticker, now);
        }
      } catch {
        _tickerFetchCache.set(ticker, now);
      }
    })
  );
  if (_tickerFetchCache.size > 500) {
    const entries = [..._tickerFetchCache.entries()].sort((a, b) => a[1] - b[1]);
    entries.slice(0, 200).forEach(([k]) => _tickerFetchCache.delete(k));
  }
}

function resolveMarketInfo(ticker: string): MarketInfo | null {
  if (!ticker) return null;
  const key = ticker.toLowerCase();

  if (_marketInfoMap.has(key)) return _marketInfoMap.get(key)!;

  // Prefix match: trade ticker "kxatp-26feb24sim-x" → event ticker "kxatp"
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
  const info = resolveMarketInfo(ticker);
  if (info?.externalUrl) return info.externalUrl;

  if (provider === 'Kalshi') {
    const eventTicker = fallbackEventTicker || ticker;
    const seriesPart = eventTicker.split('-')[0].toLowerCase();
    return `https://kalshi.com/markets/${seriesPart}`;
  }
  return `https://polymarket.com`;
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
  price: number;
  priceCents: string;
  shares: number;
  notional: number;
  fee: number;
  timestamp: string;
  walletAddress?: string;
  isWhale: boolean;
  externalUrl?: string;
  slug?: string;
  category?: string;
  imageUrl?: string;
  outcomeIndex?: number;
  tokenId?: string;
  /** Internal: exclude from feed when market already resolved */
  marketSettled?: boolean;
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
  spread: number;
  spreadPct: number;
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
    uptime: number;
    rate: string;
    polymarketConnected: boolean;
    kalshiConnected: boolean;
    lastUpdate: string;
    /** So you can confirm latest deploy (increment when changing terminal logic) */
    engineVersion: string;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

const WHALE_THRESHOLD = 2000;
const ARB_THRESHOLD = 0.03;
const TRADE_CACHE_MAX = 500;
const WHALE_CACHE_MAX = 50;
const MARKET_TICK_MAX = 200;
const CACHE_TTL = 3000;
// Public Polymarket Data API (no auth required) for recent trades
const POLYMARKET_DATA_BASE = 'https://data-api.polymarket.com';
const KALSHI_API_BASE = 'https://api.elections.kalshi.com';

// Category diversity: crypto trades capped at this % of the feed
const MAX_CRYPTO_PCT = 0.60;
// Provider balance: each source gets 40–60% of feed so one doesn't dominate
const MIN_PROVIDER_PCT = 0.40;
const MAX_PROVIDER_PCT = 0.50; // 50% each so feed stays 50/50 when both have data (was 0.60, let Kalshi push Poly out)
const FEED_SIZE = 300;

// ============================================================================
// IN-MEMORY CACHE
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

const priceMap = new Map<string, number>();

// ============================================================================
// POLYMARKET LIVE TRADES FETCHER
// ============================================================================

const ANON_RE = /\b(Person|Player|Company|Team|Candidate|Entity)\s+[A-Z]\b/i;

async function fetchPolymarketLiveTrades(): Promise<TerminalTrade[]> {
  const opts = {
    method: 'GET' as const,
    headers: { 'Accept': 'application/json', 'User-Agent': 'PropMarket/1.0', 'Cache-Control': 'no-cache' },
    cache: 'no-store' as const,
    signal: AbortSignal.timeout(8000),
  };

  // Try takerOnly=false first (more trades); then takerOnly=true if needed
  for (const takerOnly of [false, true]) {
    const url = `${POLYMARKET_DATA_BASE}/trades?limit=100&takerOnly=${takerOnly}`;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(url, opts);
        if (!res.ok) {
          if (attempt < 2) {
            await new Promise(r => setTimeout(r, 500));
            continue;
          }
          if (takerOnly === false) {
            console.warn(`[Terminal] Polymarket data-api returned ${res.status} ${res.statusText}`);
            polyConnected = false;
            return [];
          }
          break; // try takerOnly=false
        }

        polyConnected = true;
        const data = await res.json();
        const rawTrades = Array.isArray(data) ? data : (data?.data || data?.trades || []);
        if (rawTrades.length === 0 && takerOnly === false) break; // try takerOnly=true

    // Don't block on ensureMarketInfoMap — Polymarket API returns title per trade; use it directly
    const trades = rawTrades.slice(0, 100).map((t: any, idx: number) => {
      // Data API shape:
      // {
      //   side: 'BUY' | 'SELL',
      //   outcome: 'Yes' | 'No',
      //   price: 0-1,
      //   size: number,
      //   conditionId: string,
      //   asset: string,        // specific outcome token id
      //   title: string,
      //   slug: string,
      //   eventSlug: string,
      //   timestamp: unixSeconds
      // }
      const outcomeRaw = (t.outcome || '').toLowerCase();
      const sideRaw = (t.side || '').toLowerCase(); // BUY / SELL

      let displaySide: 'Yes' | 'No';
      let displayPrice: number;
      const rawPrice = parseFloat(String(t.price ?? '0.5'));

      if (outcomeRaw === 'yes' || outcomeRaw === 'no') {
        displaySide = outcomeRaw === 'yes' ? 'Yes' : 'No';
        displayPrice = rawPrice;
      } else if (sideRaw === 'buy') {
        displaySide = rawPrice <= 0.5 ? 'Yes' : 'No';
        displayPrice = rawPrice;
      } else if (sideRaw === 'sell') {
        displaySide = 'No';
        displayPrice = 1 - rawPrice;
      } else {
        displaySide = rawPrice <= 0.5 ? 'Yes' : 'No';
        displayPrice = rawPrice;
      }

      const shares = Number(t.size || t.amount || t.count || 10);
      const notional = displayPrice * shares;
      const tradeSlug = t.slug || t.eventSlug || '';
      const conditionId = t.conditionId || '';

      const resolvedInfo = resolveMarketInfo(conditionId);
      let rawName = resolvedInfo?.name
        || t.title || t.name || t.question
        || (tradeSlug ? tradeSlug.replace(/-/g, ' ') : '')
        || `Market ${conditionId?.slice(0, 8) || idx}`;
      if (ANON_RE.test(rawName) && resolvedInfo?.name) {
        rawName = resolvedInfo.name;
      }
      const marketName = rawName;
      const externalUrl = resolvedInfo?.externalUrl
        || (tradeSlug && !tradeSlug.startsWith('0x') && tradeSlug.length > 5
            ? `https://polymarket.com/event/${tradeSlug}`
            : 'https://polymarket.com');

      const assetId = t.asset || t.asset_id || '';
      const timestampSec = Number(t.timestamp || 0);
      const isoTs = timestampSec > 0 ? new Date(timestampSec * 1000).toISOString() : new Date().toISOString();

      return {
        id: `poly-${t.id || t.transactionHash || `${conditionId}-${timestampSec}-${idx}`}`,
        provider: 'Polymarket' as const,
        type: (t.type || 'FILL').toUpperCase() as TerminalTrade['type'],
        marketId: conditionId || `poly-${idx}`,
        marketName,
        side: displaySide,
        price: displayPrice,
        priceCents: `${(displayPrice * 100).toFixed(1)}¢`,
        shares,
        notional,
        fee: 0,
        timestamp: isoTs,
        walletAddress: t.proxyWallet || t.maker_address || t.taker_address || t.owner,
        isWhale: notional >= WHALE_THRESHOLD,
        externalUrl,
        slug: tradeSlug,
        category: resolvedInfo?.category || '',
        imageUrl: resolvedInfo?.imageUrl || '',
        outcomeIndex: resolvedInfo?.outcomeIndex,
        tokenId: assetId || resolvedInfo?.tokenId,
      };
    }).filter((trade: any) => {
      const name = String(trade.marketName || '').trim();
      if (!name) return false;
      // Allow all non-empty names — previously we dropped "Market 0x..." < 20 chars and excluded valid Poly trades
      return true;
    });

        console.log(`[Terminal] Polymarket: ${rawTrades.length} raw → ${trades.length} after filtering (takerOnly=${takerOnly})`);
        return trades;
      } catch (err) {
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 500));
          continue;
        }
        if (takerOnly === false) {
          console.warn('[Terminal] Polymarket trades fetch error:', err);
          polyConnected = false;
          return [];
        }
        break;
      }
    }
  }
  polyConnected = false;
  return [];
}

// ============================================================================
// KALSHI LIVE TRADES FETCHER — Multi-Category Polling
// ============================================================================

// Only filter truly unreadable market tickers (multi-game parlays)
const KALSHI_UGLY_PREFIXES = ['KXMVE'];

/** Humanize series ticker when API title unavailable — readable "Will X happen?" subject */
function humanizeKalshiSeries(series: string): string {
  if (!series) return '';
  const s = series.toUpperCase();
  const m: Record<string, string> = {
    XRP15M: 'XRP 15m', BTC15M: 'Bitcoin 15m', ETH15M: 'Ethereum 15m', SOL15M: 'Solana 15m', BTCD: 'Bitcoin price',
    NCAAMBGAME: 'NCAAM game', NCAAMBSPREAD: 'NCAAM spread', BUNDESLIGA2GAME: 'Bundesliga game',
    EARNINGSMENTIONEA: 'Earnings mention', RAINNYCM: 'NYC rain', AAAGASW: 'Gas prices', TRUMPSAY: 'Trump',
    ATPCHALLENGERMATCH: 'ATP Challenger match', WTACHALLENGERMATCH: 'WTA Challenger match',
    SERIEA: 'Serie A', EPL: 'Premier League', CS2: 'Counter-Strike 2', NYCSNOWM: 'NYC snow',
    T20MATCH: 'T20 cricket match', GOVTSHUTLENGTH: 'government shutdown length', EPLTOTAL: 'EPL total goals',
  };
  if (m[s]) return m[s];
  if (/^\w+15M$/i.test(s)) return `${s.replace(/15M$/i, '')} 15m`;
  if (/CHALLENGERMATCH$/i.test(s)) return `${s.replace(/CHALLENGERMATCH$/i, '')} Challenger match`;
  if (/TOTAL$/i.test(s)) return `${s.replace(/TOTAL$/i, '')} total`;
  if (/MATCH$/i.test(s)) return `${s.replace(/MATCH$/i, '')} match`;
  if (/GAME$/i.test(s)) return `${s.replace(/GAME$/i, '')} game`;
  if (/SPREAD$/i.test(s)) return `${s.replace(/SPREAD$/i, '')} spread`;
  if (/WINNER$/i.test(s)) return `${s.replace(/WINNER$/i, '')} winner`;
  return `${series} market`;
}

/** Format market name as "Will X happen?" or "Will X happen by date?" when not already question form */
function formatMarketNameAsQuestion(name: string, ticker: string): string {
  const n = (name || '').trim();
  if (!n) return name;
  if (n.includes('?') || /^Will\s/i.test(n)) return n; // already question form

  // Parse date from ticker (e.g. KXBTCD-28FEB2603-T61999.99 → Feb 28, 2026). Avoid 2001: ticker may use "01" as id, not year.
  const datePart = ticker.match(/-(\d{2}[A-Z]{3}\d{2,4})/i);
  let byDate = '';
  if (datePart) {
    const d = datePart[1]; // 28FEB2603, 28FEB26, or 26MAR01 (01 can be id, not year)
    const day = d.slice(0, 2);
    const mon = d.slice(2, 5).toUpperCase();
    let yearStr = d.length >= 7 ? `20${d.slice(5, 7)}` : (d.slice(5) || '26');
    const yearNum = parseInt(yearStr, 10);
    if (yearNum < 2025) yearStr = '2026'; // never show 2001 etc.; ticker "01" is often not a year
    const monthsFull: Record<string, string> = { JAN: 'January', FEB: 'February', MAR: 'March', APR: 'April', MAY: 'May', JUN: 'June', JUL: 'July', AUG: 'August', SEP: 'September', OCT: 'October', NOV: 'November', DEC: 'December' };
    byDate = monthsFull[mon] ? ` by ${monthsFull[mon]} ${day}, ${yearStr}` : '';
  }

  // Price target: "≤ $61,999.99 – Bitcoin price" → "Will Bitcoin be at or above $61,999.99 by Feb 28, 2026?"
  const priceMatch = n.match(/^(≤?\s*\$[\d,.]+\s*(?:or above)?)\s*[–-]\s*(.+)$/i);
  if (priceMatch) {
    const target = priceMatch[1].trim();
    const subject = priceMatch[2].trim().replace(/\s+market$/i, '').replace(/\s+price$/i, '');
    const verb = target.startsWith('≤') ? 'be at or above' : 'reach';
    const amount = target.replace(/^≤\s*/, '');
    return `Will ${subject} ${verb} ${amount}${byDate || ' by resolution date'}?`;
  }

  // Generic: "Will [X] resolve?"
  const clean = n.replace(/\s+market$/i, '').trim();
  return `Will ${clean} resolve${byDate ? byDate + '?' : '?'}`;
}

function isUglyTicker(ticker: string): boolean {
  const t = (ticker || '').toUpperCase();
  return KALSHI_UGLY_PREFIXES.some(prefix => t.startsWith(prefix));
}

async function fetchKalshiLiveTrades(): Promise<TerminalTrade[]> {
  const accessKey = process.env.KALSHI_ACCESS_KEY;
  const privateKey = process.env.KALSHI_PRIVATE_KEY;

  if (!accessKey || !privateKey) {
    kalshiConnected = false;
    return [];
  }

  try {
    // Fetch trades from the general endpoint (gets most active trades)
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

    // Populate titles in background so first load is fast; mapKalshiTrades uses humanized fallbacks until then
    const tickers = trades.map((t: any) => t.ticker || t.market_ticker).filter(Boolean);
    fetchMarketTitlesForTickers(tickers).catch(() => {});

    const mapped = mapKalshiTrades(trades);
    console.log(`[Terminal] Kalshi general: ${trades.length} raw → ${mapped.length} after filter`);
    return mapped;
  } catch (err) {
    console.warn('[Terminal] Kalshi trades fetch error:', err);
    kalshiConnected = false;
    return [];
  }
}

/**
 * Fetch trades from specific Kalshi event tickers to ensure non-crypto
 * categories are represented. Targets politics, economics, weather, etc.
 */
async function fetchKalshiCategoryTrades(): Promise<TerminalTrade[]> {
  const accessKey = process.env.KALSHI_ACCESS_KEY;
  const privateKey = process.env.KALSHI_PRIVATE_KEY;
  if (!accessKey || !privateKey) return [];

  // Targeted series tickers for diversity — these cover politics, economics, weather, sports, etc.
  const DIVERSE_SERIES = [
    'KXFED',     // Federal Reserve / interest rates
    'KXINX',     // S&P 500 / stock market
    'KXGDP',     // GDP
    'KXCPI',     // CPI / inflation
    'KXJOBS',    // Jobs / employment
    'KXTRUMP',   // Trump / politics
    'KXPRES',    // Presidential
    'KXELECTION',// Elections
    'KXGOV',     // Government
    'KXHOUSE',   // House of Representatives
    'KXSENATE',  // Senate
    'KXTEMP',    // Temperature / weather
    'KXHURR',    // Hurricanes
    'KXSNOW',    // Snow
    'KXRAIN',    // Rain
    'KXAI',      // AI / tech
    'KXTSLA',    // Tesla
    'KXAAPL',    // Apple
    'KXGOOG',    // Google
    'KXNVDA',    // NVIDIA
    'KXOSCAR',   // Oscars
    'KXGRAMMYS', // Grammys
    'KXSUPERBOWL', // Super Bowl
  ];

  const allCategoryTrades: TerminalTrade[] = [];
  // Fetch all series in parallel (no sequential batches) so category trades don't add 30+ seconds
  const results = await Promise.allSettled(
    DIVERSE_SERIES.map(async (series) => {
      try {
        const path = '/trade-api/v2/markets/trades';
        const params = new URLSearchParams({
          limit: '20',
          ticker: series,
        });
        const authHeaders = generateKalshiHeaders('GET', path, accessKey, privateKey);
        const res = await fetch(`${KALSHI_API_BASE}${path}?${params}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json', ...authHeaders },
          cache: 'no-store',
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return [];
        const data = await res.json();
        return data.trades || [];
      } catch {
        return [];
      }
    })
  );

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.length > 0) {
      const batch = r.value;
      // Don't await title fetch here — it was blocking 4+ rounds and causing 30–60s delay; use map cache or humanized names
      fetchMarketTitlesForTickers(batch.map((t: any) => t.ticker || t.market_ticker).filter(Boolean)).catch(() => {});
      allCategoryTrades.push(...mapKalshiTrades(batch));
    }
  }

  console.log(`[Terminal] Kalshi category trades: ${allCategoryTrades.length} from ${DIVERSE_SERIES.length} series`);
  return allCategoryTrades;
}

function mapKalshiTrades(trades: any[]): TerminalTrade[] {
  return trades
    .filter((t: any) => {
      const ticker = (t.ticker || t.market_ticker || '').toUpperCase();
      return !isUglyTicker(ticker);
    })
    .map((t: any, idx: number) => {
      const tradeSide = (t.taker_side || t.side || 'yes').toLowerCase();

      let price: number;
      if (tradeSide === 'no') {
        if (t.no_price != null) {
          price = Number(t.no_price) / 100;
        } else if (t.no_price_dollars != null) {
          price = Number(t.no_price_dollars);
        } else if (t.yes_price != null) {
          price = 1 - Number(t.yes_price) / 100;
        } else {
          price = Number(t.price ?? 0.5);
        }
      } else {
        if (t.yes_price != null) {
          price = Number(t.yes_price) / 100;
        } else if (t.yes_price_dollars != null) {
          price = Number(t.yes_price_dollars);
        } else {
          price = Number(t.price ?? 0.5);
        }
      }

      const shares = t.count || t.count_fp || t.size || 1;
      const notional = price * Number(shares);
      const ticker = t.ticker || t.market_ticker || '';
      const resolvedInfo = resolveMarketInfo(ticker);

      let resolvedName = resolvedInfo?.name || t.market_title || t.title || '';
      // Fallback: build a readable name from ticker when not in market map (e.g. KXBTCD-28FEB2603-T61999.99)
      if (!resolvedName || resolvedName.length < 3) {
        const targetMatch = ticker.match(/-T([\d.]+)$/i);
        const seriesMatch = ticker.match(/^([A-Z0-9]+)-/i);
        const series = seriesMatch ? seriesMatch[1].replace(/^KX/, '') : '';
        const humanSeries = humanizeKalshiSeries(series);
        if (targetMatch && series) {
          const target = Number(targetMatch[1]);
          resolvedName = target > 0
            ? `≤ $${target >= 1000 ? target.toLocaleString('en-US', { maximumFractionDigits: 2 }) : target} – ${humanSeries}`
            : humanSeries;
        } else {
          resolvedName = humanSeries || `Kalshi – ${ticker.slice(0, 20)}`;
        }
      }
      if (resolvedName && !resolvedName.includes(' to ') && !resolvedName.includes('$')) {
        const targetMatch = ticker.match(/-T([\d.]+)$/i);
        if (targetMatch) {
          const target = Number(targetMatch[1]);
          if (target > 0) {
            const fmt = target >= 1000
              ? `≤ $${target.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
              : `≤ $${target}`;
            if (!resolvedName.includes(targetMatch[1])) {
              resolvedName = `${fmt} – ${resolvedName}`;
            }
          }
        }
      }
      if (resolvedName.includes(' – ')) {
        const [a, b] = resolvedName.split(' – ');
        const aClean = a.replace(/\?$/, '').trim().toLowerCase();
        const bClean = b.replace(/\?$/, '').trim().toLowerCase();
        if (aClean.includes(bClean) || bClean.includes(aClean)) {
          resolvedName = a.length >= b.length ? a : b;
        }
      }

      resolvedName = formatMarketNameAsQuestion(resolvedName, ticker);

      const externalUrl = resolveExternalUrl(ticker, 'Kalshi');
      const category = resolvedInfo?.category || classifyKalshiTrade(ticker, resolvedName);

      // Kalshi can return created_time/executed_at as unix seconds (number); must normalize to ISO or 30‑min filter drops all
      const rawTs = t.created_time ?? t.executed_at ?? t.created_at;
      const isoTime =
        typeof rawTs === 'number'
          ? new Date(rawTs * 1000).toISOString()
          : typeof rawTs === 'string' && rawTs.length > 0
            ? rawTs
            : new Date().toISOString();

      return {
        id: `kalshi-${t.trade_id || `${Date.now()}-${idx}`}`,
        provider: 'Kalshi' as const,
        type: (t.action || 'FILL').toUpperCase() as TerminalTrade['type'],
        marketId: ticker || `kalshi-${idx}`,
        marketName: resolvedName,
        side: tradeSide === 'yes' ? 'Yes' as const : 'No' as const,
        price,
        priceCents: `${(price * 100).toFixed(1)}¢`,
        shares: Number(shares),
        notional,
        fee: parseFloat(t.fee || '0') || Math.round(notional * 0.07 * 100) / 100,
        timestamp: isoTime,
        isWhale: notional >= WHALE_THRESHOLD,
        externalUrl,
        category,
        imageUrl: resolvedInfo?.imageUrl || '',
        tokenId: ticker,
        outcomeIndex: resolvedInfo?.outcomeIndex,
        marketSettled: resolvedInfo?.settled === true,
      };
    })
    .filter((trade: any) => {
      if (trade.marketSettled === true) return false; // exclude already-determined markets
      if (!trade.marketName || trade.marketName.length < 3) return false;
      if (trade.marketName.startsWith('KX') && !trade.marketName.includes(' ')) return false;
      if (ANON_RE.test(trade.marketName)) return false;
      return true;
    });
}

/**
 * Classify a Kalshi trade by ticker prefix and name keywords
 */
function classifyKalshiTrade(ticker: string, name: string): string {
  const t = ticker.toUpperCase();
  const n = name.toLowerCase();

  const CRYPTO_PREFIXES = ['KXBTC', 'KXETH', 'KXSOL', 'KXXRP', 'KXDOGE', 'KXAVAX', 'KXLINK', 'KXBNB', 'KXADA', 'KXMATIC', 'KXDOT'];
  if (CRYPTO_PREFIXES.some(p => t.startsWith(p)) || ['bitcoin', 'ethereum', 'crypto', 'solana'].some(kw => n.includes(kw))) return 'Crypto';

  if (['KXFED', 'KXCPI', 'KXJOBS', 'KXGDP', 'KXINX'].some(p => t.startsWith(p)) ||
      ['interest rate', 'inflation', 'gdp', 'jobs report', 'unemployment', 's&p', 'nasdaq', 'stock'].some(kw => n.includes(kw))) return 'Economy';

  if (['KXTRUMP', 'KXPRES', 'KXELECTION', 'KXGOV', 'KXHOUSE', 'KXSENATE'].some(p => t.startsWith(p)) ||
      ['president', 'congress', 'senate', 'election', 'trump', 'biden', 'democrat', 'republican', 'governor'].some(kw => n.includes(kw))) return 'Politics';

  if (['KXNBA', 'KXNFL', 'KXMLB', 'KXNHL', 'KXMLS', 'KXF1', 'KXUFC', 'KXPGA', 'KXNCAA', 'KXATP', 'KXWTA'].some(p => t.startsWith(p)) ||
      ['nba', 'nfl', 'mlb', 'nhl', 'super bowl', 'world series', 'champion', 'playoff'].some(kw => n.includes(kw))) return 'Sports';

  if (['KXTEMP', 'KXHURR', 'KXSNOW', 'KXRAIN'].some(p => t.startsWith(p)) ||
      ['temperature', 'hurricane', 'snow', 'rain', 'weather', 'climate'].some(kw => n.includes(kw))) return 'Weather';

  if (['oscar', 'grammy', 'emmy', 'golden globe', 'box office', 'streaming'].some(kw => n.includes(kw))) return 'Pop Culture';

  if (['ai ', 'artificial intelligence', 'chatgpt', 'openai', 'google', 'apple', 'tesla', 'nvidia', 'microsoft'].some(kw => n.includes(kw))) return 'Tech';

  return 'General';
}

// ============================================================================
// WHALE DETECTION (with deduplication)
// ============================================================================

const seenWhaleKeys = new Set<string>();

function detectWhales(trades: TerminalTrade[]): WhaleAlert[] {
  const results: WhaleAlert[] = [];
  for (const t of trades) {
    if (t.notional < WHALE_THRESHOLD) continue;
    const dedupKey = `${t.provider}-${t.marketId}-${t.side}-${Math.round(t.notional)}-${t.timestamp}`;
    if (seenWhaleKeys.has(dedupKey)) continue;
    seenWhaleKeys.add(dedupKey);
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
// ARBITRAGE SCANNER
// ============================================================================

function scanArbFromTicks(ticks: MarketTick[]): ArbitrageSignal[] {
  const byName = new Map<string, { poly?: MarketTick; kalshi?: MarketTick }>();

  for (const tick of ticks) {
    const normalized = tick.name
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

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
// MARKET TICK GENERATOR
// ============================================================================

async function fetchMarketTicks(): Promise<MarketTick[]> {
  try {
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
// FAIR ROTATION — ensures category diversity in the feed
// ============================================================================

function applyFairRotation(trades: TerminalTrade[]): TerminalTrade[] {
  if (trades.length < 10) return trades;

  const crypto: TerminalTrade[] = [];
  const nonCrypto: TerminalTrade[] = [];

  for (const t of trades) {
    const cat = (t.category || '').toLowerCase();
    if (cat === 'crypto' || cat === 'fast markets') {
      crypto.push(t);
    } else {
      nonCrypto.push(t);
    }
  }

  // If non-crypto makes up less than 30% of the feed, enforce diversity
  const targetNonCrypto = Math.ceil(trades.length * (1 - MAX_CRYPTO_PCT));
  if (nonCrypto.length >= targetNonCrypto) {
    // Already diverse enough — return chronologically sorted
    return trades;
  }

  // Cap crypto trades and interleave non-crypto
  const maxCrypto = trades.length - Math.min(nonCrypto.length, targetNonCrypto);
  const cappedCrypto = crypto.slice(0, maxCrypto);

  // Merge chronologically
  const merged = [...cappedCrypto, ...nonCrypto]
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

  return merged;
}

// ============================================================================
// PROVIDER BALANCE — each source gets 40–60% so neither dominates the feed
// ============================================================================

/** Interleave Kalshi and Poly so the feed is mixed (no huge same-provider sections). */
function applyProviderBalance(trades: TerminalTrade[]): TerminalTrade[] {
  if (trades.length < 4) return trades;

  const kalshi = [...trades.filter(t => t.provider === 'Kalshi')].sort(
    (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)
  );
  const poly = [...trades.filter(t => t.provider === 'Polymarket')].sort(
    (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)
  );
  if (kalshi.length === 0) return poly.slice(0, FEED_SIZE);
  if (poly.length === 0) return kalshi.slice(0, FEED_SIZE);

  const maxPerProvider = Math.ceil(FEED_SIZE * MAX_PROVIDER_PCT);   // 150 each → 50/50
  const minPerProvider = Math.floor(FEED_SIZE * MIN_PROVIDER_PCT);  // 120 each
  const capK = kalshi.slice(0, maxPerProvider);
  const capP = poly.slice(0, maxPerProvider);
  const result: TerminalTrade[] = [];
  let ki = 0;
  let pi = 0;
  let kCount = 0;
  let pCount = 0;
  const maxConsecutive = 3;
  let lastProvider: 'Kalshi' | 'Polymarket' | null = null;
  let consecutive = 0;

  while (result.length < FEED_SIZE && (ki < capK.length || pi < capP.length)) {
    const canK = ki < capK.length;
    const canP = pi < capP.length;
    const forceOther = lastProvider !== null && consecutive >= maxConsecutive;
    // When both available: prefer provider that's under minimum share so we hit 50/50
    const kUnderMin = kCount < minPerProvider;
    const pUnderMin = pCount < minPerProvider;
    const pickK =
      forceOther
        ? lastProvider === 'Polymarket' && canK
        : !canP
          ? canK
          : !canK
            ? false
            : canP && canK
              ? pUnderMin
                ? false
                : kUnderMin
                  ? true
                  : result.length % 2 === 0
              : canK;
    if (pickK && canK) {
      result.push(capK[ki++]);
      kCount++;
      if (lastProvider === 'Kalshi') consecutive++; else { lastProvider = 'Kalshi'; consecutive = 1; }
    } else if (canP) {
      result.push(capP[pi++]);
      pCount++;
      if (lastProvider === 'Polymarket') consecutive++; else { lastProvider = 'Polymarket'; consecutive = 1; }
    } else if (canK) {
      result.push(capK[ki++]);
      kCount++;
      if (lastProvider === 'Kalshi') consecutive++; else { lastProvider = 'Kalshi'; consecutive = 1; }
    } else break;
  }

  return result;
}

// ============================================================================
// MAIN AGGREGATOR
// ============================================================================

export async function getTerminalSnapshot(): Promise<TerminalSnapshot> {
  const now = Date.now();

  // Check cache (3 second TTL)
  if (now - lastFetchTime < CACHE_TTL && tradeCache.length > 0) {
    const uptime = Math.floor((now - startTime) / 1000);
    const rate = uptime > 0 ? (totalTradeCount / uptime).toFixed(1) : '0';

    return {
      trades: tradeCache.slice(0, 300),
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
        engineVersion: '2026-03-02',
      },
    };
  }

  // Don't block on ensureMarketInfoMap — it can take 30+ sec; run in background so Poly/Kalshi fetches start immediately
  ensureMarketInfoMap().catch(() => {});

  const emptySnapshot = (): TerminalSnapshot => {
    const uptime = Math.floor((now - startTime) / 1000);
    const rate = uptime > 0 ? (totalTradeCount / uptime).toFixed(1) : '0';
    return {
      trades: tradeCache.slice(0, 300),
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
        engineVersion: '2026-03-02',
      },
    };
  };

  try {
    // Fetch from multiple sources in parallel for diversity
    const [polyTrades, kalshiTrades, kalshiCatTrades, ticks] = await Promise.all([
      fetchPolymarketLiveTrades(),
      fetchKalshiLiveTrades(),
      fetchKalshiCategoryTrades(),
      fetchMarketTicks(),
    ]);

    const FEED_WINDOW_MS = 30 * 60 * 1000; // 30 min — keep Polymarket (API delay) and recent Kalshi
    const nowTs = Date.now();

    // Deduplicate by trade ID and drop settled/determined Kalshi markets
    const seenIds = new Set<string>();
    const allRaw = [...polyTrades, ...kalshiTrades, ...kalshiCatTrades];
    const deduped: TerminalTrade[] = [];
    for (const t of allRaw) {
      if (t.marketSettled === true) continue;
      if (seenIds.has(t.id)) continue;
      seenIds.add(t.id);
      deduped.push(t);
    }

    // Filter to last N minutes, sort newest first
    const allTrades = deduped
      .filter(t => {
        const ts = Date.parse(t.timestamp);
        return !Number.isNaN(ts) && (nowTs - ts) <= FEED_WINDOW_MS;
      })
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

    // Apply fair rotation (category diversity) then 40–60% provider balance
    const diverseTrades = applyFairRotation(allTrades);
    const balancedTrades = applyProviderBalance(diverseTrades);

    const kInFeed = balancedTrades.filter(t => t.provider === 'Kalshi').length;
    const pInFeed = balancedTrades.filter(t => t.provider === 'Polymarket').length;
    console.log(`[Terminal] Merged: ${polyTrades.length} Poly + ${kalshiTrades.length} Kalshi + ${kalshiCatTrades.length} Cat → ${allTrades.length} deduped → ${balancedTrades.length} (${pInFeed} Poly / ${kInFeed} Kalshi in feed)`);

    // Warm the global price cache from all incoming trades
    for (const t of balancedTrades) {
      if (t.price > 0 && t.price < 1) {
        const yesPrice = t.side === 'No' ? 1 - t.price : t.price;
        warmPriceCache(t.provider.toLowerCase(), t.marketId, yesPrice);
      }
    }

    // Separate whale trades and force-insert at top
    const whaleTradesInFeed = balancedTrades.filter(t => t.isWhale);
    const normalTrades = balancedTrades.filter(t => !t.isWhale);
    const finalTrades = [...whaleTradesInFeed, ...normalTrades];

    // Update caches
    const existingIds = new Set(tradeCache.map(t => t.id));
    const newTrades = finalTrades.filter(t => !existingIds.has(t.id));

    tradeCache = [...newTrades, ...tradeCache]
      .filter(t => {
        const ts = Date.parse(t.timestamp);
        return !Number.isNaN(ts) && (nowTs - ts) <= FEED_WINDOW_MS;
      })
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
      .slice(0, TRADE_CACHE_MAX);
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
  } catch (err) {
    console.error('[Terminal] getTerminalSnapshot error (returning cached/empty snapshot):', err);
    // Return valid snapshot so API stays 200 and UI shows LIVE; use existing caches
    return emptySnapshot();
  }

  const uptime = Math.floor((now - startTime) / 1000);
  const rate = uptime > 0 ? (totalTradeCount / uptime).toFixed(1) : '0';

  return {
    trades: tradeCache.slice(0, 300),
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
      engineVersion: '2026-03-02',
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
    const res = await fetch(`https://data-api.polymarket.com/wallets/${address}`, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });

    if (res.ok) {
      const data = await res.json();

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

    return null;
  } catch (err) {
    console.warn('[Terminal] Wallet lookup error:', err);
    return null;
  }
}
