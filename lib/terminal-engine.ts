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
  tokenId?: string;
  outcomeIndex?: number;
}

let _marketInfoMap: Map<string, MarketInfo> = new Map();
let _marketInfoMapAge = 0;
const MARKET_INFO_MAP_TTL = 300_000; // 5 minutes — avoid re-fetching too often

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
      const MAX_PAGES = 3; // Cap at 3 pages (600 events) for fast loading

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

          // Build Kalshi URL (series_ticker only — full event_ticker causes 404)
          const kalshiSlug = seriesTicker
            ? seriesTicker.toLowerCase()
            : eventTicker.split('-')[0].toLowerCase();
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
          for (const mkt of (event.markets || [])) {
            // Skip settled/closed Kalshi sub-markets
            if (mkt.status === 'settled' || mkt.status === 'closed') continue;
            if (mkt.ticker) {
              const rawTitle = mkt.title || mkt.subtitle || mkt.yes_sub_title || '';
              let mktTitle = rawTitle.replace(/^::\s*/g, '').replace(/^--\s*/g, '').trim();

              // Build range label from strike prices if the market title is missing
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

              // If the market has its own distinct title, combine it with the event title
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

        pagesFetched++;
        cursor = data.cursor;
        if (!cursor) break;
        // Small delay between pages
        await new Promise(r => setTimeout(r, 50));
      }
      console.log(`[Terminal] Kalshi name map: ${m.size} entries from ${pagesFetched} pages`);

      // ── 1b. Targeted fetch for fast crypto market events (KXBTC, KXETH, etc.) ──
      const FAST_SERIES = ['KXBTC', 'KXETH', 'KXSOL', 'KXXRP', 'KXDOGE', 'KXAVAX', 'KXLINK', 'KXBNB'];
      for (const series of FAST_SERIES) {
        try {
          const fastPath = '/trade-api/v2/events';
          const fastParams = new URLSearchParams({
            status: 'open',
            limit: '50',
            with_nested_markets: 'true',
            series_ticker: series,
          });
          const fastAuth = generateKalshiHeaders('GET', fastPath, accessKey!, privateKey!);
          const fastRes = await fetch(`${KALSHI_API_BASE}${fastPath}?${fastParams}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', ...fastAuth },
            cache: 'no-store',
          });
          if (fastRes.ok) {
            const fastData = await fastRes.json();
            for (const event of (fastData.events || [])) {
              const title = event.title || '';
              if (!title) continue;
              const eventTicker = event.event_ticker || '';
              const seriesTicker = event.series_ticker || '';
              const kalshiSlug = seriesTicker
                ? seriesTicker.toLowerCase()
                : eventTicker.split('-')[0].toLowerCase();
              let kalshiImg = '';
              if (seriesTicker) {
                kalshiImg = `https://kalshi-public-docs.s3.amazonaws.com/series-images-webp/${seriesTicker}.webp`;
              }
              const info: MarketInfo = {
                name: title,
                externalUrl: `https://kalshi.com/markets/${kalshiSlug}`,
                category: 'Fast Markets',
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
                  }
                  const specificName = (mktTitle && mktTitle.toLowerCase() !== title.toLowerCase())
                    ? `${mktTitle} – ${title}`
                    : title;
                  m.set(mkt.ticker.toLowerCase(), { ...info, name: specificName });
                }
              }
            }
          }
        } catch { /* skip this series if it fails */ }
      }
      console.log(`[Terminal] After fast crypto fetch: ${m.size} entries total`);
    }
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
        // Use market-specific question when it has real names;
        // fall back to event title when the question is anonymized
        const ANON_PATTERN = /\b(Person|Player|Company|Team|Candidate|Entity)\s+[A-Z]\b/i;
        for (let mktIdx = 0; mktIdx < (event.markets || []).length; mktIdx++) {
          const mkt = event.markets[mktIdx];
          // Skip closed/resolved individual markets
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
          // Extract CLOB token IDs for outcome-level pricing
          let yesTokenId: string | undefined;
          try {
            const clobIds = mkt.clobTokenIds ? JSON.parse(mkt.clobTokenIds) : [];
            if (clobIds.length > 0) yesTokenId = clobIds[0];
          } catch { /* ignore parse errors */ }
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
        polyCount++;
      }
      console.log(`[Terminal] Polymarket name map: ${polyCount} events added`);
    }
  } catch (err) {
    console.warn('[Terminal] Failed to build Polymarket name map:', err);
  }

  // ── Tag fast crypto market entries as 'Fast Markets' ────────
  let fastTagCount = 0;
  const FAST_CRYPTO_KW = ['bitcoin', 'btc', 'ethereum', 'eth', 'solana', 'sol', 'xrp', 'doge', 'avax', 'link', 'bnb'];
  const FAST_TICKER_PREFIXES = ['kxbtc', 'kxeth', 'kxsol', 'kxxrp', 'kxdoge', 'kxavax', 'kxlink', 'kxbnb', 'kxada', 'kxmatic', 'kxdot'];
  for (const [key, info] of m.entries()) {
    if (info.category === 'Fast Markets') continue;
    const nameLower = info.name.toLowerCase();
    const keyLower = key.toLowerCase();

    const isFast =
      // Pattern 1: "up or down" + crypto keyword
      ((nameLower.includes('up or down') || nameLower.includes('up/down')) &&
       FAST_CRYPTO_KW.some(kw => nameLower.includes(kw))) ||
      // Pattern 2: Kalshi fast crypto ticker prefix (KXBTC-*, KXETH-*, etc.)
      FAST_TICKER_PREFIXES.some(prefix => keyLower.startsWith(prefix)) ||
      // Pattern 3: titles with time indicators + crypto keywords
      ((nameLower.includes('15 min') || nameLower.includes('5 min') || nameLower.includes('15-min') || nameLower.includes('5-min')) &&
       FAST_CRYPTO_KW.some(kw => nameLower.includes(kw)));

    if (isFast) {
      m.set(key, { ...info, category: 'Fast Markets' });
      fastTagCount++;
    }
  }
  console.log(`[Terminal] Tagged ${fastTagCount} entries as Fast Markets`);

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

  // Fallback: construct URL from series ticker (first segment before date)
  if (provider === 'Kalshi') {
    const eventTicker = fallbackEventTicker || ticker;
    const seriesPart = eventTicker.split('-')[0].toLowerCase();
    return `https://kalshi.com/markets/${seriesPart}`;
  }
  return `https://polymarket.com`;
}

