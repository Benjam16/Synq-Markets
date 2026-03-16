import { NextRequest, NextResponse } from 'next/server';
import { STOCK_DIRECTORY } from '@/lib/stocks-directory';

const GT_BASE = 'https://api.geckoterminal.com/api/v2';
const GT_ACCEPT = 'application/json;version=20230203';

type GeckoTokenInfo = {
  data?: {
    attributes?: {
      description?: string | null;
      websites?: string[];
      twitter_handle?: string | null;
      discord_url?: string | null;
      telegram_handle?: string | null;
      image_url?: string | null;
      name?: string;
      symbol?: string;
    };
  };
};

/**
 * GET /api/stocks/profile?mint=<spl_mint>&symbol=OPENAI
 * Returns description + official links inside Synq (no Jupiter deep links).
 */
export async function GET(req: NextRequest) {
  try {
    const mint = req.nextUrl.searchParams.get('mint');
    const symbol = req.nextUrl.searchParams.get('symbol') || undefined;
    if (!mint) {
      return NextResponse.json({ error: 'mint required' }, { status: 400 });
    }

    const override =
      STOCK_DIRECTORY.find((e) => e.mint === mint) ||
      (symbol ? STOCK_DIRECTORY.find((e) => e.symbol === symbol) : undefined);

    const infoRes = await fetch(
      `${GT_BASE}/networks/solana/tokens/${encodeURIComponent(mint)}/info`,
      {
        cache: 'no-store',
        headers: { Accept: GT_ACCEPT },
      }
    );
    const infoJson = (await infoRes.json()) as GeckoTokenInfo;

    const a = infoJson?.data?.attributes;
    const websites = (override?.websites?.length ? override.websites : a?.websites) || [];
    const description = override?.description ?? a?.description ?? null;

    return NextResponse.json({
      mint,
      symbol: override?.symbol ?? symbol ?? a?.symbol ?? null,
      name: a?.name ?? null,
      description,
      websites,
      socials: {
        twitter: override?.twitter ?? a?.twitter_handle ?? null,
        discord: override?.discord ?? a?.discord_url ?? null,
        telegram: override?.telegram ?? a?.telegram_handle ?? null,
      },
      imageUrl: a?.image_url ?? null,
      source: 'geckoterminal',
    });
  } catch (e) {
    console.error('[api/stocks/profile]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Profile error' },
      { status: 500 }
    );
  }
}

