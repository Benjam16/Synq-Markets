/**
 * Jupiter Swap API v6 — quotes and serialized swaps for SPL tokens (e.g. Pump.fun via Jupiter routes).
 * Uses JUPITER_API_KEY when set (recommended).
 */

const JUPITER_API_KEY = process.env.JUPITER_API_KEY;
const QUOTE_BASE =
  process.env.JUPITER_QUOTE_BASE_URL?.replace(/\/$/, '') ?? 'https://quote-api.jup.ag';

export type JupiterQuoteV6 = Record<string, unknown>;

export async function jupiterQuoteV6(params: {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps?: number;
  onlyDirectRoutes?: boolean;
}): Promise<JupiterQuoteV6> {
  const url = new URL(`${QUOTE_BASE}/v6/quote`);
  url.searchParams.set('inputMint', params.inputMint);
  url.searchParams.set('outputMint', params.outputMint);
  url.searchParams.set('amount', params.amount);
  url.searchParams.set('slippageBps', String(params.slippageBps ?? 100));
  if (params.onlyDirectRoutes) {
    url.searchParams.set('onlyDirectRoutes', 'true');
  }

  const headers: Record<string, string> = {};
  if (JUPITER_API_KEY) {
    headers['x-api-key'] = JUPITER_API_KEY;
  }

  const res = await fetch(url.toString(), { headers, cache: 'no-store' });
  const json = (await res.json().catch(() => null)) as JupiterQuoteV6 | { error?: string } | null;
  if (!res.ok || !json) {
    const msg =
      (json as { error?: string })?.error ||
      res.statusText ||
      'Jupiter quote failed';
    throw new Error(`Jupiter quote (${res.status}): ${String(msg).slice(0, 200)}`);
  }
  if ((json as { error?: string }).error) {
    throw new Error(String((json as { error: string }).error).slice(0, 200));
  }
  return json as JupiterQuoteV6;
}

export async function jupiterSwapV6(params: {
  quoteResponse: JupiterQuoteV6;
  userPublicKey: string;
}): Promise<{ swapTransaction: string }> {
  const url = `${QUOTE_BASE}/v6/swap`;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (JUPITER_API_KEY) {
    headers['x-api-key'] = JUPITER_API_KEY;
  }

  const body = {
    quoteResponse: params.quoteResponse,
    userPublicKey: params.userPublicKey,
    wrapAndUnwrapSol: true,
    dynamicComputeUnitLimit: true,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => null)) as
    | { swapTransaction?: string; error?: string }
    | null;

  if (!res.ok || !json?.swapTransaction) {
    const msg = json?.error || res.statusText || 'Jupiter swap build failed';
    throw new Error(`Jupiter swap (${res.status}): ${String(msg).slice(0, 200)}`);
  }
  return { swapTransaction: json.swapTransaction };
}
