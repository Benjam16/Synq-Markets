const GT_BASE = 'https://api.geckoterminal.com/api/v2';
const GT_ACCEPT = 'application/json;version=20230203';

export type GeckoTokenStats = {
  priceUsd?: number;
  priceChange5m?: number;
  priceChange1h?: number;
  priceChange6h?: number;
  priceChange24h?: number;
  volume24hUsd?: number;
  liquidityUsd?: number;
  fdvUsd?: number;
  marketCapUsd?: number | null;
};

function pickBestPool(poolsData: any): any | null {
  const included = Array.isArray(poolsData?.included) ? poolsData.included : [];
  const pools = Array.isArray(poolsData?.data) ? poolsData.data : [];
  if (included.length) {
    let best: any = null;
    let bestLiq = -1;
    for (const inc of included) {
      if (inc?.type !== 'pool') continue;
      const liq = Number(
        inc?.attributes?.reserve_in_usd ?? inc?.attributes?.liquidity_usd ?? 0,
      );
      if (liq > bestLiq) {
        bestLiq = liq;
        best = inc;
      }
    }
    if (best) return best;
  }
  if (pools[0]) return pools[0];
  return null;
}

async function fetchStatsForMint(mint: string): Promise<GeckoTokenStats | null> {
  const poolsUrl = `${GT_BASE}/networks/solana/tokens/${encodeURIComponent(
    mint,
  )}/pools`;
  const poolsRes = await fetch(poolsUrl, {
    cache: 'no-store',
    headers: { Accept: GT_ACCEPT },
  });
  if (!poolsRes.ok) {
    return null;
  }
  const poolsJson = await poolsRes.json();
  const bestPool = pickBestPool(poolsJson);
  if (!bestPool) return null;
  const attrs: any = bestPool.attributes ?? {};

  const priceRaw = attrs.base_token_price_usd ?? attrs.quote_token_price_usd ?? null;
  const priceUsd =
    priceRaw == null ? undefined : (Number(priceRaw) || undefined);
  const pc: any = attrs.price_change_percentage ?? {};
  const vol: any = attrs.volume_usd ?? {};
  const liq =
    Number(attrs.reserve_in_usd ?? attrs.liquidity_usd ?? '0') || 0;
  const fdv = attrs.fdv_usd;
  const mcap = attrs.market_cap_usd;

  return {
    priceUsd,
    priceChange5m: pc.m5 != null ? Number(pc.m5) : undefined,
    priceChange1h: pc.h1 != null ? Number(pc.h1) : undefined,
    priceChange6h: pc.h6 != null ? Number(pc.h6) : undefined,
    priceChange24h: pc.h24 != null ? Number(pc.h24) : undefined,
    volume24hUsd: vol.h24 != null ? Number(vol.h24) : undefined,
    liquidityUsd: liq,
    fdvUsd: fdv != null ? Number(fdv) : undefined,
    marketCapUsd: mcap != null ? Number(mcap) : null,
  };
}

export async function fetchGeckoStatsForMints(
  mints: string[],
): Promise<Record<string, GeckoTokenStats>> {
  const result: Record<string, GeckoTokenStats> = {};
  const unique = [...new Set(mints)];

  const concurrency = 15;
  let index = 0;

  async function worker() {
    while (index < unique.length) {
      const i = index++;
      const mint = unique[i];
      try {
        const stats = await fetchStatsForMint(mint);
        if (stats) {
          result[mint] = stats;
        }
      } catch {
        // ignore individual errors
      }
    }
  }

  const workers = [];
  for (let i = 0; i < concurrency; i++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  return result;
}

