import { NextRequest, NextResponse } from 'next/server';
import { listEvents } from '@/lib/jup-prediction';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const category = sp.get('category') || undefined;
    const filter = sp.get('filter') || undefined;
    const includeMarkets = sp.get('includeMarkets') || undefined;
    const provider = sp.get('provider') || undefined;
    const start = sp.get('start') || undefined;
    const end = sp.get('end') || undefined;

    const data = await listEvents({
      category,
      filter,
      provider,
      includeMarkets: includeMarkets === 'true',
      start: start ? Number(start) : undefined,
      end: end ? Number(end) : undefined,
    });

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to fetch Jupiter prediction events' },
      { status: 500 }
    );
  }
}