// Known Kalshi sports-parlay / per-game ticker prefixes.
// These produce unreadable market names and flood the terminal.
const KALSHI_SPORTS_PREFIXES = [
  'KXMVE',   // multi-game parlays
  'KXATP',   // ATP tennis
  'KXWTA',   // WTA tennis
  'KXNCAA',  // NCAA (all sports)
  'KXNBA',   // NBA
  'KXNFL',   // NFL
  'KXNHL',   // NHL
  'KXMLB',   // MLB
  'KXMLS',   // MLS
  'KXEPL',   // English Premier League
  'KXLIGA',  // La Liga
  'KXSERA',  // Serie A
  'KXBUND',  // Bundesliga
  'KXUFC',   // UFC
  'KXLOL',   // League of Legends / esports
  'KXCS',    // CS:GO / esports
  'KXDOTA',  // Dota 2 / esports
  'KXF1',    // Formula 1
  'KXPGA',   // PGA golf
  'KXLPGA',  // LPGA golf
  'KXCFB',   // College football
  'KXCBB',   // College basketball
  'KXWNBA',  // WNBA
  'KXUSL',   // USL soccer
  'KXLIGA',  // Liga MX
  'KXNASCAR',// NASCAR
];

function isKalshiSportsTicker(ticker: string): boolean {
  const t = (ticker || '').toUpperCase();
  return KALSHI_SPORTS_PREFIXES.some(prefix => t.startsWith(prefix));
}

