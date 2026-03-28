import { NextRequest, NextResponse } from 'next/server';
import { jupiterQuoteV6 } from '@/lib/jup-swap';
import { getDflowMintDecimals } from '@/lib/dflow-tokens';
import { parseUiAmountToScaledInt } from '@/lib/dflow-amount';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const inputMint = req.nextUrl.searchParams.get('inputMint');
    const outputMint = req.nextUrl.searchParams.get('outputMint');
    const uiAmountStr = req.nextUrl.searchParams.get('uiAmount');
    const slippageBpsRaw = req.nextUrl.searchParams.get('slippageBps');

    if (!inputMint || !outputMint) {
      return NextResponse.json(
        { error: 'inputMint and outputMint required' },
        { status: 400 },
      );
    }
    if (!uiAmountStr) {
      return NextResponse.json({ error: 'uiAmount required' }, { status: 400 });
    }

    const decs = await getDflowMintDecimals(inputMint);
    if (decs == null) {
      return NextResponse.json(
        { error: `No decimals found for mint ${inputMint}` },
        { status: 400 },
      );
    }

    const scaled = parseUiAmountToScaledInt(uiAmountStr, decs);
    const finalAmountStr = scaled.toString();
    const finalAmountNum = Number(finalAmountStr);
    if (
      !Number.isFinite(finalAmountNum) ||
      !Number.isSafeInteger(finalAmountNum) ||
      finalAmountNum <= 0
    ) {
      return NextResponse.json(
        { error: 'amount is too large or invalid; try a smaller uiAmount.' },
        { status: 400 },
      );
    }

    const slippageBps =
      slippageBpsRaw != null && slippageBpsRaw !== ''
        ? Math.min(5000, Math.max(1, Number(slippageBpsRaw)))
        : 100;

    const quoteResponse = await jupiterQuoteV6({
      inputMint,
      outputMint,
      amount: finalAmountStr,
      slippageBps: Number.isFinite(slippageBps) ? slippageBps : 100,
    });

    const outDecimals = await getDflowMintDecimals(outputMint);
    const outAmountRaw = quoteResponse?.outAmount;
    const outAmount =
      typeof outAmountRaw === 'string'
        ? outAmountRaw
        : typeof outAmountRaw === 'number'
          ? String(outAmountRaw)
          : undefined;

    return NextResponse.json(
      {
        quoteResponse,
        outAmount,
        outDecimals: outDecimals ?? undefined,
      },
      { status: 200 },
    );
  } catch (e) {
    console.error('[api/pump/quote]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Pump quote error' },
      { status: 500 },
    );
  }
}
