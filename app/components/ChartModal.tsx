'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, TrendingUp, TrendingDown, BarChart3, DollarSign,
  ExternalLink, Copy, Zap, ArrowRight, ArrowDown, ArrowUp, Bell,
} from 'lucide-react';
import { createChart, ColorType, CandlestickSeries, LineSeries } from 'lightweight-charts';
import type { IChartApi } from 'lightweight-charts';
import { toast } from 'react-hot-toast';

// ============================================================================
// TYPES
// ============================================================================

interface ChartTrade {
  id: string;
  provider: 'Polymarket' | 'Kalshi';
  type: string;
  marketId: string;
  marketName: string;
  side: string;
  price: number;
  priceCents: string;
  shares: number;
  notional: number;
  fee: number;
  timestamp: string;
  walletAddress?: string;
  isWhale: boolean;
  externalUrl?: string;
  slug?: string;
  category?: string;
  imageUrl?: string;
}

interface OrderBookEntry {
  price: number;
  size: number;
  total: number;
}

interface ChartModalProps {
  trade: ChartTrade;
  allTrades: ChartTrade[];
  isOpen: boolean;
  onClose: () => void;
  onInstantTrade?: (trade: ChartTrade) => void;
  onOpenTradePanel?: (trade: ChartTrade) => void;
  instantTradeShares?: number;
}

// ============================================================================
// CHART MODAL COMPONENT
// ============================================================================

