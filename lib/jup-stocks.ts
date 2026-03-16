/**
 * Jupiter RWA/Stocks data layer.
 * - List: from static config + optional Tokens V2 (with JUPITER_API_KEY).
 * - Price/stats: Price v2 (client or server); Tokens V2 when key present for full metadata.
 */

import { RWA_TOKENS, type RWATokenConfig } from './rwa-tokens';

// ---------------------------------------------------------------------------
// Extended stock info (Jupiter terminal-style)
// ---------------------------------------------------------------------------

export interface JupStockStats {
  /** Price change over period (decimal, e.g. 0.02 = 2%) */
  priceChange5m?: number;
  priceChange1h?: number;
  priceChange6h?: number;
  priceChange24h?: number;
  /** 24h volume USD */
  volume24h?: number;
  /** Net buy/sell volume 24h */
  netVol24h?: number;
  /** Number of traders 24h */
  traders24h?: number;
  /** Net buyers count */
  netBuyers24h?: number;
  /** Liquidity USD */
  liquidity?: number;
  /** Holder count */
  holders?: number;
  /** Market cap (token) */
  mcap?: number;
  /** FDV */
  fdv?: number;
  /** Vol % change vs previous period */
  volDeltaPct?: number;
  liquidityDeltaPct?: number;
  holdersDeltaPct?: number;
}

export interface JupStockDetail {
  /** Base config from rwa-tokens */
  symbol: string;
  name: string;
  underlying: string;
  mint: string;
  sector?: string;
  /** Description (About X PreStocks) – from CMS or static when available */
  description?: string;
  /** Links (Watchlist, Wallet Tracker, AlphaScan, Jupiter page) */
  links?: {
    jupiter?: string;
    watchlist?: string;
    walletTracker?: string;
    alphaScan?: string;
  };
  /** Current price USD */
  price: number;
  /** Optional reference "mark" price for discount calculation */
  markPrice?: number;
  /** Discount % vs mark price when applicable */
  discount?: number;
  /** Underlying company market cap (e.g. for PreStocks) */
  stockMc?: number;
  /** Token market cap */
  mc?: number;
  /** Stats from Tokens V2 or Price v2 */
  stats?: JupStockStats;
  /** Token audit info */
  tokenInfo?: {
    top10HoldersPct?: number;
    freezeAuthorityDisabled?: boolean;
    mintAuthorityDisabled?: boolean;
  };
  /** Icon URL */
  icon?: string;
  decimals?: number;
}

// ---------------------------------------------------------------------------
// Price v2 response shape (subset we use)
// ---------------------------------------------------------------------------

interface PriceV2Entry {
  price?: number;
  priceChange24h?: number;
  volume24h?: number;
}

// ---------------------------------------------------------------------------
// Tokens V2 response shape (subset we use when API key is set)
// ---------------------------------------------------------------------------

interface TokensV2Token {
  id: string;
  name: string;
  symbol: string;
  icon?: string;
  decimals?: number;
  usdPrice?: number;
  liquidity?: number;
  holderCount?: number;
  mcap?: number;
  fdv?: number;
  audit?: {
    mintAuthorityDisabled?: boolean;
    freezeAuthorityDisabled?: boolean;
    topHoldersPercentage?: number;
  };
  stats5m?: {
    priceChange?: number;
    liquidityChange?: number;
    volumeChange?: number;
  };
  stats1h?: {
    priceChange?: number;
    liquidityChange?: number;
    volumeChange?: number;
  };
  stats6h?: {
    priceChange?: number;
    liquidityChange?: number;
    volumeChange?: number;
  };
  stats24h?: {
    priceChange?: number;
    liquidityChange?: number;
    volumeChange?: number;
    buyVolume?: number;
    sellVolume?: number;
    numBuys?: number;
    numSells?: number;
    numTraders?: number;
    numNetBuyers?: number;
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const JUP_PRICE_V2 = 'https://api.jup.ag/price/v2';
const JUP_TOKENS_V2_SEARCH = 'https://api.jup.ag/tokens/v2/search';
const JUP_TERMINAL_STOCK = (symbol: string) => `https://jup.ag/terminal/stocks/${symbol.toLowerCase()}`;

/** Load generated list from sync script (Node only). */
function loadGeneratedRwaList(): RWATokenConfig[] {
  if (typeof process === 'undefined' || !process.env) return [];
  try {
    const path = require('path');
    const fs = require('fs');
    const p = path.join(process.cwd(), 'lib', 'rwa-tokens-generated.json');
    if (fs.existsSync(p)) {
      const raw = JSON.parse(fs.readFileSync(p, 'utf-8'));
      return Array.isArray(raw) ? (raw as RWATokenConfig[]) : [];
    }
  } catch {
    // ignore
  }
  return [];
}

/** Get list of RWA stocks: static config merged with generated (mints from sync script). */
export function getStockList(): RWATokenConfig[] {
  const generated = loadGeneratedRwaList();
  const generatedBySymbol = new Map(generated.map((t) => [t.symbol, t]));

  const staticSymbols = new Set(RWA_TOKENS.map((t) => t.symbol));
  const merged: RWATokenConfig[] = RWA_TOKENS.map((t) => {
    const gen = generatedBySymbol.get(t.symbol);
    return {
      ...t,
      mint: gen?.mint ? gen.mint : t.mint,
    };
  });
  for (const g of generated) {
    if (!staticSymbols.has(g.symbol)) merged.push(g);
  }
  return merged;
}

/** Fetch price v2 for given mints. Call from client or server. */
export async function fetchPriceV2(
  mints: string[],
  apiKey?: string
): Promise<Record<string, PriceV2Entry>> {
  if (mints.length === 0) return {};
  const unique = [...new Set(mints)];
  const out: Record<string, PriceV2Entry> = {};

  // Jupiter Price API allows multiple ids; batch in chunks to be safe.
  const chunkSize = 100;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const ids = chunk.join(',');
    const res = await fetch(`${JUP_PRICE_V2}?ids=${encodeURIComponent(ids)}`, {
      cache: 'no-store',
      headers: apiKey ? { 'x-api-key': apiKey } : undefined,
    });
    if (!res.ok) continue;
    const data = await res.json();
    const map = (data.data ?? data) as Record<string, PriceV2Entry>;
    for (const [mint, entry] of Object.entries(map)) {
      out[mint] = entry as PriceV2Entry;
    }
  }
  return out;
}

/** Fetch Tokens V2 search for given mints. Requires x-api-key. Returns map mint -> token. */
export async function fetchTokensV2(
  mints: string[],
  apiKey: string
): Promise<Record<string, TokensV2Token>> {
  if (mints.length === 0 || !apiKey) return {};
  const unique = [...new Set(mints)];
  const out: Record<string, TokensV2Token> = {};

  // Tokens V2 search: max 100 mint addresses per query → batch.
  const chunkSize = 100;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const query = chunk.join(',');
    const res = await fetch(`${JUP_TOKENS_V2_SEARCH}?query=${encodeURIComponent(query)}`, {
      headers: { 'x-api-key': apiKey },
      cache: 'no-store',
    });
    if (!res.ok) continue;
    const arr = (await res.json()) as TokensV2Token[];
    for (const t of arr) {
      if (t?.id) out[t.id] = t;
    }
  }
  return out;
}

