const BASE = process.env.COINGECKO_ONCHAIN_BASE_URL!;
const KEY = process.env.COINGECKO_API_KEY!;

export type OnchainTokenStats = {
  priceUsd?: number;
  priceChange5m?: number;
  priceChange1h?: number;
  priceChange6h?: number;
  priceChange24h?: number;
  volume24hUsd?: number;
  liquidityUsd?: number;
  fdvUsd?: number;
  marketCapUsd?: number | null;
  iconUrl?: string;
  decimals?: number;
};

export async function fetchOnchainStatsForMints(
  mints: string[],
): Promise<Record<string, OnchainTokenStats>> {
  if (!KEY) throw new Error('COINGECKO_API_KEY missing');
  if (!BASE) throw new Error('COINGECKO_ONCHAIN_BASE_URL missing');
  if (!mints.length) return {};

  const result: Record<string, OnchainTokenStats> = {};
  const unique = [...new Set(mints)];
  const chunkSize = 40; // API allows up to 50 addresses

  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const addresses = chunk.join(',');

    const url = `${BASE}/networks/solana/tokens/multi/${addresses}?include=top_pools`;
    const res = await fetch(url, {
      // Demo/public keys use x-cg-demo-api-key per CoinGecko docs.
      headers: { 'x-cg-demo-api-key': KEY },
      cache: 'no-store',
    });
    if (!res.ok) {
      // Skip this batch on error, but keep others
      // You can log res.status/res.text() here if needed.
      continue;
    }

    const json: any = await res.json();
    const data: any[] = Array.isArray(json?.data) ? json.data : [];
    const included: any[] = Array.isArray(json?.included) ? json.included : [];

    const poolById = new Map<string, any>();
    for (const inc of included) {
      if (inc?.type === 'pool' && typeof inc?.id === 'string') {
        poolById.set(inc.id, inc?.attributes ?? {});
      }
    }

    for (const item of data) {
      const attrs: any = item?.attributes ?? {};
      const mint: string | undefined = attrs.address;
      if (!mint) continue;

      const price = Number(attrs.price_usd ?? '0') || 0;
      const vol: any = attrs.volume_usd ?? {};
      const iconUrl: string | undefined =
        typeof attrs.image_url === 'string' ? attrs.image_url : undefined;
      const decimals: number | undefined =
        typeof attrs.decimals === 'number' ? attrs.decimals : undefined;

      // For price changes and liquidity, use the token's top pool (most liquid),
      // because those fields often live on the pool object.
      const topPoolId: string | undefined =
        item?.relationships?.top_pools?.data?.[0]?.id;
      const poolAttrs: any | undefined = topPoolId
        ? poolById.get(topPoolId)
        : undefined;

      const pc: any = poolAttrs?.price_change_percentage ?? {};
      const liq =
        Number(poolAttrs?.reserve_in_usd ?? attrs.total_reserve_in_usd ?? '0') ||
        0;
      const fdv = attrs.fdv_usd;
      const mcap = attrs.market_cap_usd;

      result[mint] = {
        priceUsd: price,
        priceChange5m: pc.m5 != null ? Number(pc.m5) : undefined,
        priceChange1h: pc.h1 != null ? Number(pc.h1) : undefined,
        priceChange6h: pc.h6 != null ? Number(pc.h6) : undefined,
        priceChange24h: pc.h24 != null ? Number(pc.h24) : undefined,
        volume24hUsd: vol.h24 != null ? Number(vol.h24) : undefined,
        liquidityUsd: liq,
        fdvUsd: fdv != null ? Number(fdv) : undefined,
        marketCapUsd: mcap != null ? Number(mcap) : null,
        iconUrl,
        decimals,
      };
    }
  }

  return result;
}

