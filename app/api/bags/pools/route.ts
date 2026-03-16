import { NextResponse } from 'next/server';
import { getBagsPools } from '@/lib/bags';

export const runtime = 'nodejs';

function normalizeBagsMint(raw: string): string {
  const s = String(raw || '').trim();
  // Some datasets append a ".BAGS" suffix for display — strip ONLY the dotted suffix.
  // Do not strip plain "BAGS" because many real Bags mints legitimately end with "BAGS".
  return s.replace(/\.BAGS$/i, '');
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const onlyMigrated = searchParams.get('onlyMigrated') === 'true';
    const pools = await getBagsPools(onlyMigrated);
    const normalized = pools.map((p) => ({
      ...p,
      tokenMint: normalizeBagsMint(p.tokenMint),
    }));
    return NextResponse.json({ pools: normalized }, { status: 200 });
  } catch (e) {
    console.error('[api/bags/pools]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Bags pools error' },
      { status: 500 },
    );
  }
}

