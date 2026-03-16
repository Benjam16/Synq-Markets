'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, Zap } from 'lucide-react';
import BagsDetailPanel from '@/app/components/BagsDetailPanel';

type BagsTokenRow = {
  mint: string;
  name: string | null;
  symbol: string | null;
  imageUrl: string | null;
  priceUsd?: number;
  volume24hUsd?: number;
  liquidityUsd?: number;
  fdvUsd?: number;
  marketCapUsd?: number | null;
  priceChange24h?: number;
};

const formatUSD = (v: number | undefined | null) =>
  v == null || !Number.isFinite(v)
    ? '—'
    : v >= 1e9
      ? `$${(v / 1e9).toFixed(2)}B`
      : v >= 1e6
        ? `$${(v / 1e6).toFixed(2)}M`
        : v >= 1e3
          ? `$${(v / 1e3).toFixed(2)}K`
          : `$${v.toFixed(2)}`;

const formatPct = (v: number | undefined | null) =>
  v == null || !Number.isFinite(v) ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

export default function BagsPage() {
  const [tokens, setTokens] = useState<BagsTokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [selectedMint, setSelectedMint] = useState<string | null>(null);
  const [profileMap, setProfileMap] = useState<Record<string, { name?: string; symbol?: string; imageUrl?: string | null }>>({});

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/bags/tokens?limit=250', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Failed to load Bags tokens');
        if (!cancelled) setTokens(Array.isArray(json?.tokens) ? json.tokens : []);
      } catch (e: any) {
        if (!cancelled) {
          setTokens([]);
          setError(e?.message || 'Failed to load Bags tokens');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  // Lazy-hydrate token name/symbol/image via GeckoTerminal token info.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const missing = tokens
        .filter((t) => t.mint && !profileMap[t.mint])
        .slice(0, 30);
      if (!missing.length) return;

      await Promise.all(
        missing.map(async (t) => {
          try {
            const res = await fetch(`/api/stocks/profile?mint=${encodeURIComponent(t.mint)}`, { cache: 'no-store' });
            const json = await res.json();
            if (!res.ok) return;
            if (cancelled) return;
            setProfileMap((prev) => ({
              ...prev,
              [t.mint]: {
                name: json?.name ?? undefined,
                symbol: json?.symbol ?? undefined,
                imageUrl: json?.imageUrl ?? null,
              },
            }));
          } catch {}
        }),
      );
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [tokens, profileMap]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return tokens;
    return tokens.filter((t) => {
      const p = profileMap[t.mint];
      return (
        t.mint.toLowerCase().includes(qq) ||
        String(p?.symbol || t.symbol || '').toLowerCase().includes(qq) ||
        String(p?.name || t.name || '').toLowerCase().includes(qq)
      );
    });
  }, [tokens, q, profileMap]);

  return (
    <div className="min-h-screen bg-[#050505] text-white font-[family-name:var(--font-inter)]">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between gap-4 mb-2">
          <h1 className="text-xl font-bold">Bags</h1>
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by mint…"
              className="w-full pl-10 pr-3 py-2 rounded-xl bg-white/[0.03] border border-[#1A1A1A] text-sm text-white placeholder:text-slate-600 outline-none focus:border-[#4FFFC8]/40"
            />
          </div>
        </div>

        <div className="mb-4 text-[11px] text-slate-500">
          Showing **Bags tokens with trading volume in the last 24 hours** (sorted by 24h % move).
        </div>

        <div className="rounded-xl border border-[#1A1A1A] overflow-hidden bg-white/[0.02]">
          <div className="px-4 py-3 border-b border-[#1A1A1A] text-xs font-bold text-slate-500 uppercase tracking-wider">
            Bags Tokens
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-8 h-8 text-[#4FFFC8] animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-16 px-6 text-slate-500 text-sm">
              <div className="text-white font-semibold mb-2">Bags tokens failed to load</div>
              <div className="font-mono text-[11px] break-words max-w-3xl mx-auto">
                {error}
              </div>
              <div className="mt-4 text-[11px] text-slate-600">
                Ensure `BAGS_API_KEY` is set in `.env.local` and restart the dev server.
              </div>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.03] border border-[#1A1A1A] text-slate-300 hover:text-white hover:border-[#4FFFC8]/30 hover:bg-white/[0.05] transition-colors"
              >
                Reload
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-24 text-slate-500 text-sm">
              No Bags tokens found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px]">
                <thead>
                  <tr className="border-b border-[#1A1A1A] text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="text-left py-3 px-4">Token</th>
                    <th className="text-right py-3 px-4">Price / 24h</th>
                    <th className="text-right py-3 px-4">MCap / FDV</th>
                    <th className="text-right py-3 px-4">24h Vol</th>
                    <th className="text-right py-3 px-4">Liquidity</th>
                    <th className="text-left py-3 px-4">Mint</th>
                    <th className="text-right py-3 px-4 w-28"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 300).map((t) => {
                    const p = profileMap[t.mint];
                    const symbol = p?.symbol || t.symbol || '—';
                    const name = p?.name || t.name || 'Unknown token';
                    const img = p?.imageUrl || t.imageUrl || null;
                    const mcap = t.marketCapUsd ?? null;
                    const fdv = t.fdvUsd ?? undefined;
                    const pc24 = t.priceChange24h ?? undefined;
                    const pcClass =
                      typeof pc24 === 'number'
                        ? pc24 >= 0
                          ? 'text-[#4FFFC8]'
                          : 'text-red-400'
                        : 'text-slate-500';

                    return (
                    <tr
                      key={t.mint}
                      className="border-b border-[#1A1A1A]/50 hover:bg-white/[0.03] transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {img ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={img} alt="" className="w-7 h-7 rounded-full bg-white/5" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-white/[0.03] border border-[#1A1A1A]" />
                          )}
                          <div className="min-w-0">
                            <div className="font-mono font-semibold text-white text-xs">{symbol}</div>
                            <div className="text-xs text-slate-500 truncate max-w-[260px]">{name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="font-mono text-xs text-white">{formatUSD(t.priceUsd)}</div>
                        <div className={`font-mono text-xs ${pcClass}`}>{formatPct(pc24)}</div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="font-mono text-xs text-white">{formatUSD(mcap)}</div>
                        <div className="font-mono text-xs text-slate-500">{formatUSD(fdv)}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-slate-300">
                        {formatUSD(t.volume24hUsd)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-slate-300">
                        {formatUSD(t.liquidityUsd)}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {t.mint}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedMint(t.mint)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4FFFC8]/20 border border-[#4FFFC8]/30 text-[#4FFFC8] text-xs font-bold hover:bg-[#4FFFC8]/30 transition-colors"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          Trade
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selectedMint ? (
        <BagsDetailPanel mint={selectedMint} onClose={() => setSelectedMint(null)} />
      ) : null}
    </div>
  );
}

