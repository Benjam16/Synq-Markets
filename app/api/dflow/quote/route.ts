import { NextRequest, NextResponse } from 'next/server';
import { getDflowMintDecimals } from '@/lib/dflow-tokens';
import { parseUiAmountToScaledInt } from '@/lib/dflow-amount';

const DFLOW_QUOTE_BASE_URL = process.env.DFLOW_QUOTE_BASE_URL!;
const DFLOW_API_KEY = process.env.DFLOW_API_KEY;

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const url = new URL('/quote', DFLOW_QUOTE_BASE_URL);
    const inputMint = req.nextUrl.searchParams.get('inputMint');
    const outputMint = req.nextUrl.searchParams.get('outputMint');
    const uiAmountStr = req.nextUrl.searchParams.get('uiAmount');
    const amountStr = req.nextUrl.searchParams.get('amount'); // legacy, already scaled
    const slippageBps = req.nextUrl.searchParams.get('slippageBps') ?? '50';
    const dexes = req.nextUrl.searchParams.get('dexes') ?? undefined;

    if (!inputMint || !outputMint) {
      return NextResponse.json(
        { error: 'inputMint and outputMint required' },
        { status: 400 },
      );
    }

    let finalAmountStr = amountStr;

    // Prefer uiAmount + Dflow decimals when provided.
    if (!finalAmountStr) {
      if (!uiAmountStr) {
        return NextResponse.json(
          { error: 'Either uiAmount or amount must be provided' },
          { status: 400 },
        );
      }
      const decs = await getDflowMintDecimals(inputMint);
      if (decs == null) {
        return NextResponse.json(
          { error: `No decimals found for mint ${inputMint} in Dflow tokens list` },
          { status: 400 },
        );
      }
      const scaled = parseUiAmountToScaledInt(uiAmountStr, decs);
      finalAmountStr = scaled.toString();
    }

    url.searchParams.set('inputMint', inputMint);
    url.searchParams.set('outputMint', outputMint);
    url.searchParams.set('amount', finalAmountStr);
    url.searchParams.set('slippageBps', slippageBps);
    if (dexes) url.searchParams.set('dexes', dexes);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: DFLOW_API_KEY ? { 'x-api-key': DFLOW_API_KEY } : undefined,
      cache: 'no-store',
    });

    const json = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        {
          error: json?.error || json?.msg || 'Failed to fetch Dflow quote',
          details: json,
        },
        { status: res.status },
      );
    }

    // Dflow may respond either with the quote object at the top level
    // or wrapped in a { quote: { ... } } envelope. Normalise that here.
    const quote = json?.quote ?? json;
    const outAmount = quote?.outAmount;

    const routePlan = Array.isArray(quote?.routePlan) ? quote.routePlan : [];
    const lastLeg =
      routePlan.length > 0 ? routePlan[routePlan.length - 1] : undefined;

    let outDecimals: number | undefined;
    if (typeof lastLeg?.outputMintDecimals === 'number') {
      outDecimals = lastLeg.outputMintDecimals;
    } else if (outputMint) {
      const decs = await getDflowMintDecimals(outputMint);
      if (typeof decs === 'number') {
        outDecimals = decs;
      }
    }

    return NextResponse.json(
      {
        ...quote,
        outAmount,
        outDecimals,
      },
    );
  } catch (e) {
    console.error('[api/dflow/quote]', e);
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : 'Dflow quote error',
      },
      { status: 500 },
    );
  }
}

