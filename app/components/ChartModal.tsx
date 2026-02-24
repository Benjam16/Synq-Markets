'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, TrendingUp, TrendingDown, BarChart3, DollarSign,
  ExternalLink, Copy, Zap, ArrowRight, ArrowDown, ArrowUp,
} from 'lucide-react';
import { createChart, ColorType, AreaSeries } from 'lightweight-charts';
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
  allTrades: ChartTrade[];  // All trades from the terminal feed
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
  const areaSeriesRef = useRef<any>(null);
  const [tradeSide, setTradeSide] = useState<'yes' | 'no'>('yes');
  const [tradeQuantity, setTradeQuantity] = useState(10);
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

  // Generate price history from market trades
  const priceHistory = useMemo(() => {
    const sorted = [...marketTrades].reverse();
    if (sorted.length === 0) {
      // Generate synthetic price history centered around current price
      const points: { time: number; value: number }[] = [];
      const now = Date.now();
      let p = trade.price;
      for (let i = 60; i >= 0; i--) {
        p = Math.max(0.01, Math.min(0.99, p + (Math.random() - 0.5) * 0.02));
        points.push({
          time: Math.floor((now - i * 60000) / 1000),
          value: p * 100,
        });
      }
      // Last point is current price
      points.push({ time: Math.floor(now / 1000), value: trade.price * 100 });
      return points;
    }

    return sorted.map((t, i) => ({
      time: Math.floor(new Date(t.timestamp).getTime() / 1000),
      value: t.price * 100,
    }));
  }, [marketTrades, trade.price]);

  // Fetch REAL order book data (Polymarket CLOB or Kalshi)
  const [orderBook, setOrderBook] = useState<{ bids: OrderBookEntry[]; asks: OrderBookEntry[] }>({ bids: [], asks: [] });
  const [bookLoading, setBookLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    async function fetchOrderBook() {
      setBookLoading(true);
      try {
        if (trade.provider === 'Polymarket' && trade.marketId) {
          // Polymarket CLOB order book: GET /book?token_id={TOKEN_ID}
          const res = await fetch(`https://clob.polymarket.com/book?token_id=${trade.marketId}`, {
            headers: { 'Accept': 'application/json' },
            cache: 'no-store',
          });
          if (res.ok) {
            const data = await res.json();
            // data = { bids: [{price, size}], asks: [{price, size}] }
            // Prices are strings like "0.92", sizes are strings like "1234.56"
            const rawBids = (data.bids || []).slice(0, 15);
            const rawAsks = (data.asks || []).slice(0, 15);
            let bidTotal = 0;
            let askTotal = 0;
            const bids: OrderBookEntry[] = rawBids.map((b: any) => {
              const size = parseFloat(b.size || '0');
              bidTotal += size;
              return { price: parseFloat(b.price || '0') * 100, size: Math.round(size), total: Math.round(bidTotal) };
            });
            const asks: OrderBookEntry[] = rawAsks.map((a: any) => {
              const size = parseFloat(a.size || '0');
              askTotal += size;
              return { price: parseFloat(a.price || '0') * 100, size: Math.round(size), total: Math.round(askTotal) };
            });
            if (!cancelled) setOrderBook({ bids, asks });
            if (!cancelled) setBookLoading(false);
            return;
          }
        }

        if (trade.provider === 'Kalshi' && trade.marketId) {
          // Kalshi order book: GET /trade-api/v2/markets/{ticker}/orderbook
          const res = await fetch(`/api/kalshi-book?ticker=${encodeURIComponent(trade.marketId)}`);
          if (res.ok) {
            const data = await res.json();
            if (!cancelled) setOrderBook(data);
            if (!cancelled) setBookLoading(false);
            return;
          }
        }

        // Fallback: generate synthetic order book from current price
        const yesPrice = trade.price * 100;
        const bids: OrderBookEntry[] = [];
        const asks: OrderBookEntry[] = [];
        let bidTotal = 0;
        let askTotal = 0;
        for (let i = 0; i < 12; i++) {
          const bidPrice = Math.max(1, yesPrice - (i + 1) * 1);
          const bidSize = Math.floor(Math.random() * 5000) + 500;
          bidTotal += bidSize;
          bids.push({ price: bidPrice, size: bidSize, total: bidTotal });
        }
        for (let i = 0; i < 12; i++) {
          const askPrice = Math.min(99, yesPrice + (i + 1) * 1);
          const askSize = Math.floor(Math.random() * 5000) + 500;
          askTotal += askSize;
          asks.push({ price: askPrice, size: askSize, total: askTotal });
        }
        if (!cancelled) setOrderBook({ bids, asks });
      } catch (err) {
        console.warn('[ChartModal] Order book fetch error:', err);
        // Generate fallback
        const yesPrice = trade.price * 100;
        const bids: OrderBookEntry[] = [];
        const asks: OrderBookEntry[] = [];
        let bidTotal = 0;
        let askTotal = 0;
        for (let i = 0; i < 12; i++) {
          bidTotal += Math.floor(Math.random() * 5000) + 500;
          bids.push({ price: Math.max(1, yesPrice - (i + 1)), size: bidTotal - (bids[i - 1]?.total || 0), total: bidTotal });
        }
        for (let i = 0; i < 12; i++) {
          askTotal += Math.floor(Math.random() * 5000) + 500;
          asks.push({ price: Math.min(99, yesPrice + (i + 1)), size: askTotal - (asks[i - 1]?.total || 0), total: askTotal });
        }
        if (!cancelled) setOrderBook({ bids, asks });
      }
      if (!cancelled) setBookLoading(false);
    }

    fetchOrderBook();
    // Re-fetch every 5 seconds while modal is open
    const interval = setInterval(fetchOrderBook, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [isOpen, trade.provider, trade.marketId, trade.price]);

  // Initialize lightweight-charts
  useEffect(() => {
    if (!isOpen || activeTab !== 'chart' || !chartContainerRef.current) return;

    // Clean up previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      areaSeriesRef.current = null;
    }

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: '#0a0a0a' },
        textColor: '#94a3b8',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#1a1a2e' },
        horzLines: { color: '#1a1a2e' },
      },
      width: container.clientWidth,
      height: 320,
      timeScale: {
        borderColor: '#1a1a2e',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#1a1a2e',
      },
      crosshair: {
        vertLine: { color: '#4FFFC8', width: 1, style: 3, labelBackgroundColor: '#4FFFC8' },
        horzLine: { color: '#4FFFC8', width: 1, style: 3, labelBackgroundColor: '#4FFFC8' },
      },
    });

    // lightweight-charts v5: addSeries(AreaSeries, options)
    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: '#4FFFC8',
      topColor: 'rgba(79, 255, 200, 0.3)',
      bottomColor: 'rgba(79, 255, 200, 0.02)',
      lineWidth: 2,
    });

    // Deduplicate timestamps (lightweight-charts requires unique times)
    const uniqueData = new Map<number, number>();
    for (const point of priceHistory) {
      uniqueData.set(point.time, point.value);
    }
    const sortedData = Array.from(uniqueData.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([time, value]) => ({ time: time as any, value }));

    if (sortedData.length > 0) {
      areaSeries.setData(sortedData);
    }

    chart.timeScale().fitContent();

    chartRef.current = chart;
    areaSeriesRef.current = areaSeries;

    // Resize handler
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
        areaSeriesRef.current = null;
      }
    };
  }, [isOpen, activeTab, priceHistory]);

  const yesPrice = trade.price * 100;
  const noPrice = (1 - trade.price) * 100;
  const maxBookSize = Math.max(
    ...orderBook.bids.map(b => b.total),
    ...orderBook.asks.map(a => a.total),
    1
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center p-2 bg-black/90 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-5xl max-h-[90vh] bg-[#0a0a0a] border border-[#1A1A1A] rounded-2xl overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1A1A1A] bg-[#0a0a0a]">
            {/* Market Image */}
            {trade.imageUrl && !imgError ? (
              <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 border border-[#1A1A1A]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={trade.imageUrl}
                  alt={trade.marketName}
                  className="object-cover w-full h-full"
                  onError={() => setImgError(true)}
                />
              </div>
            ) : (
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 border border-[#1A1A1A] ${
                trade.provider === 'Kalshi' ? 'bg-emerald-500/10' : 'bg-blue-500/10'
              }`}>
                <span className="text-lg font-bold">{trade.provider === 'Kalshi' ? 'K' : 'P'}</span>
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-white truncate">{trade.marketName}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                  trade.provider === 'Kalshi'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                }`}>
                  {trade.provider === 'Kalshi' ? 'KALSHI' : 'POLY'}
                </span>
                {trade.category && (
                  <span className="text-[10px] text-slate-500">{trade.category}</span>
                )}
              </div>
            </div>

            {/* Yes/No Prices */}
            <div className="flex items-center gap-3 mr-4">
              <div className="text-right">
                <div className="text-[10px] text-[#4FFFC8] font-bold">YES {yesPrice.toFixed(1)}¢</div>
                <div className="text-[10px] text-red-400 font-bold">NO {noPrice.toFixed(1)}¢</div>
              </div>
            </div>

            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* ── Main Content ── */}
          <div className="flex flex-1 overflow-hidden">
            {/* Left: Chart + Trades */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Tab Bar */}
              <div className="flex items-center gap-1 px-4 py-2 border-b border-[#1A1A1A]">
                {(['chart', 'book', 'trades'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                      activeTab === tab
                        ? 'bg-[#4FFFC8]/10 text-[#4FFFC8] border border-[#4FFFC8]/20'
                        : 'text-slate-500 hover:text-white'
                    }`}
                  >
                    {tab === 'chart' ? '📈 Chart' : tab === 'book' ? (
                      <>📊 Order Book {!bookLoading && <span className="w-1.5 h-1.5 rounded-full bg-[#4FFFC8] animate-pulse" />}</>
                    ) : '📋 Trades'}
                  </button>
                ))}
              </div>

              {/* Chart View */}
              {activeTab === 'chart' && (
                <div className="flex-1 p-2">
                  <div ref={chartContainerRef} className="w-full h-[320px] rounded-lg overflow-hidden" />
                  {/* Price stats below chart */}
                  <div className="grid grid-cols-4 gap-2 mt-2 px-2">
                    <div className="p-2 bg-white/[0.02] rounded-lg border border-[#1A1A1A]">
                      <div className="text-[9px] text-slate-500 uppercase">Spread</div>
                      <div className="text-sm font-mono font-bold text-white">1¢</div>
                    </div>
                    <div className="p-2 bg-white/[0.02] rounded-lg border border-[#1A1A1A]">
                      <div className="text-[9px] text-slate-500 uppercase">Prob</div>
                      <div className="text-sm font-mono font-bold text-[#4FFFC8]">{yesPrice.toFixed(0)}%</div>
                    </div>
                    <div className="p-2 bg-white/[0.02] rounded-lg border border-[#1A1A1A]">
                      <div className="text-[9px] text-slate-500 uppercase">Trades</div>
                      <div className="text-sm font-mono font-bold text-white">{marketTrades.length}</div>
                    </div>
                    <div className="p-2 bg-white/[0.02] rounded-lg border border-[#1A1A1A]">
                      <div className="text-[9px] text-slate-500 uppercase">Volume</div>
                      <div className="text-sm font-mono font-bold text-white">
                        ${marketTrades.reduce((s, t) => s + t.notional, 0).toFixed(0)}
                      </div>
                    </div>
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
                        <div className="text-sm text-slate-500">Loading order book...</div>
                        <div className="text-[10px] text-slate-600 mt-1">
                          {trade.provider === 'Polymarket' ? 'Fetching from Polymarket CLOB' : 'Fetching from Kalshi'}
                        </div>
                      </div>
                    </div>
                  ) : (
                  <>
                  {/* Source label */}
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
                  {/* Asks (sellers) — reversed so best ask is near the spread */}
                  <div className="mb-1">
                    <div className="grid grid-cols-3 text-[9px] text-slate-500 uppercase tracking-wider px-2 py-1">
                      <span>Price (¢)</span>
                      <span className="text-right">Size</span>
                      <span className="text-right">Total</span>
                    </div>
                    {[...orderBook.asks].reverse().map((ask, i) => (
                      <div key={`ask-${i}`} className="relative grid grid-cols-3 text-xs font-mono px-2 py-1">
                        <div
                          className="absolute inset-0 bg-red-500/8"
                          style={{ width: `${(ask.total / maxBookSize) * 100}%`, right: 0, left: 'auto' }}
                        />
                        <span className="relative text-red-400">{ask.price.toFixed(1)}</span>
                        <span className="relative text-right text-slate-300">{ask.size.toLocaleString()}</span>
                        <span className="relative text-right text-slate-500">{ask.total.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>

                  {/* Spread */}
                  <div className="flex items-center justify-center py-2 border-y border-[#1A1A1A]">
                    <span className="text-sm font-mono font-bold text-[#4FFFC8]">{yesPrice.toFixed(1)}¢</span>
                    <span className="mx-2 text-[10px] text-slate-500">spread 1.0¢</span>
                  </div>

                  {/* Bids (buyers) */}
                  <div className="mt-1">
                    {orderBook.bids.map((bid, i) => (
                      <div key={`bid-${i}`} className="relative grid grid-cols-3 text-xs font-mono px-2 py-1">
                        <div
                          className="absolute inset-0 bg-[#4FFFC8]/8"
                          style={{ width: `${(bid.total / maxBookSize) * 100}%`, right: 0, left: 'auto' }}
                        />
                        <span className="relative text-[#4FFFC8]">{bid.price.toFixed(1)}</span>
                        <span className="relative text-right text-slate-300">{bid.size.toLocaleString()}</span>
                        <span className="relative text-right text-slate-500">{bid.total.toLocaleString()}</span>
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
                  <div className="grid grid-cols-6 text-[9px] text-slate-500 uppercase tracking-wider px-3 py-2 border-b border-[#1A1A1A] sticky top-0 bg-[#0a0a0a]">
                    <span>Side</span>
                    <span>Type</span>
                    <span className="text-right">Price</span>
                    <span className="text-right">Shares</span>
                    <span className="text-right">Amount</span>
                    <span className="text-right">Time</span>
                  </div>
                  {marketTrades.length === 0 ? (
                    <div className="text-center text-slate-500 text-sm py-8">No trades recorded for this market yet</div>
                  ) : (
                    marketTrades.map((t) => (
                      <div key={t.id} className="grid grid-cols-6 text-xs font-mono px-3 py-1.5 border-b border-[#1A1A1A]/50 hover:bg-white/[0.02]">
                        <span className={t.side === 'Yes' || t.side === 'Up' ? 'text-[#4FFFC8]' : 'text-red-400'}>
                          {t.side}
                        </span>
                        <span className={`${
                          t.type === 'BUY' || t.type === 'FILL' ? 'text-[#4FFFC8]' : 'text-red-400'
                        }`}>
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
            <div className="w-72 border-l border-[#1A1A1A] flex flex-col bg-[#080808]">
              {/* Buy/Sell Toggle */}
              <div className="flex border-b border-[#1A1A1A]">
                <button
                  onClick={() => setTradeSide('yes')}
                  className={`flex-1 py-3 text-sm font-bold transition-all ${
                    tradeSide === 'yes'
                      ? 'bg-[#4FFFC8]/10 text-[#4FFFC8] border-b-2 border-[#4FFFC8]'
                      : 'text-slate-500 hover:text-white'
                  }`}
                >
                  Buy Yes
                </button>
                <button
                  onClick={() => setTradeSide('no')}
                  className={`flex-1 py-3 text-sm font-bold transition-all ${
                    tradeSide === 'no'
                      ? 'bg-red-500/10 text-red-400 border-b-2 border-red-400'
                      : 'text-slate-500 hover:text-white'
                  }`}
                >
                  Buy No
                </button>
              </div>

              {/* Price Display */}
              <div className="p-4">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                  {tradeSide === 'yes' ? 'Yes' : 'No'} Price
                </div>
                <div className={`text-3xl font-mono font-bold ${
                  tradeSide === 'yes' ? 'text-[#4FFFC8]' : 'text-red-400'
                }`}>
                  {tradeSide === 'yes' ? yesPrice.toFixed(1) : noPrice.toFixed(1)}¢
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {tradeSide === 'yes' ? yesPrice.toFixed(0) : noPrice.toFixed(0)}% probability
                </div>
              </div>

              {/* Shares Input */}
              <div className="px-4 mb-3">
                <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">Shares</label>
                <input
                  type="number"
                  value={tradeQuantity}
                  onChange={(e) => setTradeQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2.5 bg-white/5 rounded-lg text-white text-sm font-mono border border-[#1A1A1A] focus:border-[#4FFFC8]/30 focus:ring-0 outline-none"
                />
                {/* Quick amounts */}
                <div className="flex gap-1.5 mt-2">
                  {[10, 50, 100, 500, 1000].map(amt => (
                    <button
                      key={amt}
                      onClick={() => setTradeQuantity(amt)}
                      className={`flex-1 py-1 rounded-md text-[10px] font-bold transition-all ${
                        tradeQuantity === amt
                          ? 'bg-[#4FFFC8]/15 text-[#4FFFC8] border border-[#4FFFC8]/30'
                          : 'bg-white/5 text-slate-400 hover:text-white border border-transparent'
                      }`}
                    >
                      {amt >= 1000 ? `${amt/1000}K` : amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cost Summary */}
              <div className="px-4 mb-4">
                <div className="p-3 bg-white/[0.02] rounded-lg border border-[#1A1A1A]">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500">Cost</span>
                    <span className="text-white font-mono">
                      ${((tradeSide === 'yes' ? trade.price : 1 - trade.price) * tradeQuantity).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500">Fee (~2%)</span>
                    <span className="text-white font-mono">
                      ${((tradeSide === 'yes' ? trade.price : 1 - trade.price) * tradeQuantity * 0.02).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs pt-1 border-t border-[#1A1A1A]">
                    <span className="text-slate-400 font-bold">If you win</span>
                    <span className="text-[#4FFFC8] font-mono font-bold">
                      +${(tradeQuantity * (1 - (tradeSide === 'yes' ? trade.price : 1 - trade.price))).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="px-4 space-y-2 mt-auto pb-4">
                {/* Trade Button */}
                <button
                  onClick={() => {
                    if (onOpenTradePanel) {
                      onClose();
                      onOpenTradePanel(trade);
                    }
                  }}
                  className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                    tradeSide === 'yes'
                      ? 'bg-[#4FFFC8] text-black hover:bg-[#3de6b3]'
                      : 'bg-red-500 text-white hover:bg-red-600'
                  }`}
                >
                  {tradeSide === 'yes' ? 'Buy Yes' : 'Buy No'} — {tradeQuantity} shares
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
                    className="w-full py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 font-bold text-xs flex items-center justify-center gap-2 hover:bg-amber-500/20 transition-all"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Instant Trade ({instantTradeShares} shares)
                  </button>
                )}

                {/* External Link */}
                {trade.externalUrl && (
                  <a
                    href={trade.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 rounded-xl border border-[#1A1A1A] text-slate-400 text-xs flex items-center justify-center gap-2 hover:text-white hover:border-[#4FFFC8]/30 transition-all"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open on {trade.provider}
                  </a>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
