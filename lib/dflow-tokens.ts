import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';

const DFLOW_QUOTE_BASE_URL = process.env.DFLOW_QUOTE_BASE_URL!;
const DFLOW_API_KEY = process.env.DFLOW_API_KEY;
const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || undefined;

type MintDecimalsMap = Record<string, number>;

let cachedDecimals: MintDecimalsMap | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Well-known core mints used in the app.
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

async function fetchTokensWithDecimals(): Promise<MintDecimalsMap> {
  if (!DFLOW_QUOTE_BASE_URL) {
    throw new Error('DFLOW_QUOTE_BASE_URL is not configured');
  }

  const url = new URL('/tokens-with-decimals', DFLOW_QUOTE_BASE_URL);
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: DFLOW_API_KEY ? { 'x-api-key': DFLOW_API_KEY } : undefined,
    cache: 'no-store',
  });

  if (!res.ok) {
    // Avoid leaking upstream HTML into UI; keep error terse.
    const text = await res.text().catch(() => '');
    const brief = text
      ? String(text).replace(/<[^>]+>/g, '').slice(0, 160)
      : res.statusText;
    throw new Error(`Dflow tokens-with-decimals failed (${res.status}): ${brief}`);
  }

  const doc = (await res.json()) as [string, number][];
  const out: MintDecimalsMap = {};
  for (const entry of doc) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const [mint, decs] = entry;
    if (typeof mint === 'string' && typeof decs === 'number') {
      out[mint] = decs;
    }
  }
  return out;
}

async function ensureDecimalsLoaded() {
  const now = Date.now();
  if (cachedDecimals && now - cacheLoadedAt < CACHE_TTL_MS) return;
  try {
    cachedDecimals = await fetchTokensWithDecimals();
    cacheLoadedAt = now;
  } catch {
    // If Dflow is temporarily unavailable, keep whatever cache we have and
    // allow RPC fallback per-mint.
    cachedDecimals = cachedDecimals || {};
    cacheLoadedAt = now;
  }
}

export async function getDflowMintDecimals(mint: string): Promise<number | null> {
  await ensureDecimalsLoaded();
  const decs = cachedDecimals?.[mint];
  if (typeof decs === 'number') return decs;

  // Fallback: if Dflow list doesn't include it yet, ask Solana RPC.
  try {
    const rpc = SOLANA_RPC_URL || clusterApiUrl('mainnet-beta');
    const conn = new Connection(rpc, { commitment: 'confirmed' });
    const supply = await conn.getTokenSupply(new PublicKey(mint));
    const rpcDecs = supply?.value?.decimals;
    if (typeof rpcDecs === 'number' && Number.isFinite(rpcDecs)) {
      cachedDecimals = cachedDecimals || {};
      cachedDecimals[mint] = rpcDecs;
      return rpcDecs;
    }
  } catch {
    // ignore
  }

  // Last-resort heuristic: Dflow tokens are 6 or 9 decimals.
  // We special-case the core assets we trade with, and otherwise assume 6.
  if (mint === SOL_MINT) return 9;
  if (mint === USDC_MINT) return 6;

  return 6;
}

