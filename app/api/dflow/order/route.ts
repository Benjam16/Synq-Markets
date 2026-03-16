import { NextRequest, NextResponse } from 'next/server';
import { getDflowMintDecimals } from '@/lib/dflow-tokens';
import { parseUiAmountToScaledInt } from '@/lib/dflow-amount';

const DFLOW_QUOTE_BASE_URL = process.env.DFLOW_QUOTE_BASE_URL!;
const DFLOW_API_KEY = process.env.DFLOW_API_KEY;

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      inputMint,
      outputMint,
      amount,
      uiAmount,
      slippageBps = 50,
      userPublicKey,
      dexes,
    } = body || {};

    if (!inputMint || !outputMint || !userPublicKey) {
      return NextResponse.json(
        { error: 'inputMint, outputMint, userPublicKey required' },
        { status: 400 }
      );
    }

    if (!DFLOW_QUOTE_BASE_URL) {
      return NextResponse.json(
        { error: 'DFLOW_QUOTE_BASE_URL is not configured' },
        { status: 500 }
      );
    }

    let finalAmountStr: string | null = null;

    if (typeof amount === 'number' || typeof amount === 'string') {
      finalAmountStr = String(amount);
    } else if (uiAmount != null) {
      const decs = await getDflowMintDecimals(String(inputMint));
      if (decs == null) {
        return NextResponse.json(
          { error: `No decimals found for mint ${inputMint} in Dflow tokens list` },
          { status: 400 }
        );
      }
      const scaled = parseUiAmountToScaledInt(String(uiAmount), decs);
      finalAmountStr = scaled.toString();
    }

    if (!finalAmountStr) {
      return NextResponse.json(
        { error: 'Either amount or uiAmount must be provided' },
        { status: 400 }
      );
    }

    const url = new URL('/order', DFLOW_QUOTE_BASE_URL);
    url.searchParams.set('userPublicKey', String(userPublicKey));
    url.searchParams.set('inputMint', String(inputMint));
    url.searchParams.set('outputMint', String(outputMint));
    url.searchParams.set('amount', finalAmountStr);
    url.searchParams.set('slippageBps', String(slippageBps));

    if (Array.isArray(dexes)) {
      for (const d of dexes) {
        if (typeof d === 'string' && d.trim()) {
          url.searchParams.append('dexes', d.trim());
        }
      }
    }

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        ...(DFLOW_API_KEY ? { 'x-api-key': DFLOW_API_KEY } : {}),
      },
      cache: 'no-store',
    });

    const json = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        {
          error: json?.error || 'Failed to fetch Dflow order',
          details: json,
        },
        { status: res.status }
      );
    }

    // Normalise the response so the client can always read these fields.
    const quote = json?.quote ?? json;
    const transaction =
      json?.transaction ?? json?.order?.transaction ?? json?.data?.transaction;
    const outAmount =
      quote?.outAmount ?? quote?.order?.outAmount ?? json?.outAmount;

    const routePlan = Array.isArray(quote?.routePlan) ? quote.routePlan : [];
    const lastLeg =
      routePlan.length > 0 ? routePlan[routePlan.length - 1] : undefined;

    let outDecimals: number | undefined;
    if (typeof lastLeg?.outputMintDecimals === 'number') {
      outDecimals = lastLeg.outputMintDecimals;
    } else if (outputMint) {
      const decs = await getDflowMintDecimals(String(outputMint));
      if (typeof decs === 'number') {
        outDecimals = decs;
      }
    }

    return NextResponse.json({
      ...json,
      transaction,
      outAmount,
      outDecimals,
    });
  } catch (e) {
    console.error('[api/dflow/order]', e);
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : 'Dflow order error',
      },
      { status: 500 }
    );
  }
}

