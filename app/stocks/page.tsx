'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Star,
  Zap,
  BarChart3,
  ChevronDown,
  Check,
  Loader2,
} from 'lucide-react';
import type { JupStockDetail } from '@/lib/jup-stocks';
import RwaDetailPanel from '../components/RwaDetailPanel';

const formatUSD = (v: number | undefined) =>
  v == null
    ? '—'
    : v >= 1e9
      ? `$${(v / 1e9).toFixed(2)}B`
      : v >= 1e6
        ? `$${(v / 1e6).toFixed(2)}M`
        : v >= 1e3
          ? `$${(v / 1e3).toFixed(2)}K`
          : `$${Number(v).toFixed(2)}`;

// Tokens V2 + Price APIs return percent points (e.g. 1.23 = 1.23%), not fractions.
const formatPct = (v: number | undefined) =>
  v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

const formatHolders = (v: number | undefined) =>
  v == null ? '—' : v >= 1e3 ? `${(v / 1e3).toFixed(2)}K` : String(v);

type TimeFilter = '5m' | '1h' | '6h' | '24h';

export default function StocksPage() {
  const [stocks, setStocks] = useState<JupStockDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('24h');
  const [selectedStock, setSelectedStock] = useState<JupStockDetail | null>(null);

  useEffect(() => {
    const fetchStocks = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/stocks/dflow', { cache: 'no-store' });
        const data = await res.json();
        if (Array.isArray(data?.stocks)) setStocks(data.stocks);
      } catch {
        setStocks([]);
      } finally {
        setLoading(false);
      }
    };
    fetchStocks();
    const t = setInterval(fetchStocks, 60000);
    return () => clearInterval(t);
  }, []);

  // Every 5 minutes, pre-warm GeckoTerminal candles + trades for all
  // stocks currently on the page so their detail views are never blank
  // by default when first opened.
  useEffect(() => {
    if (!stocks.length) return;
    let cancelled = false;

    const prewarmGecko = async () => {
      if (cancelled) return;
      const mints = Array.from(
        new Set(
          stocks
            .map((s) => s.mint)
            .filter((m): m is string => typeof m === 'string' && m.length > 0),
        ),
      );

      for (const mint of mints) {
        if (cancelled) break;
        try {
          // Chart candles
          await fetch(
            `/api/stocks/candles?mint=${encodeURIComponent(mint)}&tf=15m&limit=220`,
            { cache: 'no-store' },
          );
        } catch {
          // ignore; server route will serve stale cache next time if available
        }

        if (cancelled) break;

        try {
          // Recent trades
          await fetch(
            `/api/stocks/trades?mint=${encodeURIComponent(mint)}&limit=50`,
            { cache: 'no-store' },
          );
        } catch {
          // ignore
        }
      }
    };

    // Run once when stocks load, then every 5 minutes.
    prewarmGecko();
    const id = setInterval(prewarmGecko, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [stocks]);

  const aggregates = useMemo(() => {
    let totalVolume = 0;
    let totalTraders = 0;
    let totalLiquidity = 0;
    for (const s of stocks) {
      totalVolume += s.stats?.volume24h ?? 0;
      totalTraders += s.stats?.traders24h ?? 0;
      totalLiquidity += s.stats?.liquidity ?? 0;
    }
    return {
      volume24h: totalVolume,
      traders24h: totalTraders,
      liquidity: totalLiquidity,
      tokenCount: stocks.length,
    };
  }, [stocks]);

  const priceChangeForTime = (s: JupStockDetail): number | undefined => {
    const st = s.stats;
    if (!st) return undefined;
    switch (timeFilter) {
      case '5m':
        return st.priceChange5m;
      case '1h':
        return st.priceChange1h;
      case '6h':
        return st.priceChange6h;
      case '24h':
      default:
        return st.priceChange24h;
    }
  };

  const sortedStocks = useMemo(() => {
    const change = priceChangeForTime;
    return [...stocks].sort((a, b) => {
      const ca = change(a) ?? -Infinity;
      const cb = change(b) ?? -Infinity;
      return cb - ca;
    });
  }, [stocks, timeFilter]);

  return (
    <div className="min-h-screen bg-[#050505] text-white font-[family-name:var(--font-inter)]">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              RWAs Screener
              <ChevronDown className="w-5 h-5 text-slate-500" />
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {(['5m', '1h', '6h', '24h'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeFilter(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  timeFilter === t
                    ? 'bg-[#4FFFC8]/20 text-[#4FFFC8] border border-[#4FFFC8]/30'
                    : 'bg-white/[0.03] text-slate-500 border border-[#1A1A1A] hover:text-white hover:border-slate-600'
                }`}
              >
                {t}
              </button>
            ))}
            <span className="flex items-center gap-1 text-slate-500 text-xs ml-2">
              <Zap className="w-3.5 h-3.5" />
              0.01
            </span>
          </div>
        </div>

        {/* Overview cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="rounded-xl border border-[#1A1A1A] bg-white/[0.02] p-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              24h Volume
            </p>
            <p className="text-lg font-mono font-bold text-white">
              {formatUSD(aggregates.volume24h)}
            </p>
          </div>
          <div className="rounded-xl border border-[#1A1A1A] bg-white/[0.02] p-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              24h Traders
            </p>
            <p className="text-lg font-mono font-bold text-white">
              {aggregates.traders24h > 0
                ? aggregates.traders24h.toLocaleString()
                : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-[#1A1A1A] bg-white/[0.02] p-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Total Liquidity
            </p>
            <p className="text-lg font-mono font-bold text-white">
              {formatUSD(aggregates.liquidity)}
            </p>
          </div>
          <div className="rounded-xl border border-[#1A1A1A] bg-white/[0.02] p-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Tokens
            </p>
            <p className="text-lg font-mono font-bold text-white">
              {aggregates.tokenCount}
            </p>
          </div>
        </div>

        {/* Top Performers table */}
        <div className="rounded-xl border border-[#1A1A1A] overflow-hidden bg-white/[0.02]">
          <div className="px-4 py-3 border-b border-[#1A1A1A]">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Top Performers
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-8 h-8 text-[#4FFFC8] animate-spin" />
            </div>
          ) : sortedStocks.length === 0 ? (
            <div className="text-center py-24 text-slate-500 text-sm">
              <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No stocks loaded from Dflow yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-[#1A1A1A] text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="text-left py-3 px-4">Token</th>
                    <th className="text-right py-3 px-4">Price / %Δ</th>
                    <th className="text-right py-3 px-4">Discount / Mark</th>
                    <th className="text-right py-3 px-4">SMC / MC</th>
                    <th className="text-right py-3 px-4">24h Vol / Net</th>
                    <th className="text-right py-3 px-4">Liquidity</th>
                    <th className="text-right py-3 px-4">Holders / %Δ</th>
                    <th className="text-right py-3 px-4 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStocks.map((s) => {
                    const pct = priceChangeForTime(s);
                    const pctNum = pct != null ? pct : null;
                    const isPositive = pctNum != null && pctNum >= 0;
                    return (
                      <tr
                        key={s.symbol + s.mint}
                        onClick={() => setSelectedStock(s)}
                        className="border-b border-[#1A1A1A]/50 hover:bg-white/[0.03] transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 rounded hover:bg-white/10 text-slate-500 hover:text-[#4FFFC8]"
                            >
                              <Star className="w-4 h-4" />
                            </button>
                            {s.icon ? (
                              <img
                                src={s.icon}
                                alt=""
                                className="w-8 h-8 rounded-full bg-white/5"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-[#4FFFC8]/20 flex items-center justify-center">
                                <BarChart3 className="w-4 h-4 text-[#4FFFC8]" />
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-semibold text-white">
                                  {s.symbol}
                                </span>
                                <Check className="w-3.5 h-3.5 text-[#4FFFC8]" />
                              </div>
                              <span className="text-xs text-slate-500 block truncate max-w-[140px]">
                                {s.name}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="text-right py-3 px-4">
                          <div className="font-mono text-white">
                            {s.price
                              ? `$${s.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : '—'}
                          </div>
                          <div
                            className={`font-mono text-xs ${
                              pctNum == null
                                ? 'text-slate-500'
                                : isPositive
                                  ? 'text-[#4FFFC8]'
                                  : 'text-red-400'
                            }`}
                          >
                            {pctNum != null
                              ? `${isPositive ? '+' : ''}${pctNum.toFixed(2)}%`
                              : '—'}
                          </div>
                        </td>
                        <td className="text-right py-3 px-4">
                          <div
                            className={`font-mono text-xs ${
                              (s.discount ?? 0) < 0 ? 'text-red-400' : 'text-slate-300'
                            }`}
                          >
                            {s.discount != null ? `${s.discount.toFixed(2)}%` : '—'}
                          </div>
                          <div className="font-mono text-xs text-slate-500">
                            {s.markPrice != null
                              ? `$${s.markPrice.toFixed(2)}`
                              : '—'}
                          </div>
                        </td>
                        <td className="text-right py-3 px-4">
                          <div className="font-mono text-white text-xs">
                            {formatUSD(s.stockMc ?? s.stats?.mcap)}
                          </div>
                          <div className="font-mono text-xs text-slate-500">
                            {formatUSD(s.mc ?? s.stats?.mcap)}
                          </div>
                        </td>
                        <td className="text-right py-3 px-4">
                          <div className="font-mono text-white text-xs">
                            {formatUSD(s.stats?.volume24h)}
                          </div>
                          <div
                            className={`font-mono text-xs ${
                              (s.stats?.netVol24h ?? 0) >= 0
                                ? 'text-[#4FFFC8]'
                                : 'text-red-400'
                            }`}
                          >
                            {formatUSD(s.stats?.netVol24h)}
                          </div>
                        </td>
                        <td className="text-right py-3 px-4">
                          <span className="font-mono text-white text-xs">
                            {formatUSD(s.stats?.liquidity)}
                          </span>
                        </td>
                        <td className="text-right py-3 px-4">
                          <div className="font-mono text-white text-xs">
                            {formatHolders(s.stats?.holders)}
                          </div>
                          <div
                            className={`font-mono text-xs ${
                              (s.stats?.holdersDeltaPct ?? 0) >= 0
                                ? 'text-[#4FFFC8]'
                                : 'text-red-400'
                            }`}
                          >
                            {s.stats?.holdersDeltaPct != null
                              ? `${s.stats.holdersDeltaPct >= 0 ? '+' : ''}${(s.stats.holdersDeltaPct * 100).toFixed(2)}%`
                              : '—'}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStock(s);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4FFFC8]/20 border border-[#4FFFC8]/30 text-[#4FFFC8] text-xs font-bold hover:bg-[#4FFFC8]/30 transition-colors"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            Buy
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

        <p className="text-xs text-slate-500 mt-4 text-right">
          Data from Dflow + onchain pools. Click a row or Buy to open full detail and trade.
        </p>
      </div>

      <AnimatePresence>
        {selectedStock && (
          <RwaDetailPanel
            stock={selectedStock}
            onClose={() => setSelectedStock(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
