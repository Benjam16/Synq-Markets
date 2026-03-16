'use client';

import { useEffect, useMemo, useState } from 'react';
import { Copy, Check } from 'lucide-react';

type TradeRow = {
  id: string;
  time: string;
  side: 'buy' | 'sell';
  priceUsd: number;
  volumeUsd: number;
  tokenAmount: number;
  maker: string;
  txHash: string;
};

const fmtUsd = (n: number) =>
  !Number.isFinite(n) || n <= 0
    ? '—'
    : n >= 1e9
      ? `$${(n / 1e9).toFixed(2)}B`
      : n >= 1e6
        ? `$${(n / 1e6).toFixed(2)}M`
        : n >= 1e3
          ? `$${(n / 1e3).toFixed(2)}K`
          : `$${n.toFixed(2)}`;

const short = (s: string, n = 4) =>
  s && s.length > n * 2 + 2 ? `${s.slice(0, n)}…${s.slice(-n)}` : s || '—';

function relTime(iso: string) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export default function StockTradesTable({
  mint,
  symbol,
}: {
  mint: string;
  symbol: string;
}) {
  const [rows, setRows] = useState<TradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  // Hydrate from localStorage so we can show the last known trades
  // on reload instead of an empty table while the API warms up.
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const key = `rwa:trades:${mint}`;
      const raw = window.localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw) as TradeRow[];
      if (Array.isArray(parsed) && parsed.length) {
        setRows(parsed);
        setLoading(false);
      }
    } catch {
      // ignore localStorage errors
    }
  }, [mint]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/stocks/trades?mint=${encodeURIComponent(mint)}&limit=50`,
          { cache: 'no-store' }
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Failed to load trades');
        const t = Array.isArray(json?.trades) ? (json.trades as TradeRow[]) : [];
        if (!cancelled) {
          setRows((prev) => {
            const next = t.length ? t : prev;
            try {
              if (typeof window !== 'undefined' && next.length) {
                const key = `rwa:trades:${mint}`;
                window.localStorage.setItem(key, JSON.stringify(next));
              }
            } catch {
              // ignore localStorage errors
            }
            return next;
          });
        }
      } catch {
        // Keep the last good trades on transient upstream gaps/rate limits.
        if (!cancelled) setRows((prev) => prev);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    // GeckoTerminal public API is ~10 req/min; poll modestly to avoid throttling.
    const t = setInterval(run, 20000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [mint]);

  const empty = !loading && rows.length === 0;

  const header = useMemo(
    () => [
      { key: 'age', label: 'Age' },
      { key: 'type', label: 'Type' },
      { key: 'price', label: 'Price' },
      { key: 'volume', label: 'Volume' },
      { key: 'amount', label: symbol },
      { key: 'trader', label: 'Trader' },
      { key: 'tx', label: 'Tx' },
    ],
    [symbol]
  );

  return (
    <div className="max-h-[260px] overflow-y-auto">
      <div className="grid grid-cols-12 gap-3 px-4 py-2 bg-white/[0.02] text-[9px] font-bold text-slate-500 uppercase tracking-wider border-b border-[#1A1A1A]">
        <div className="col-span-1">{header[0].label}</div>
        <div className="col-span-1">{header[1].label}</div>
        <div className="col-span-2 text-right">{header[2].label}</div>
        <div className="col-span-2 text-right">{header[3].label}</div>
        <div className="col-span-2 text-right">{header[4].label}</div>
        <div className="col-span-2 text-right">{header[5].label}</div>
        <div className="col-span-2 text-right">{header[6].label}</div>
      </div>

      {loading ? (
        <div className="py-10 text-center text-slate-500 text-sm">Loading trades…</div>
      ) : empty ? (
        <div className="py-10 text-center text-slate-500 text-sm">No recent trades found</div>
      ) : (
        rows.map((r) => {
          const sideClass = r.side === 'buy' ? 'text-[#4FFFC8]' : 'text-red-400';
          return (
            <div
              key={r.id}
              className="grid grid-cols-12 gap-3 px-4 py-2 border-b border-[#1A1A1A]/50 hover:bg-white/[0.02] transition-colors text-xs"
            >
              <div className="col-span-1 text-slate-500 font-mono">{relTime(r.time)}</div>
              <div className={`col-span-1 font-mono ${sideClass}`}>{r.side.toUpperCase()}</div>
              <div className="col-span-2 text-right font-mono text-white">
                {r.priceUsd ? `$${r.priceUsd.toFixed(4)}` : '—'}
              </div>
              <div className="col-span-2 text-right font-mono text-slate-300">{fmtUsd(r.volumeUsd)}</div>
              <div className="col-span-2 text-right font-mono text-slate-300">
                {Number.isFinite(r.tokenAmount) && r.tokenAmount > 0 ? r.tokenAmount.toFixed(4) : '—'}
              </div>
              <div className="col-span-2 text-right font-mono text-slate-400">{short(r.maker)}</div>
              <div className="col-span-2 text-right">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(r.txHash);
                      setCopied(r.id);
                      setTimeout(() => setCopied(null), 900);
                    } catch {}
                  }}
                  className="inline-flex items-center justify-end gap-1.5 font-mono text-slate-400 hover:text-white transition-colors"
                  title="Copy transaction signature"
                >
                  {copied === r.id ? (
                    <Check className="w-3.5 h-3.5 text-[#4FFFC8]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {short(r.txHash, 3)}
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