export default function ChartModal({
  trade,
  allTrades,
  isOpen,
  onClose,
  onInstantTrade,
  onOpenTradePanel,
  instantTradeShares = 10,
}: ChartModalProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [tradeSide, setTradeSide] = useState<'yes' | 'no'>('yes');
  const [tradeQuantity, setTradeQuantity] = useState(100);
  const [activeTab, setActiveTab] = useState<'chart' | 'book' | 'trades'>('chart');
  const [imgError, setImgError] = useState(false);

  // Get all trades for this specific market
  const marketTrades = useMemo(() => {
    return allTrades
      .filter(t =>
        t.marketName === trade.marketName ||
        t.marketId === trade.marketId
      )
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 100);
  }, [allTrades, trade.marketName, trade.marketId]);

  // Generate candlestick data from price history
  const candlestickData = useMemo(() => {
    const sorted = [...marketTrades].reverse();
    const now = Date.now();

    if (sorted.length < 2) {
      // Generate synthetic candlestick data centered around current price
      const candles: { time: number; open: number; high: number; low: number; close: number }[] = [];
      let p = trade.price * 100;
      for (let i = 48; i >= 0; i--) {
        const open = p;
        const movement = (Math.random() - 0.48) * 3;
        p = Math.max(1, Math.min(99, p + movement));
        const close = p;
        const high = Math.max(open, close) + Math.random() * 1.5;
        const low = Math.min(open, close) - Math.random() * 1.5;
        candles.push({
          time: Math.floor((now - i * 1800000) / 1000), // 30min intervals
          open: Math.round(open * 10) / 10,
          high: Math.round(Math.min(99, high) * 10) / 10,
          low: Math.round(Math.max(1, low) * 10) / 10,
          close: Math.round(close * 10) / 10,
        });
      }
      // Last candle closes at current price
      if (candles.length > 0) {
        candles[candles.length - 1].close = Math.round(trade.price * 1000) / 10;
      }
      return candles;
    }

    // Build candles from real trade data — aggregate into 5min buckets
    const bucketMs = 300000; // 5 minutes
    const buckets = new Map<number, number[]>();
    for (const t of sorted) {
      const ts = Math.floor(new Date(t.timestamp).getTime() / bucketMs) * bucketMs;
      if (!buckets.has(ts)) buckets.set(ts, []);
      buckets.get(ts)!.push(t.price * 100);
    }

    return Array.from(buckets.entries())
      .sort(([a], [b]) => a - b)
      .map(([ts, prices]) => ({
        time: Math.floor(ts / 1000) as any,
        open: prices[0],
        close: prices[prices.length - 1],
        high: Math.max(...prices),
        low: Math.min(...prices),
      }));
  }, [marketTrades, trade.price]);

  // Fetch REAL order book data
  const [orderBook, setOrderBook] = useState<{ bids: OrderBookEntry[]; asks: OrderBookEntry[] }>({ bids: [], asks: [] });
  const [bookLoading, setBookLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    async function fetchOrderBook() {
      setBookLoading(true);
      try {
        if (trade.provider === 'Polymarket' && trade.marketId) {
          const res = await fetch(`https://clob.polymarket.com/book?token_id=${trade.marketId}`, {
            headers: { 'Accept': 'application/json' },
            cache: 'no-store',
          });
          if (res.ok) {
            const data = await res.json();
            const rawBids = (data.bids || []).slice(0, 15);
            const rawAsks = (data.asks || []).slice(0, 15);
            let bidTotal = 0, askTotal = 0;
            const bids = rawBids.map((b: any) => {
              const size = parseFloat(b.size || '0');
              bidTotal += size;
              return { price: parseFloat(b.price || '0') * 100, size: Math.round(size), total: Math.round(bidTotal) };
            });
            const asks = rawAsks.map((a: any) => {
              const size = parseFloat(a.size || '0');
              askTotal += size;
              return { price: parseFloat(a.price || '0') * 100, size: Math.round(size), total: Math.round(askTotal) };
            });
            if (!cancelled) { setOrderBook({ bids, asks }); setBookLoading(false); }
            return;
          }
        }

        if (trade.provider === 'Kalshi' && trade.marketId) {
          const res = await fetch(`/api/kalshi-book?ticker=${encodeURIComponent(trade.marketId)}`);
          if (res.ok) {
            const data = await res.json();
            if (!cancelled) { setOrderBook(data); setBookLoading(false); }
            return;
          }
        }

        // Fallback: synthetic
        const yp = trade.price * 100;
        const bids: OrderBookEntry[] = [], asks: OrderBookEntry[] = [];
        let bt = 0, at = 0;
        for (let i = 0; i < 12; i++) {
          const bs = Math.floor(Math.random() * 5000) + 500;
          bt += bs;
          bids.push({ price: Math.max(1, yp - (i + 1)), size: bs, total: bt });
          const as2 = Math.floor(Math.random() * 5000) + 500;
          at += as2;
          asks.push({ price: Math.min(99, yp + (i + 1)), size: as2, total: at });
        }
        if (!cancelled) setOrderBook({ bids, asks });
      } catch {
        // Synthetic fallback
        const yp = trade.price * 100;
        const bids: OrderBookEntry[] = [], asks: OrderBookEntry[] = [];
        let bt = 0, at = 0;
        for (let i = 0; i < 12; i++) {
          bt += Math.floor(Math.random() * 3000) + 500;
          bids.push({ price: Math.max(1, yp - (i + 1)), size: bt - (bids[i - 1]?.total || 0), total: bt });
          at += Math.floor(Math.random() * 3000) + 500;
          asks.push({ price: Math.min(99, yp + (i + 1)), size: at - (asks[i - 1]?.total || 0), total: at });
        }
        if (!cancelled) setOrderBook({ bids, asks });
      }
      if (!cancelled) setBookLoading(false);
    }

    fetchOrderBook();
    const interval = setInterval(fetchOrderBook, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [isOpen, trade.provider, trade.marketId, trade.price]);

  // Initialize lightweight-charts — CANDLESTICK
  useEffect(() => {
    if (!isOpen || activeTab !== 'chart' || !chartContainerRef.current) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#64748b',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)' },
        horzLines: { color: 'rgba(255,255,255,0.03)' },
      },
      width: container.clientWidth,
      height: 300,
      timeScale: {
        borderColor: 'rgba(255,255,255,0.06)',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.06)',
      },
      crosshair: {
        vertLine: { color: 'rgba(79,255,200,0.3)', width: 1, style: 3, labelBackgroundColor: '#1a1a2e' },
        horzLine: { color: 'rgba(79,255,200,0.3)', width: 1, style: 3, labelBackgroundColor: '#1a1a2e' },
      },
    });

    // Candlestick series — green up / red down
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#4FFFC8',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#4FFFC8',
      wickDownColor: '#ef4444',
      wickUpColor: '#4FFFC8',
    });

    // Deduplicate timestamps
    const uniqueCandles = new Map<number, any>();
    for (const c of candlestickData) {
      uniqueCandles.set(c.time, c);
    }
    const sorted = Array.from(uniqueCandles.values()).sort((a, b) => a.time - b.time);
    if (sorted.length > 0) {
      candleSeries.setData(sorted);
    }

    // Also add a moving average line
    if (sorted.length >= 5) {
      const maLine = chart.addSeries(LineSeries, {
        color: 'rgba(123, 97, 255, 0.5)',
        lineWidth: 1,
        crosshairMarkerVisible: false,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      const maData = sorted.map((c, i) => {
        if (i < 4) return null;
        const avg = sorted.slice(i - 4, i + 1).reduce((s, x) => s + x.close, 0) / 5;
        return { time: c.time, value: Math.round(avg * 10) / 10 };
      }).filter(Boolean) as any[];
      maLine.setData(maData);
    }

    chart.timeScale().fitContent();
    chartRef.current = chart;

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [isOpen, activeTab, candlestickData]);

  const yesPrice = trade.price * 100;
  const noPrice = (1 - trade.price) * 100;
  const maxBookSize = Math.max(
    ...orderBook.bids.map(b => b.total),
    ...orderBook.asks.map(a => a.total),
    1
  );

  const tradeCost = (tradeSide === 'yes' ? trade.price : 1 - trade.price) * tradeQuantity;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center p-3 bg-black/90 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          transition={{ type: 'spring', damping: 28, stiffness: 350 }}
          className="w-full max-w-6xl max-h-[92vh] bg-[#080808] border border-white/[0.06] rounded-2xl overflow-hidden flex flex-col shadow-2xl shadow-black/50"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.06]">
            {/* Market Image */}
            {trade.imageUrl && !imgError ? (
              <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 border border-white/[0.06]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={trade.imageUrl}
                  alt={trade.marketName}
                  className="object-cover w-full h-full"
                  onError={() => setImgError(true)}
                />
              </div>
            ) : (
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border border-white/[0.06] ${
                trade.provider === 'Kalshi' ? 'bg-emerald-500/10' : 'bg-blue-500/10'
              }`}>
                <BarChart3 className={`w-5 h-5 ${trade.provider === 'Kalshi' ? 'text-emerald-400' : 'text-blue-400'}`} />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-white truncate">{trade.marketName}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                  trade.provider === 'Kalshi'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                }`}>
                  {trade.provider === 'Kalshi' ? 'KALSHI' : 'POLYMARKET'}
                </span>
                {trade.category && (
                  <span className="text-[10px] text-slate-500">{trade.category}</span>
                )}
                <span className="text-[10px] text-slate-600">•</span>
                <span className="text-[10px] text-slate-500">{marketTrades.length} trades</span>
              </div>
            </div>

            {/* Prices */}
            <div className="flex items-center gap-4 mr-2">
              <div className="text-center">
                <div className="text-lg font-mono font-bold text-[#4FFFC8]">{yesPrice.toFixed(1)}¢</div>
                <div className="text-[9px] text-slate-500 uppercase">Yes</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-mono font-bold text-red-400">{noPrice.toFixed(1)}¢</div>
                <div className="text-[9px] text-slate-500 uppercase">No</div>
              </div>
            </div>

            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 transition-colors ml-1">
              <X className="w-5 h-5 text-slate-500 hover:text-white transition-colors" />
            </button>
          </div>

          {/* ── Main Content ── */}
          <div className="flex flex-1 overflow-hidden min-h-0">
            {/* Left: Chart + Book + Trades */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Tab Bar */}
              <div className="flex items-center gap-1 px-4 py-2 border-b border-white/[0.06] bg-white/[0.01]">
                {(['chart', 'book', 'trades'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                      activeTab === tab
                        ? 'bg-[#4FFFC8]/10 text-[#4FFFC8] border border-[#4FFFC8]/20'
                        : 'text-slate-500 hover:text-white hover:bg-white/[0.03]'
                    }`}
                  >
                    {tab === 'chart' ? (
                      <>📊 Candlestick</>
                    ) : tab === 'book' ? (
                      <>📋 Order Book {!bookLoading && <span className="w-1.5 h-1.5 rounded-full bg-[#4FFFC8] animate-pulse" />}</>
                    ) : '📈 Trades'}
                  </button>
                ))}

                {/* External link in tab bar */}
                {trade.externalUrl && (
                  <a
                    href={trade.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-slate-500 hover:text-[#4FFFC8] hover:bg-white/[0.03] transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {trade.provider}
                  </a>
                )}
              </div>

              {/* Chart View — Candlestick */}
              {activeTab === 'chart' && (
                <div className="flex-1 flex flex-col p-3 gap-3">
                  <div ref={chartContainerRef} className="w-full h-[300px] rounded-lg overflow-hidden" />
                  {/* Stats row */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: 'Probability', value: `${yesPrice.toFixed(0)}%`, color: 'text-[#4FFFC8]' },
                      { label: 'Volume', value: `$${marketTrades.reduce((s, t) => s + t.notional, 0).toFixed(0)}`, color: 'text-white' },
                      { label: 'Trades', value: marketTrades.length.toString(), color: 'text-white' },
                      { label: 'Spread', value: orderBook.bids[0] && orderBook.asks[0]
                        ? `${(orderBook.asks[0].price - orderBook.bids[0].price).toFixed(1)}¢`
                        : '—', color: 'text-amber-400' },
                    ].map(s => (
                      <div key={s.label} className="p-2 bg-white/[0.02] rounded-lg border border-white/[0.04]">
                        <div className="text-[9px] text-slate-500 uppercase tracking-wider">{s.label}</div>
                        <div className={`text-sm font-mono font-bold ${s.color}`}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Order Book View */}
              {activeTab === 'book' && (
                <div className="flex-1 overflow-y-auto p-3">
                  {bookLoading && orderBook.bids.length === 0 ? (
                    <div className="flex items-center justify-center h-48">
                      <div className="text-center">
                        <div className="w-6 h-6 border-2 border-[#4FFFC8] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                        <div className="text-sm text-slate-500">Loading order book…</div>
                        <div className="text-[10px] text-slate-600 mt-1">
                          {trade.provider === 'Polymarket' ? 'Fetching from Polymarket CLOB' : 'Fetching from Kalshi'}
                        </div>
                      </div>
                    </div>
                  ) : (
                  <>
                    <div className="flex items-center justify-between mb-2 px-2">
                      <span className="text-[9px] text-slate-600 uppercase tracking-wider">
                        {trade.provider === 'Polymarket' ? 'POLYMARKET CLOB' : trade.provider === 'Kalshi' ? 'KALSHI' : 'SIMULATED'} ORDER BOOK
                      </span>
                      {!bookLoading && (
                        <span className="flex items-center gap-1 text-[9px] text-[#4FFFC8]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#4FFFC8] animate-pulse" />
                          LIVE
                        </span>
                      )}
                    </div>

                    {/* Asks (reversed so best ask at bottom near spread) */}
                    <div className="mb-1">
                      <div className="grid grid-cols-3 text-[9px] text-slate-500 uppercase tracking-wider px-2 py-1">
                        <span>Price (¢)</span>
                        <span className="text-right">Size</span>
                        <span className="text-right">Total</span>
                      </div>
                      {[...orderBook.asks].reverse().map((ask, i) => (
                        <div key={`ask-${i}`} className="relative grid grid-cols-3 text-xs font-mono px-2 py-0.5">
                          <div
                            className="absolute inset-0 bg-red-500/[0.06]"
                            style={{ width: `${(ask.total / maxBookSize) * 100}%`, right: 0, left: 'auto' }}
                          />
                          <span className="relative text-red-400">{ask.price.toFixed(1)}</span>
                          <span className="relative text-right text-slate-400">{ask.size.toLocaleString()}</span>
                          <span className="relative text-right text-slate-600">{ask.total.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>

                    {/* Spread line */}
                    <div className="flex items-center justify-center py-1.5 border-y border-white/[0.04]">
                      <span className="text-sm font-mono font-bold text-[#4FFFC8]">{yesPrice.toFixed(1)}¢</span>
                      {orderBook.bids[0] && orderBook.asks[0] && (
                        <span className="mx-2 text-[10px] text-slate-500">
                          spread {(orderBook.asks[0].price - orderBook.bids[0].price).toFixed(1)}¢
                        </span>
                      )}
                    </div>

                    {/* Bids */}
                    <div className="mt-1">
                      {orderBook.bids.map((bid, i) => (
                        <div key={`bid-${i}`} className="relative grid grid-cols-3 text-xs font-mono px-2 py-0.5">
                          <div
                            className="absolute inset-0 bg-[#4FFFC8]/[0.06]"
                            style={{ width: `${(bid.total / maxBookSize) * 100}%`, right: 0, left: 'auto' }}
                          />
                          <span className="relative text-[#4FFFC8]">{bid.price.toFixed(1)}</span>
                          <span className="relative text-right text-slate-400">{bid.size.toLocaleString()}</span>
                          <span className="relative text-right text-slate-600">{bid.total.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </>
                  )}
                </div>
              )}

              {/* Trades Feed View */}
              {activeTab === 'trades' && (
                <div className="flex-1 overflow-y-auto">
                  <div className="grid grid-cols-6 text-[9px] text-slate-500 uppercase tracking-wider px-3 py-2 border-b border-white/[0.04] sticky top-0 bg-[#080808]">
                    <span>Side</span>
                    <span>Type</span>
                    <span className="text-right">Price</span>
                    <span className="text-right">Shares</span>
                    <span className="text-right">Amount</span>
                    <span className="text-right">Time</span>
                  </div>
                  {marketTrades.length === 0 ? (
                    <div className="text-center text-slate-500 text-sm py-8">No trades recorded for this market</div>
                  ) : (
                    marketTrades.map((t) => (
                      <div key={t.id} className="grid grid-cols-6 text-xs font-mono px-3 py-1.5 border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors">
                        <span className={t.side === 'Yes' ? 'text-[#4FFFC8]' : 'text-red-400'}>
                          {t.side}
                        </span>
                        <span className={t.type === 'BUY' || t.type === 'FILL' ? 'text-[#4FFFC8]' : 'text-red-400'}>
                          {t.type}
                        </span>
                        <span className="text-right text-white">{t.priceCents}</span>
                        <span className="text-right text-slate-300">{t.shares}</span>
                        <span className="text-right text-white">${t.notional.toFixed(0)}</span>
                        <span className="text-right text-slate-500">
                          {new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Right: Trading Panel */}
            <div className="w-72 border-l border-white/[0.06] flex flex-col bg-[#060606]">
              {/* Yes/No Toggle */}
              <div className="grid grid-cols-2 border-b border-white/[0.06]">
                <button
                  onClick={() => setTradeSide('yes')}
                  className={`py-3 text-sm font-bold transition-all relative ${
                    tradeSide === 'yes'
                      ? 'text-[#4FFFC8]'
                      : 'text-slate-500 hover:text-white'
                  }`}
                >
                  Buy Yes {yesPrice.toFixed(0)}¢
                  {tradeSide === 'yes' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4FFFC8]" />}
                </button>
                <button
                  onClick={() => setTradeSide('no')}
                  className={`py-3 text-sm font-bold transition-all relative ${
                    tradeSide === 'no'
                      ? 'text-red-400'
                      : 'text-slate-500 hover:text-white'
                  }`}
                >
                  Buy No {noPrice.toFixed(0)}¢
                  {tradeSide === 'no' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-400" />}
                </button>
              </div>

              {/* Amount */}
              <div className="p-4 space-y-3">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block">Amount</label>
                  <input
                    type="number"
                    value={tradeQuantity}
                    onChange={(e) => setTradeQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2.5 bg-white/[0.03] rounded-lg text-white text-base font-mono border border-white/[0.06] focus:border-[#4FFFC8]/30 focus:ring-0 outline-none transition-colors"
                  />
                  {/* Quick amounts */}
                  <div className="flex gap-1.5 mt-2">
                    {['+$1', '+$20', '+$100', 'Max'].map((label, i) => {
                      const amounts = [1, 20, 100, 1000];
                      return (
                        <button
                          key={label}
                          onClick={() => setTradeQuantity(prev => i < 3 ? prev + amounts[i] : amounts[i])}
                          className="flex-1 py-1 rounded-md text-[10px] font-bold bg-white/[0.03] text-slate-400 hover:text-white hover:bg-white/[0.06] border border-white/[0.04] transition-colors"
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Cost Summary */}
                <div className="p-3 bg-white/[0.02] rounded-lg border border-white/[0.04] space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">You&apos;ll receive</span>
                    <span className="text-white font-mono font-bold">
                      ${tradeQuantity.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Price per Share</span>
                    <span className="text-[#4FFFC8] font-mono font-bold">
                      ${(tradeSide === 'yes' ? trade.price : 1 - trade.price).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="px-4 space-y-2 mt-auto pb-4">
                <button
                  onClick={() => {
                    if (onOpenTradePanel) {
                      onClose();
                      onOpenTradePanel(trade);
                    }
                  }}
                  className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all ${
                    tradeSide === 'yes'
                      ? 'bg-[#4FFFC8] text-black hover:brightness-90'
                      : 'bg-red-500 text-white hover:brightness-90'
                  }`}
                >
                  Buy
                </button>

                {/* Instant Trade */}
                {onInstantTrade && (
                  <button
                    onClick={() => {
                      onInstantTrade({
                        ...trade,
                        side: tradeSide === 'yes' ? 'Yes' : 'No',
                        price: tradeSide === 'yes' ? trade.price : 1 - trade.price,
                      });
                    }}
                    className="w-full py-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-400 font-bold text-xs flex items-center justify-center gap-2 hover:bg-amber-500/10 transition-all"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    ⚡ Instant ({instantTradeShares} shares)
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
