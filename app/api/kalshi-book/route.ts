import { NextRequest, NextResponse } from 'next/server';

const KALSHI_API_BASE = 'https://api.elections.kalshi.com';

function generateKalshiHeaders(method: string, path: string, accessKey: string, privateKey: string): Record<string, string> {
  try {
    const crypto = require('crypto');
    const timestamp = Math.floor(Date.now() / 1000);
    const message = `${timestamp}${method}${path}`;
    const key = crypto.createPrivateKey({
      key: privateKey,
      format: 'pem',
      type: 'pkcs8',
    });
    const signature = crypto.sign('sha256', Buffer.from(message), {
      key,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
    });
    return {
      'KALSHI-ACCESS-KEY': accessKey,
      'KALSHI-ACCESS-SIGNATURE': signature.toString('base64'),
      'KALSHI-ACCESS-TIMESTAMP': timestamp.toString(),
    };
  } catch {
    return {};
  }
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker');
  if (!ticker) {
    return NextResponse.json({ bids: [], asks: [] });
  }

  const accessKey = process.env.KALSHI_ACCESS_KEY;
  const privateKey = process.env.KALSHI_PRIVATE_KEY;
  if (!accessKey || !privateKey) {
    return NextResponse.json({ bids: [], asks: [] });
  }

  try {
    const path = `/trade-api/v2/markets/${encodeURIComponent(ticker)}/orderbook`;
    const authHeaders = generateKalshiHeaders('GET', path, accessKey, privateKey);

    const res = await fetch(`${KALSHI_API_BASE}${path}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json({ bids: [], asks: [] });
    }

    const data = await res.json();
    // Kalshi orderbook: { orderbook: { yes: [[price, size], ...], no: [[price, size], ...] } }
    const ob = data.orderbook || {};
    const yesBids = ob.yes || [];
    const noAsks = ob.no || [];

    let bidTotal = 0;
    const bids = yesBids.map((entry: [number, number]) => {
      const [price, size] = entry;
      bidTotal += size;
      return { price, size, total: bidTotal };
    });

    let askTotal = 0;
    const asks = noAsks.map((entry: [number, number]) => {
      const [price, size] = entry;
      askTotal += size;
      return { price: 100 - price, size, total: askTotal };
    }).sort((a: any, b: any) => a.price - b.price);

    return NextResponse.json({ bids, asks });
  } catch (err) {
    return NextResponse.json({ bids: [], asks: [] });
  }
}
