import { NextRequest, NextResponse } from 'next/server';
import { getBagsTradeQuote } from '@/lib/bags';
import { getDflowMintDecimals } from '@/lib/dflow-tokens';
import { parseUiAmountToScaledInt } from '@/lib/dflow-amount';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const inputMint = req.nextUrl.searchParams.get('inputMint');
    const outputMint = req.nextUrl.searchParams.get('outputMint');
    const uiAmountStr = req.nextUrl.searchParams.get('uiAmount');
    const amountStr = req.nextUrl.searchParams.get('amount'); // legacy, already scaled
    const slippageMode = (req.nextUrl.searchParams.get('slippageMode') || 'auto') as
      | 'auto'
      | 'manual';
    const slippageBpsRaw = req.nextUrl.searchParams.get('slippageBps');

    if (!inputMint || !outputMint) {
      return NextResponse.json(
        { error: 'inputMint and outputMint required' },
        { status: 400 },
      );
    }

    let finalAmountStr = amountStr;
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
          { error: `No decimals found for mint ${inputMint}` },
          { status: 400 },
        );
      }
      const scaled = parseUiAmountToScaledInt(uiAmountStr, decs);
      finalAmountStr = scaled.toString();
    }

    const finalAmountNum = Number(finalAmountStr);
    if (!Number.isFinite(finalAmountNum) || !Number.isSafeInteger(finalAmountNum) || finalAmountNum <= 0) {
      return NextResponse.json(
        {
          error:
            'amount is too large or invalid for Bags quote. Provide a smaller uiAmount.',
        },
        { status: 400 },
      );
    }

    const slippageBps =
      slippageMode === 'manual' && slippageBpsRaw != null
        ? Number(slippageBpsRaw)
        : undefined;

    const quote = await getBagsTradeQuote({
      inputMint,
      outputMint,
      amount: finalAmountNum,
      slippageMode,
      slippageBps,
    });

    const outAmount = quote?.outAmount;
    const routePlan = Array.isArray(quote?.routePlan) ? quote.routePlan : [];
    const lastLeg = routePlan.length ? routePlan[routePlan.length - 1] : undefined;
    const outDecimals =
      typeof lastLeg?.outputMintDecimals === 'number'
        ? lastLeg.outputMintDecimals
        : undefined;

    return NextResponse.json({ ...quote, outAmount, outDecimals }, { status: 200 });
  } catch (e) {
    console.error('[api/bags/quote]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Bags quote error' },
      { status: 500 },
    );
  }
}

