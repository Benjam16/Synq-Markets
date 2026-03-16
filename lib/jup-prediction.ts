import { captureError } from '@/lib/error-reporting';

const JUP_BASE = 'https://api.jup.ag/prediction/v1';

function getApiKey(): string {
  const key = process.env.JUP_PREDICTION_API_KEY;
  if (!key) throw new Error('Missing JUP_PREDICTION_API_KEY');
  return key;
}

export type JupPredictionEvent = {
  eventId: string;
  title?: string;
  subtitle?: string;
  imageUrl?: string;
  category?: string;
  subcategory?: string;
  isLive?: boolean;
  isActive?: boolean;
  markets?: Array<{
    marketId: string;
    status: string;
    result: string | null;
    metadata?: { title?: string; subtitle?: string };
    pricing?: {
      buyYesPriceUsd?: number;
      buyNoPriceUsd?: number;
      sellYesPriceUsd?: number;
      sellNoPriceUsd?: number;
      volume?: number;
    };
  }>;
};

export type JupPredictionMarket = {
  marketId: string;
  status: string;
  result: string | null;
  openTime?: number;
  closeTime?: number;
  metadata?: {
    eventId?: string;
    title?: string;
    subtitle?: string;
    description?: string;
    rulesPrimary?: string;
  };
  pricing?: {
    buyYesPriceUsd?: number;
    buyNoPriceUsd?: number;
    sellYesPriceUsd?: number;
    sellNoPriceUsd?: number;
    volume?: number;
  };
};

export type JupOrderbook = {
  yes: [number, number][];
  no: [number, number][];
  yes_dollars?: [string, number][];
  no_dollars?: [string, number][];
};

export type JupCreateOrderRequest = {
  ownerPubkey: string;
  depositAmount: string; // micro USD units
  depositMint: string;
  marketId: string;
  isYes: boolean;
  isBuy: boolean;
  contracts?: string;
};

export type JupCreateOrderResponse = {
  transaction: string; // base64
  txMeta?: { blockhash?: string; lastValidBlockHeight?: number };
  order?: { orderPubkey?: string; positionPubkey?: string; contracts?: string };
  blockhash?: string;
  lastValidBlockHeight?: number;
};

async function jupFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${JUP_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      'x-api-key': getApiKey(),
    },
    // Avoid Next caching surprises in server routes
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Jupiter Prediction API ${res.status}: ${text || res.statusText}`);
  }

  return (await res.json()) as T;
}

export async function listEvents(params: Record<string, string | number | boolean | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    qs.set(k, String(v));
  }
  return jupFetch<{ data?: JupPredictionEvent[]; events?: JupPredictionEvent[] }>(`/events?${qs}`);
}

export async function searchEvents(query: string, limit = 10) {
  const qs = new URLSearchParams({ query, limit: String(limit) });
  return jupFetch(`/events/search?${qs}`);
}

export async function getEvent(eventId: string) {
  return jupFetch<JupPredictionEvent>(`/events/${encodeURIComponent(eventId)}`);
}

export async function getMarket(marketId: string) {
  return jupFetch<JupPredictionMarket>(`/markets/${encodeURIComponent(marketId)}`);
}

export async function getOrderbook(marketId: string) {
  return jupFetch<JupOrderbook>(`/orderbook/${encodeURIComponent(marketId)}`);
}

export async function createOrder(body: JupCreateOrderRequest) {
  try {
    return await jupFetch<JupCreateOrderResponse>(`/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    captureError(e, { context: 'jup-prediction.createOrder' });
    throw e;
  }
}

export async function getOrderStatus(orderPubkey: string) {
  return jupFetch(`/orders/status/${encodeURIComponent(orderPubkey)}`);
}

export async function getPositions(ownerPubkey: string) {
  const qs = new URLSearchParams({ ownerPubkey });
  return jupFetch(`/positions?${qs}`);
}

export async function closePosition(positionPubkey: string, ownerPubkey: string) {
  return jupFetch(`/positions/${encodeURIComponent(positionPubkey)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ownerPubkey }),
  });
}

export async function claimPosition(positionPubkey: string, ownerPubkey: string) {
  return jupFetch(`/positions/${encodeURIComponent(positionPubkey)}/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ownerPubkey }),
  });
}