/** Build Jupiter terminal link for a symbol (e.g. OPENAI, ANDURIL). */
export function getJupiterStockLink(symbol: string): string {
  return JUP_TERMINAL_STOCK(symbol);
}

/** Enrich a single stock config with price and optional Tokens V2 data. */
export function enrichStock(
  config: RWATokenConfig,
  priceData: PriceV2Entry | undefined,
  tokensV2: TokensV2Token | undefined
): JupStockDetail {
  const price = priceData?.price ?? tokensV2?.usdPrice ?? 0;
  const markPrice = tokensV2?.usdPrice ?? priceData?.price;
  const discount =
    markPrice != null && price > 0 && markPrice > 0
      ? ((price - markPrice) / markPrice) * 100
      : undefined;

  const volume24h =
    tokensV2?.stats24h?.buyVolume != null && tokensV2?.stats24h?.sellVolume != null
      ? tokensV2.stats24h.buyVolume + tokensV2.stats24h.sellVolume
      : priceData?.volume24h;

  const stats: JupStockStats | undefined =
    tokensV2?.stats24h || tokensV2?.liquidity != null
      ? {
          priceChange5m: tokensV2.stats5m?.priceChange,
          priceChange1h: tokensV2.stats1h?.priceChange,
          priceChange6h: tokensV2.stats6h?.priceChange,
          priceChange24h: tokensV2.stats24h?.priceChange ?? priceData?.priceChange24h,
          volume24h,
          liquidity: tokensV2.liquidity,
          holders: tokensV2.holderCount,
          mcap: tokensV2.mcap,
          fdv: tokensV2.fdv,
          volDeltaPct: tokensV2.stats24h?.volumeChange,
          liquidityDeltaPct: tokensV2.stats24h?.liquidityChange,
          netVol24h:
            tokensV2.stats24h && tokensV2.stats24h.buyVolume != null && tokensV2.stats24h.sellVolume != null
              ? tokensV2.stats24h.buyVolume - tokensV2.stats24h.sellVolume
              : undefined,
          traders24h: tokensV2.stats24h?.numTraders,
          netBuyers24h: tokensV2.stats24h?.numNetBuyers,
        }
      : priceData
        ? {
            priceChange24h: priceData.priceChange24h,
            volume24h: priceData.volume24h,
          }
        : undefined;

  return {
    ...config,
    price,
    markPrice,
    discount,
    stockMc: undefined,
    mc: tokensV2?.mcap,
    stats,
    tokenInfo: tokensV2?.audit
      ? {
          top10HoldersPct: tokensV2.audit.topHoldersPercentage,
          freezeAuthorityDisabled: tokensV2.audit.freezeAuthorityDisabled,
          mintAuthorityDisabled: tokensV2.audit.mintAuthorityDisabled,
        }
      : undefined,
    icon: tokensV2?.icon,
    decimals: tokensV2?.decimals,
    links: {
      jupiter: getJupiterStockLink(config.symbol),
    },
  };
}
