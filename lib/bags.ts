const BAGS_BASE_URL =
  process.env.BAGS_BASE_URL ?? 'https://public-api-v2.bags.fm/api/v1';
const BAGS_API_KEY = process.env.BAGS_API_KEY;

type BagsSuccess<T> = { success: true; response: T };
type BagsError = { success: false; error: string };

async function bagsFetch<T>(
  path: string,
  init?: RequestInit & { query?: Record<string, string | number | boolean | undefined | null> },
): Promise<T> {
  if (!BAGS_API_KEY) {
    throw new Error('BAGS_API_KEY is not configured');
  }

  // Important: `new URL('/foo', base)` resets the base path.
  // Our BAGS_BASE_URL already includes `/api/v1`, so strip any leading slash.
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  const url = new URL(normalizedPath, BAGS_BASE_URL.endsWith('/') ? BAGS_BASE_URL : `${BAGS_BASE_URL}/`);
  const query = init?.query;
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v == null) continue;
      url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url.toString(), {
    ...init,
    headers: {
      accept: 'application/json',
      'x-api-key': BAGS_API_KEY,
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });

  const json = (await res.json().catch(() => null)) as BagsSuccess<T> | BagsError | null;
  if (!res.ok || !json) {
    const msg =
      (json as any)?.error ||
      (json as any)?.message ||
      res.statusText ||
      'Unknown error';
    throw new Error(`Bags API ${path} failed (${res.status}): ${String(msg)}`);
  }
  if ((json as BagsError).success === false) {
    throw new Error(`Bags API ${path} error: ${(json as BagsError).error}`);
  }
  return (json as BagsSuccess<T>).response;
}

export type BagsPoolInfo = {
  tokenMint: string;
  dbcConfigKey: string;
  dbcPoolKey: string;
  dammV2PoolKey?: string | null;
};

export async function getBagsPools(onlyMigrated = false): Promise<BagsPoolInfo[]> {
  return await bagsFetch<BagsPoolInfo[]>('/solana/bags/pools', {
    method: 'GET',
    query: { onlyMigrated },
  });
}

export type BagsTradeQuoteResponse = {
  requestId: string;
  contextSlot: number;
  inAmount: string;
  inputMint: string;
  outAmount: string;
  outputMint: string;
  minOutAmount: string;
  otherAmountThreshold: string;
  priceImpactPct: string;
  slippageBps: number;
  routePlan: Array<{
    venue: string;
    inAmount: string;
    outAmount: string;
    inputMint: string;
    outputMint: string;
    inputMintDecimals: number;
    outputMintDecimals: number;
    marketKey: string;
    data: string;
  }>;
  platformFee?: {
    amount: string;
    feeBps: number;
    feeAccount: string;
    segmenterFeeAmount: string;
    segmenterFeePct: number;
  } | null;
  outTransferFee?: string | null;
  simulatedComputeUnits?: number | null;
};

export async function getBagsTradeQuote(params: {
  inputMint: string;
  outputMint: string;
  amount: number; // smallest units
  slippageMode?: 'auto' | 'manual';
  slippageBps?: number;
}): Promise<BagsTradeQuoteResponse> {
  const { inputMint, outputMint, amount, slippageMode = 'auto', slippageBps } = params;
  return await bagsFetch<BagsTradeQuoteResponse>('/trade/quote', {
    method: 'GET',
    query: {
      inputMint,
      outputMint,
      amount,
      slippageMode,
      slippageBps: slippageMode === 'manual' ? slippageBps : undefined,
    },
  });
}

export type BagsSwapResponse = {
  swapTransaction: string; // base58 encoded serialized VersionedTransaction
  computeUnitLimit: number;
  lastValidBlockHeight: number;
  prioritizationFeeLamports: number;
};

export async function createBagsSwapTransaction(body: {
  quoteResponse: BagsTradeQuoteResponse;
  userPublicKey: string;
}): Promise<BagsSwapResponse> {
  return await bagsFetch<BagsSwapResponse>('/trade/swap', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export type BagsTokenLaunchFeedItem = {
  name: string;
  symbol: string;
  description: string;
  image: string;
  tokenMint: string;
  status: 'PRE_LAUNCH' | 'PRE_GRAD' | 'MIGRATING' | 'MIGRATED';
  twitter?: string | null;
  website?: string | null;
  launchSignature?: string | null;
  accountKeys?: string[] | null;
  numRequiredSigners?: number | null;
  uri?: string | null;
  dbcPoolKey?: string | null;
  dbcConfigKey?: string | null;
};

export async function getBagsTokenLaunchFeed(): Promise<BagsTokenLaunchFeedItem[]> {
  return await bagsFetch<BagsTokenLaunchFeedItem[]>('/token-launch/feed', {
    method: 'GET',
  });
}

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const ONE_USDC_RAW = 1_000_000;

export async function getBagsPriceUsd(
  tokenMint: string,
  tokenDecimals: number,
): Promise<number | null> {
  try {
    const quote = await getBagsTradeQuote({
      inputMint: USDC_MINT,
      outputMint: tokenMint,
      amount: ONE_USDC_RAW,
      slippageMode: 'auto',
    });
    const outAmountStr = quote?.outAmount;
    if (!outAmountStr) return null;
    const outAmount = BigInt(outAmountStr);
    if (outAmount <= BigInt(0)) return null;
    const decimals = Number.isFinite(tokenDecimals) ? tokenDecimals : 6;
    // Convert to Number safely for display-only pricing. For huge outAmount values,
    // precision may be limited, but this is sufficient for a screener price.
    const tokenAmount = Number(outAmount) / Math.pow(10, decimals);
    if (!tokenAmount || !Number.isFinite(tokenAmount)) return null;
    return 1 / tokenAmount;
  } catch {
    return null;
  }
}