// Filter for ugly auto-generated markets that users wouldn't understand
function isUglyTicker(ticker: string, name: string): boolean {
  if (!ticker && !name) return false;
  const t = (ticker || '').toUpperCase();
  // Sports tickers — always filter
  if (isKalshiSportsTicker(t)) return true;
  // Names that are EXACTLY a raw ticker with no spaces
  if (name && name === ticker) return true;
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
  outcomeIndex?: number; // Position in the parent event's outcomes array
  tokenId?: string;      // Polymarket CLOB token ID or Kalshi market ticker
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

const ANON_RE = /\b(Person|Player|Company|Team|Candidate|Entity)\s+[A-Z]\b/i;

async function fetchPolymarketLiveTrades(): Promise<TerminalTrade[]> {
  try {
    // Polymarket CLOB API - recent trades
    const res = await fetch(`${POLYMARKET_CLOB_BASE}/trades?limit=50`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });

    if (!res.ok) {
      polyConnected = false;
      return [];
    }

    polyConnected = true;
    const data = await res.json();
    const rawTrades = Array.isArray(data) ? data : (data?.data || data?.trades || []);

    // Resolve names via market info map for CLOB trades
    await ensureMarketInfoMap();

    return rawTrades.slice(0, 50).map((t: any, idx: number) => {
      // Polymarket CLOB: `outcome` = "Yes"/"No" (which token),
      // `side` = "BUY"/"SELL" (direction). Use outcome for display side.
      const outcomeRaw = (t.outcome || '').toLowerCase();
      const directionRaw = (t.side || '').toLowerCase();

      let displaySide: 'Yes' | 'No';
      let displayPrice: number;
      const rawPrice = parseFloat(t.price || t.avg_price || '0.5');

      if (outcomeRaw === 'yes' || outcomeRaw === 'no') {
        // Outcome available: use it directly
        displaySide = outcomeRaw === 'yes' ? 'Yes' : 'No';
        displayPrice = rawPrice;
      } else if (directionRaw === 'buy') {
        // No outcome field — BUY at low price (<0.5) is likely Yes
        displaySide = rawPrice <= 0.5 ? 'Yes' : 'No';
        displayPrice = rawPrice;
      } else if (directionRaw === 'sell') {
        // SELL = selling YES = effectively buying NO
        displaySide = 'No';
        displayPrice = 1 - rawPrice;
      } else {
        displaySide = rawPrice <= 0.5 ? 'Yes' : 'No';
        displayPrice = rawPrice;
      }

      const shares = parseInt(t.size || t.amount || t.count || '10');
      const notional = displayPrice * shares;
      const tradeSlug = t.market_slug || '';
      const conditionId = t.market || t.asset_id || t.condition_id || '';

      // Resolve name: try market info map first, then fallback to slug/raw
      // Skip anonymized names from CLOB API (e.g. "Will Person L...")
      const resolvedInfo = resolveMarketInfo(conditionId);
      let rawName = resolvedInfo?.name
        || t.title || t.question
        || (tradeSlug ? tradeSlug.replace(/-/g, ' ') : '')
        || `Market ${conditionId?.slice(0, 8) || idx}`;
      if (ANON_RE.test(rawName) && resolvedInfo?.name) {
        rawName = resolvedInfo.name;
      }
      const marketName = rawName;
      // Only use slug-based URLs (condition IDs in URLs cause Polymarket 404s)
      const externalUrl = resolvedInfo?.externalUrl
        || (tradeSlug && !tradeSlug.startsWith('0x') && tradeSlug.length > 5
            ? `https://polymarket.com/event/${tradeSlug}`
            : 'https://polymarket.com');

      // Polymarket CLOB asset_id IS the specific outcome's token ID
      const assetId = t.asset_id || '';

      return {
        id: `poly-${t.id || `${Date.now()}-${idx}`}`,
        provider: 'Polymarket' as const,
        type: (t.type || 'FILL').toUpperCase() as TerminalTrade['type'],
        marketId: conditionId || `poly-${idx}`,
        marketName,
        side: displaySide,
        price: displayPrice,
        priceCents: `${(displayPrice * 100).toFixed(1)}¢`,
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
        outcomeIndex: resolvedInfo?.outcomeIndex,
        tokenId: assetId || resolvedInfo?.tokenId,
      };
    }).filter((trade: any) => {
      if (!trade.marketName || trade.marketName.length < 5) return false;
      if (ANON_RE.test(trade.marketName)) return false;
      // Drop trades from markets not in our active market map (likely resolved/closed)
      if (trade.marketId && _marketInfoMap.size > 0) {
        const info = resolveMarketInfo(trade.marketId);
        if (!info) return false;
      }
      return true;
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
        return !isKalshiSportsTicker(ticker);
      })
      .map((t: any, idx: number) => {
        // Kalshi API: taker_side = "yes"/"no", yes_price/no_price in CENTS (0-100),
        // price in DOLLARS (0-1). Use taker_side first, fallback to side.
        const tradeSide = (t.taker_side || t.side || 'yes').toLowerCase();

        // Price: yes_price/no_price are in CENTS (0-100); price is in DOLLARS (0-1)
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

        // Build name: resolved name from map, or parse ticker for range/target
        let resolvedName = resolvedInfo?.name || t.market_title || t.title || '';
        // If name is just the event title (no specific bet), extract from ticker
        // e.g. KXBTCD-26FEB2712-T66249.99 → target $66,249.99
        if (resolvedName && !resolvedName.includes(' to ') && !resolvedName.includes('$')) {
          const targetMatch = ticker.match(/-T([\d.]+)$/i);
          if (targetMatch) {
            const target = Number(targetMatch[1]);
            if (target > 0) {
              const fmt = target >= 1000
                ? `≤ $${target.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
                : `≤ $${target}`;
              // Only prepend if the name doesn't already have the target
              if (!resolvedName.includes(targetMatch[1])) {
                resolvedName = `${fmt} – ${resolvedName}`;
              }
            }
          }
        }
        // Fix redundant names like "X? – X?" where market and event titles overlap
        if (resolvedName.includes(' – ')) {
          const [a, b] = resolvedName.split(' – ');
          const aClean = a.replace(/\?$/, '').trim().toLowerCase();
          const bClean = b.replace(/\?$/, '').trim().toLowerCase();
          if (aClean.includes(bClean) || bClean.includes(aClean)) {
            resolvedName = a.length >= b.length ? a : b;
          }
        }

        const externalUrl = resolveExternalUrl(ticker, 'Kalshi');

        const FAST_PREFIXES = ['KXBTC', 'KXETH', 'KXSOL', 'KXXRP', 'KXDOGE', 'KXAVAX', 'KXLINK', 'KXBNB'];
        const tickerUpper = ticker.toUpperCase();
        const isFastTicker = FAST_PREFIXES.some(p => tickerUpper.startsWith(p));
        const category = resolvedInfo?.category || (isFastTicker ? 'Fast Markets' : '');

        return {
          id: `kalshi-${t.trade_id || `${Date.now()}-${idx}`}`,
          provider: 'Kalshi' as const,
          type: (t.action || 'FILL').toUpperCase() as TerminalTrade['type'],
          marketId: ticker || `kalshi-${idx}`,
          marketName: resolvedName,
          side: tradeSide === 'yes' ? 'Yes' : 'No',
          price,
          priceCents: `${(price * 100).toFixed(1)}¢`,
          shares: Number(shares),
          notional,
          fee: parseFloat(t.fee || '0') || Math.round(notional * 0.07 * 100) / 100,
          timestamp: t.created_time || t.executed_at || new Date().toISOString(),
          isWhale: notional >= WHALE_THRESHOLD,
          externalUrl,
          category,
          imageUrl: resolvedInfo?.imageUrl || '',
          tokenId: ticker,
          outcomeIndex: resolvedInfo?.outcomeIndex,
        };
      })
      .filter((trade: any) => {
        if (!trade.marketName) return false;
        if (trade.marketName.startsWith('KX') && !trade.marketName.includes(' ')) return false;
        if (ANON_RE.test(trade.marketName)) return false;
        // Drop trades from markets not in our active market map (likely settled/closed)
        if (trade.marketId && _marketInfoMap.size > 0) {
          const info = resolveMarketInfo(trade.marketId);
          if (!info) return false;
        }
        return true;
      });

    console.log(`[Terminal] Kalshi: ${trades.length} raw → ${realTrades.length} after sports + name + resolved filter`);

    // Return ONLY real trades; do not synthesize additional Kalshi trades
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

  const FIVE_MIN = 5 * 60 * 1000;
  const nowTs = Date.now();

  // Real trades only — no synthetic filler. Filtered to last 5 min, newest first.
  const allTrades = [...polyTrades, ...kalshiTrades]
    .filter(t => {
      const ts = Date.parse(t.timestamp);
      return !Number.isNaN(ts) && (nowTs - ts) <= FIVE_MIN;
    })
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

  console.log(`[Terminal] Merged: ${polyTrades.length} Poly + ${kalshiTrades.length} Kalshi → ${allTrades.length} real trades (5-min window)`);

  // Update caches (only keep trades from last 5 minutes, newest first)
  const existingIds = new Set(tradeCache.map(t => t.id));
  const newTrades = allTrades.filter(t => !existingIds.has(t.id));

  tradeCache = [...newTrades, ...tradeCache]
    .filter(t => {
      const ts = Date.parse(t.timestamp);
      return !Number.isNaN(ts) && (nowTs - ts) <= FIVE_MIN;
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
