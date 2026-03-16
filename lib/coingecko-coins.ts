const BASE = 'https://api.coingecko.com/api/v3';
const KEY = process.env.COINGECKO_API_KEY!;

export type CoinMarket = {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  current_price?: number;
  price_change_percentage_24h?: number;
  market_cap?: number;
  total_volume?: number;
  fully_diluted_valuation?: number;
};

export async function fetchCoinMarketsById(
  ids: string[],
): Promise<Record<string, CoinMarket>> {
  if (!KEY) throw new Error('COINGECKO_API_KEY missing');
  const unique = [...new Set(ids)].filter(Boolean);
  if (!unique.length) return {};

  const url = `${BASE}/coins/markets?vs_currency=usd&ids=${encodeURIComponent(
    unique.join(','),
  )}`;
  const res = await fetch(url, {
    headers: { 'x-cg-demo-api-key': KEY },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `CoinGecko markets failed (${res.status}): ${text || res.statusText}`,
    );
  }

  const arr = (await res.json()) as any[];
  const out: Record<string, CoinMarket> = {};
  for (const c of arr) {
    if (c?.id) out[String(c.id)] = c as CoinMarket;
  }
  return out;
}

