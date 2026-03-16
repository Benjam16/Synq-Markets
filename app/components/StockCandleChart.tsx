'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createChart, ColorType, CandlestickSeries } from 'lightweight-charts';
import type { IChartApi } from 'lightweight-charts';

type Tf = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

interface Candle {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export default function StockCandleChart({
  mint,
  tf = '15m',
  height = 260,
}: {
  mint: string;
  tf?: Tf;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<any>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const palette = useMemo(
    () => ({
      bg: '#050505',
      grid: 'rgba(255,255,255,0.05)',
      text: 'rgba(148,163,184,0.9)',
      up: '#4FFFC8',
      down: '#ef4444',
    }),
    []
  );

  // Hydrate from localStorage so we can show the last known chart
  // immediately on reload, even before the first API call finishes.
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const key = `rwa:candles:${mint}:${tf}`;
      const raw = window.localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Candle[];
      if (Array.isArray(parsed) && parsed.length) {
        setCandles(parsed);
        setLoading(false);
      }
    } catch {
      // ignore localStorage errors
    }
  }, [mint, tf]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/stocks/candles?mint=${encodeURIComponent(mint)}&tf=${encodeURIComponent(
            tf
          )}&limit=220`,
          { cache: 'no-store' }
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Failed to load candles');
        const c = Array.isArray(json?.candles) ? json.candles : [];
        // Don't blow away the chart on transient upstream gaps,
        // but do allow the first load to show an empty state.
        if (!cancelled) {
          setCandles((prev) => {
            const next = c.length ? c : prev.length ? prev : [];
            try {
              if (typeof window !== 'undefined' && next.length) {
                const key = `rwa:candles:${mint}:${tf}`;
                window.localStorage.setItem(key, JSON.stringify(next));
              }
            } catch {
              // ignore localStorage errors
            }
            return next;
          });
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Chart unavailable');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [mint, tf]);

  useEffect(() => {
    if (!containerRef.current) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: palette.text,
      },
      grid: {
        vertLines: { color: palette.grid },
        horzLines: { color: palette.grid },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.08)',
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: 'rgba(79,255,200,0.25)' },
        horzLine: { color: 'rgba(79,255,200,0.25)' },
      },
      height,
      width: containerRef.current.clientWidth,
      handleScroll: true,
      handleScale: true,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: palette.up,
      downColor: palette.down,
      borderUpColor: palette.up,
      borderDownColor: palette.down,
      wickUpColor: palette.up,
      wickDownColor: palette.down,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => {
      if (!containerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, [palette, height]);

  useEffect(() => {
    if (!seriesRef.current) return;
    if (!candles.length) {
      seriesRef.current.setData([]);
      return;
    }
    // GeckoTerminal can return latest-first; lightweight-charts requires time-ascending order.
    // It also sometimes returns duplicate timestamps; lightweight-charts requires strictly increasing times.
    const byTime = new Map<number, Candle>();
    for (const c of candles) {
      if (!Number.isFinite(c.time)) continue;
      // Keep the latest candle for each timestamp (last write wins).
      byTime.set(c.time, c);
    }

    const data = [...byTime.values()]
      .sort((a, b) => a.time - b.time)
      .map((c) => ({
        time: c.time as any,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
    seriesRef.current.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  return (
    <div className="relative w-full" style={{ height }}>
      <div ref={containerRef} className="absolute inset-0" />
      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">
          Loading chart…
        </div>
      ) : error ? (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">
          {error}
        </div>
      ) : !candles.length ? (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">
          No chart data yet
        </div>
      ) : null}
    </div>
  );
}

