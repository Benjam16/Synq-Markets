'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowRight, 
  TrendingUp, 
  Shield, 
  Zap, 
  Filter, 
  ChevronRight,
  BarChart3,
  Lock,
  Globe,
  Activity,
  Monitor,
  Grid3x3,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './components/AuthProvider';
import { Market } from '@/lib/types';

export default function LandingPage() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // --- DATA ENGINE (stable polling — no infinite loop) ---
  const prevPricesRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const loadMarkets = async () => {
      try {
        const res = await fetch('/api/markets/trending?limit=9', { signal: controller.signal });
        if (!res.ok || !active) return;
        const data = await res.json();
        const newMarkets: Market[] = data.markets || [];

        // Update previous prices ref (no state = no re-render loop)
        const nextPrices = new Map<string, number>();
        newMarkets.forEach((m) => nextPrices.set(m.id, m.price));
        prevPricesRef.current = nextPrices;

        setMarkets(newMarkets);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        console.error('Failed to load markets:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadMarkets();
    // Refresh a bit more frequently so the homepage feels as live as the terminal
    const interval = setInterval(loadMarkets, 7000);
    return () => { active = false; controller.abort(); clearInterval(interval); };
  }, []); // ← stable deps: runs once

  const topMover = useMemo(() => {
    if (loading || !markets.length) return null;
    const sorted = [...markets].sort((a, b) => {
      const ca = Math.abs(a.change ?? 0);
      const cb = Math.abs(b.change ?? 0);
      return cb - ca;
    });
    return sorted[0] ?? null;
  }, [loading, markets]);

  const totalVolume = useMemo(() => {
    if (!markets.length) return 0;
    return markets.reduce((sum, m) => sum + (m.volume ?? 0), 0);
  }, [markets]);

  const marketsLive = markets.length;
  const formattedVolume =
    totalVolume > 0
      ? `$${(totalVolume / 1_000_000).toFixed(2)}M`
      : '—';

  const orderboardMarkets = useMemo(() => {
    if (loading || !markets.length) return [];
    // Sort by 24h volume descending so the highest-liquidity markets are surfaced first
    const sorted = [...markets].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
    // Show a deeper slice so the scroll area has content
    return sorted.slice(0, 20);
  }, [loading, markets]);

  const [venueFilter, setVenueFilter] = useState<'all' | 'Polymarket' | 'Kalshi'>('all');
  const [pingIndex, setPingIndex] = useState(0);

  const filteredMarkets = useMemo(() => {
    if (!markets.length) return [];
    if (venueFilter === 'all') return markets;
    return markets.filter((m) => m.provider === venueFilter);
  }, [markets, venueFilter]);

  useEffect(() => {
    if (!orderboardMarkets.length) return;
    const interval = setInterval(() => {
      setPingIndex((prev) => {
        if (!orderboardMarkets.length) return 0;
        const len = orderboardMarkets.length;
        let next = (prev + 1) % len;
        // Prefer rows that actually have a 24h move so they "pop" more often
        for (let i = 0; i < len; i++) {
          const idx = (prev + 1 + i) % len;
          const rawChange = orderboardMarkets[idx]?.change ?? 0;
          if (Math.abs(rawChange) >= 0.05) {
            next = idx;
            break;
          }
        }
        return next;
      });
    }, 2200);
    return () => clearInterval(interval);
  }, [orderboardMarkets]);

  const isMarketsActive = pathname.startsWith('/markets');
  const isTerminalActive = pathname.startsWith('/terminal');
  const isStocksActive = pathname.startsWith('/stocks');
  const isBagsActive = pathname.startsWith('/bags');

  return (
    <div className="min-h-screen bg-[#050505] bg-radial-glow flex flex-col items-center overflow-x-hidden relative">
      
      {/* Subtle static glow — no mouse tracking */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(79,255,200,0.03), transparent 60%)',
        }}
      />

      {/* NAVIGATION BAR */}
      <header className="fixed top-0 left-0 right-0 z-[9999] w-full">
        <nav className="w-full h-16 bg-[#050505]/95 backdrop-blur-md border-b border-[#1A1A1A] flex items-center">
          <div className="max-w-7xl mx-auto px-6 w-full flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#4FFFC8] rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(79,255,200,0.3)]">
                <TrendingUp className="w-6 h-6 text-black" strokeWidth={1.5} />
              </div>
              <Link href="/" className="text-2xl font-black text-white tracking-tighter uppercase">Synq</Link>
            </div>
            
            <div className="hidden lg:flex items-center gap-10">
              <Link
                href="/markets"
                className={`text-xs font-semibold tracking-[0.18em] ${
                  isMarketsActive ? 'text-white' : 'text-slate-400 hover:text-[#4FFFC8]'
                } pb-0.5 border-b ${
                  isMarketsActive ? 'border-[#4FFFC8]/70' : 'border-transparent'
                } transition-colors`}
              >
                Predictions
              </Link>
              <Link
                href="/terminal"
                className={`text-xs font-semibold tracking-[0.18em] ${
                  isTerminalActive ? 'text-white' : 'text-slate-400 hover:text-[#4FFFC8]'
                } pb-0.5 border-b ${
                  isTerminalActive ? 'border-[#4FFFC8]/70' : 'border-transparent'
                } transition-colors`}
              >
                Terminal
              </Link>
              <Link
                href="/stocks"
                className={`text-xs font-semibold tracking-[0.18em] ${
                  isStocksActive ? 'text-white' : 'text-slate-400 hover:text-[#4FFFC8]'
                } pb-0.5 border-b ${
                  isStocksActive ? 'border-[#4FFFC8]/70' : 'border-transparent'
                } transition-colors`}
              >
                RWAs
              </Link>
              <Link
                href="/bags"
                className={`text-xs font-semibold tracking-[0.18em] ${
                  isBagsActive ? 'text-white' : 'text-slate-400 hover:text-[#4FFFC8]'
                } pb-0.5 border-b ${
                  isBagsActive ? 'border-[#4FFFC8]/70' : 'border-transparent'
                } transition-colors`}
              >
                Bags
              </Link>
              {mounted && user ? (
                <div className="flex items-center gap-4">
                  <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 bg-[#0f0f0f]/80 backdrop-blur-md rounded-full border border-[#1A1A1A]">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-mono text-slate-300">
                      {user.email}
                    </span>
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.18em] text-emerald-400 font-semibold">
                    Wallet connected
                  </span>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="px-8 py-3 bg-[#4FFFC8] hover:bg-[#3debb8] text-black font-black rounded-full text-xs uppercase tracking-[0.22em] shadow-[0_0_20px_rgba(79,255,200,0.3)]"
                >
                  Connect wallet
                </Link>
              )}
            </div>
          </div>
        </nav>
      </header>

      {/* =========================================================================================
          MAIN BODY (pt-16 matches navbar height exactly, plus invisible separator)
          ========================================================================================= */}
      <main className="w-full pt-16 flex flex-col items-center">
        
        {/* --- HERO SECTION --- */}
        <section className="w-full flex flex-col items-center px-6 pt-16 pb-20 relative overflow-hidden">
          {/* Background — single subtle gradient, no animation */}
          <div className="absolute inset-0 pointer-events-none">
            <div
              className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(79,255,200,0.06) 0%, transparent 60%)',
              }}
            />
            <div
              className="absolute inset-0 opacity-[0.015]"
              style={{
                backgroundImage: `
                  linear-gradient(to right, #4FFFC8 1px, transparent 1px),
                  linear-gradient(to bottom, #4FFFC8 1px, transparent 1px)
                `,
                backgroundSize: '80px 80px',
              }}
            />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-6xl w-full grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-10 lg:gap-14 items-center relative z-10"
          >
            {/* Left: copy + primary CTA + metrics strip */}
            <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
              <p className="text-sm text-slate-500 mb-4">
                RWAs · prediction markets · meme coins
              </p>
              
              <h1 className="text-4xl md:text-5xl font-semibold mb-4 leading-tight tracking-tight">
                <span className="text-slate-100">
                  Aggregated{" "}
                  <span className="text-gradient-cyan-indigo">
                    RWAs, prediction markets,
                  </span>
                </span>
                <br className="hidden md:block" />
                <span className="text-slate-100">
                  and{" "}
                  <span className="text-gradient-cyan-indigo">
                    meme coins
                  </span>{" "}
                  in one execution terminal.
                </span>
              </h1>
              
              <p className="text-base md:text-lg text-slate-400 mb-4 max-w-xl leading-relaxed">
                Connect your wallet and trade tokenized RWAs, prediction markets and meme coins from a single screen.
                No email logins, no CSV exports—just one onchain terminal.
              </p>

              {topMover && (
                <p className="mb-8 text-xs text-slate-500 font-mono tabular-nums">
                  Top move:&nbsp;
                  <span className="text-slate-300">{topMover.name}</span>
                  &nbsp;
                  <span
                    className={
                      (topMover.change ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }
                  >
                    {(topMover.change ?? 0) >= 0 ? '+' : ''}
                    {(topMover.change ?? 0).toFixed(1)}%
                  </span>
                  &nbsp;today
                </p>
              )}
              
              <div className="flex flex-col md:flex-row gap-3 justify-center lg:justify-start items-center w-full mb-4">
                <Link
                  href={mounted && user ? "/terminal" : "/login"}
                  className="w-full md:w-auto px-10 py-4 bg-[#4FFFC8] hover:bg-[#3debb8] text-black font-black rounded-full transition-all hover:scale-[1.02] shadow-[0_0_18px_rgba(79,255,200,0.3)] text-sm uppercase tracking-[0.22em] flex items-center justify-center gap-3 border border-emerald-300/70"
                >
                  {mounted && user ? "Enter terminal" : "Preview terminal"}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {/* Metrics strip */}
              <div className="mt-3 w-full max-w-xl rounded-full border border-[#1A1A1A] bg-black/40 px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-semibold">
                    Volume (top markets)
                  </span>
                  <span className="font-mono text-sm text-[#4FFFC8] tabular-nums">
                    {formattedVolume}
                  </span>
                </div>
                <div className="h-px sm:h-6 w-full sm:w-px bg-[#1A1A1A] sm:mx-3" />
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-semibold">
                    Predictions live
                  </span>
                  <span className="font-mono text-sm text-slate-300 tabular-nums">
                    {marketsLive || '—'}
                  </span>
                </div>
                <div className="h-px sm:h-6 w-full sm:w-px bg-[#1A1A1A] sm:mx-3" />
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-semibold">
                    Venues
                  </span>
                  <span className="font-mono text-sm text-slate-300">
                    Polymarket · Kalshi · Dflow RWAs · Bags
                  </span>
                </div>
              </div>
            </div>

            {/* Right: live orderboard panel */}
            <div className="hidden md:block">
              <div className="mx-auto w-full max-w-xl rounded-2xl border border-[#1A1A1A] bg-black/70 backdrop-blur-xl shadow-[0_22px_70px_rgba(0,0,0,0.7)] card-floating">
                <div className="px-4 pt-4 pb-2 flex items-center justify-between border-b border-[#111827]">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Live orderboard
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Wallet: connected
                  </span>
                </div>
                <div className="px-4 py-2 flex items-center text-[10px] uppercase tracking-[0.18em] text-slate-500 gap-3">
                  <span className="w-[44%]">Market</span>
                  <span className="w-[18%] text-right">Price</span>
                  <span className="w-[18%] text-right">Move</span>
                  <span className="w-[20%] text-right">Venue</span>
                </div>
                <div className="px-3 pb-3 max-h-80 overflow-y-auto custom-scrollbar">
                  {loading ? (
                    <div className="space-y-1.5">
                      {[...Array(8)].map((_, i) => (
                        <div
                          key={i}
                          className="h-9 rounded-lg bg-[#050505] border border-[#111827] animate-pulse"
                        />
                      ))}
                    </div>
                  ) : orderboardMarkets.length === 0 ? (
                    <div className="h-24 flex items-center justify-center text-xs text-slate-500">
                      Markets will appear here as liquidity comes online.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {orderboardMarkets.map((m, idx) => {
                        const rawChange = m.change ?? 0;
                        const hasChange = Math.abs(rawChange) >= 0.05;
                        const moveLabel = hasChange
                          ? `${rawChange >= 0 ? '+' : ''}${rawChange.toFixed(1)}%`
                          : '—';
                        const isPing = idx === pingIndex;
                        return (
                          <motion.div
                            key={m.id}
                            className="h-9 rounded-lg bg-[#050505] border border-[#111827] flex items-center px-3 text-[11px] overflow-hidden"
                            animate={
                              isPing
                                ? {
                                    scale: [1, 1.01, 1],
                                    backgroundColor: [
                                      'rgba(5,5,5,1)',
                                      'rgba(15,23,42,1)',
                                      'rgba(5,5,5,1)',
                                    ],
                                  }
                                : { scale: 1, backgroundColor: 'rgba(5,5,5,1)' }
                            }
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                          >
                            <div className="w-[44%] truncate text-slate-200 flex items-center gap-2">
                              <span className="w-1 h-4 rounded-full bg-[#1E293B]" />
                              <span className="truncate">{m.name}</span>
                            </div>
                            <div className="w-[18%] text-right font-mono text-[#4FFFC8]">
                              ${m.price.toFixed(2)}
                            </div>
                            <div className="w-[18%] text-right font-mono">
                              {hasChange ? (
                                <motion.span
                                  className={rawChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}
                                  animate={
                                    isPing
                                      ? { scale: [1, 1.1, 1], y: [-1, 0], opacity: [0.6, 1] }
                                      : { scale: 1, y: 0, opacity: 1 }
                                  }
                                  transition={{ duration: 0.4, ease: 'easeOut' }}
                                >
                                  {moveLabel}
                                </motion.span>
                              ) : (
                                <span className="text-slate-500">{moveLabel}</span>
                              )}
                            </div>
                            <div className="w-[20%] text-right">
                              <span
                                className={`inline-flex items-center justify-end gap-1 text-[9px] px-1.5 py-[2px] rounded-full border ${
                                  m.provider === 'Kalshi'
                                    ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/5'
                                    : 'border-blue-500/40 text-blue-300 bg-blue-500/5'
                                }`}
                              >
                                <span
                                  className={`w-1 h-1 rounded-full ${
                                    m.provider === 'Kalshi' ? 'bg-emerald-400' : 'bg-blue-400'
                                  }`}
                                />
                                {m.provider}
                              </span>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

        </section>

        {/* --- LIVE MARKETS - Floating Cards with Live Dot --- */}
        <section className="w-full py-16 border-y border-[#1A1A1A] flex flex-col items-center">
          <div className="max-w-6xl w-full px-6 flex flex-col items-center">
            <div className="w-full flex flex-col items-center text-center mb-10 gap-6">
              <div className="text-center">
                <h2 className="text-xl font-bold text-white mb-3">Live predictions</h2>
                <p className="text-slate-400 text-sm">
                  Live data from Polymarket and Kalshi. Filter by venue to mirror the terminal.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="inline-flex rounded-full border border-[#1A1A1A] bg-black/40 p-1">
                  {(['all', 'Polymarket', 'Kalshi'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setVenueFilter(v)}
                      className={`px-4 py-1.5 text-[11px] rounded-full transition-all ${
                        venueFilter === v
                          ? 'bg-[#111827] text-[#4FFFC8] border border-[#4FFFC8]/30'
                          : 'text-slate-400 border border-transparent hover:border-[#4FFFC8]/20'
                      }`}
                    >
                      {v === 'all' ? 'All venues' : v}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                  Showing {filteredMarkets.length || 0} markets
                </p>
              </div>
              <Link href="/markets" className="px-8 py-3 bg-transparent border border-[#1A1A1A] text-white font-bold rounded-full flex items-center gap-3 hover:border-[#4FFFC8]/30 hover:bg-[#4FFFC8]/5 transition-all tracking-widest uppercase text-xs">
                Browse Predictions <ChevronRight className="w-5 h-5" />
              </Link>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
                {[...Array(9)].map((_, i) => (
                  <div key={i} className="h-32 card-floating rounded-xl animate-pulse" />
                ))}
              </div>
            ) : filteredMarkets.length === 0 ? (
              <div className="w-full py-16 text-center text-slate-500">
                No live markets available for this venue filter. Try switching venues or check back in a few minutes.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
                {filteredMarkets.slice(0, 9).map((market, idx) => (
                  <motion.div
                    key={market.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: idx * 0.05 }}
                    className="p-5 card-floating rounded-xl hover:border-[#4FFFC8]/20 transition-all group"
                  >
                    {/* Row 1: Provider + Live badge — sits above the data row */}
                    <div className="flex items-center gap-2 mb-3">
                      {market.provider === 'Kalshi' ? (
                        <span className="inline-flex items-center gap-1 text-[8px] px-1.5 py-[2px] rounded-full font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                          <span className="w-1 h-1 rounded-full bg-emerald-400" />Kalshi
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[8px] px-1.5 py-[2px] rounded-full font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 whitespace-nowrap">
                          <span className="w-1 h-1 rounded-full bg-blue-400" />Poly
                        </span>
                      )}
                      <div className="flex items-center gap-1">
                        <div className="live-dot" />
                        <span className="text-[8px] text-[#4FFFC8] font-bold uppercase tracking-wider">Live</span>
                      </div>
                    </div>

                    {/* Row 2: Price | Market title | Probability */}
                    <div className="flex items-center gap-4">
                      {/* Left: Price */}
                      <div className="flex flex-col flex-shrink-0">
                        <span className="text-[9px] text-slate-500 mb-1 uppercase tracking-[0.15em] font-bold">
                          Current Price
                        </span>
                        <span className="text-xl font-mono font-black text-[#4FFFC8] leading-tight">
                          ${market.price.toFixed(2)}
                        </span>
                      </div>

                      {/* Center: Market title */}
                      <div className="flex-1 min-w-0 px-2">
                        <span className="text-[9px] text-slate-500 mb-1 uppercase tracking-[0.15em] font-bold block">
                          Market
                        </span>
                        <div className="text-sm font-semibold text-slate-100 leading-snug line-clamp-2 break-words">
                          {market.eventTitle || market.name || 'Untitled market'}
                        </div>
                      </div>

                      {/* Right: Probability */}
                      <div className="flex flex-col items-end flex-shrink-0">
                        <span className="text-[9px] text-slate-500 mb-1 uppercase tracking-[0.15em] font-bold">
                          Probability
                        </span>
                        <span className="text-xl font-mono font-black text-white leading-tight">
                          {(market.price * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
            
          </div>
        </section>

        {/* --- TECHNICAL ADVANTAGES --- */}
        <section className="w-full py-20 border-t border-[#1A1A1A] flex flex-col items-center">
          <div className="max-w-6xl w-full px-6 flex flex-col items-center">
            <div className="flex flex-col items-center text-center mb-10">
              <h2 className="text-xl font-bold text-white mb-3">Terminal & markets</h2>
              <p className="text-slate-400 text-sm max-w-xl">One interface for live trading and discovery across venues.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full">
              {/* Terminal Showcase */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="group relative overflow-hidden bg-[#0a0a0a] border border-[#1A1A1A] rounded-2xl hover:border-[#4FFFC8]/30 transition-all"
              >
                <Link href="/terminal" className="block">
                  {/* Live Terminal Mockup */}
                  <div className="w-full aspect-[16/9] overflow-hidden border-b border-[#1A1A1A] bg-[#060606] p-4 group-hover:bg-[#080808] transition-colors">
                    {/* Terminal header bar */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                      </div>
                      <span className="text-[9px] text-slate-600 font-mono ml-2">SYNQ — LIVE TERMINAL</span>
                      <span className="ml-auto text-[8px] text-emerald-500/60 font-mono flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />CONNECTED</span>
                    </div>
                    {/* Simulated feed lines */}
                    <div className="space-y-1.5 font-mono text-[10px]">
                      {[
                        { time: '14:32:07', side: 'BUY',  market: 'Will BTC hit $120K by July?', amt: '$2,450', color: 'text-emerald-400' },
                        { time: '14:32:05', side: 'SELL', market: 'Fed Rate Cut June 2026',       amt: '$8,200', color: 'text-red-400' },
                        { time: '14:32:03', side: 'BUY',  market: 'ETH > $5K end of Q2?',        amt: '$1,100', color: 'text-emerald-400' },
                        { time: '14:32:01', side: 'BUY',  market: 'Trump wins 2028 GOP primary?', amt: '$15,000', color: 'text-amber-400' },
                        { time: '14:31:58', side: 'SELL', market: 'SpaceX IPO before 2027?',      amt: '$3,750', color: 'text-red-400' },
                        { time: '14:31:55', side: 'BUY',  market: 'US Recession in 2026?',        amt: '$920',  color: 'text-emerald-400' },
                      ].map((row, i) => (
                        <div key={i} className="flex items-center gap-3 px-2 py-1 rounded bg-white/[0.02]" style={{ opacity: 1 - i * 0.12 }}>
                          <span className="text-slate-600 w-14 flex-shrink-0">{row.time}</span>
                          <span className={`w-8 flex-shrink-0 font-bold ${row.color}`}>{row.side}</span>
                          <span className="text-slate-300 truncate flex-1">{row.market}</span>
                          <span className="text-slate-400 flex-shrink-0">{row.amt}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Info */}
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                        <Monitor className="w-4 h-4 text-emerald-400" strokeWidth={1.5} />
                      </div>
                      <h3 className="text-lg font-black text-white uppercase tracking-tighter">Live Terminal</h3>
                    </div>
                    <p className="text-slate-400 text-sm font-medium leading-relaxed mb-4">
                      Real-time trade feed aggregating Polymarket and Kalshi into a single unified stream. 
                      Whale alerts, arbitrage detection, and activity heatmaps — all updating in sub-second intervals.
                    </p>
                    <div className="flex items-center gap-2 text-[#4FFFC8] text-sm font-bold uppercase tracking-wider">
                      Open Terminal <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </Link>
              </motion.div>

              {/* Markets Showcase */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="group relative overflow-hidden bg-[#0a0a0a] border border-[#1A1A1A] rounded-2xl hover:border-[#4FFFC8]/30 transition-all"
              >
                <Link href="/markets" className="block">
                  {/* Predictions Explorer Mockup */}
                  <div className="w-full aspect-[16/9] overflow-hidden border-b border-[#1A1A1A] bg-[#060606] p-4 group-hover:bg-[#080808] transition-colors">
                    {/* Search bar mockup */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex-1 h-7 rounded-full bg-white/[0.04] border border-[#1A1A1A] flex items-center px-3">
                        <span className="text-[10px] text-slate-600">🔍 Search predictions...</span>
                      </div>
                      <div className="flex gap-1">
                        <span className="px-2 py-1 rounded-full bg-[#4FFFC8]/10 border border-[#4FFFC8]/20 text-[8px] text-[#4FFFC8] font-bold">ALL</span>
                        <span className="px-2 py-1 rounded-full bg-white/[0.03] border border-[#1A1A1A] text-[8px] text-slate-500">POLY</span>
                        <span className="px-2 py-1 rounded-full bg-white/[0.03] border border-[#1A1A1A] text-[8px] text-slate-500">KALSHI</span>
                      </div>
                    </div>
                    {/* Market cards grid */}
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { name: 'Bitcoin > $120K', prob: '67%', vol: '$1.2M', badge: 'POLY', badgeColor: 'text-blue-400 bg-blue-500/10' },
                        { name: 'Fed Rate Cut June', prob: '42%', vol: '$890K', badge: 'KALS', badgeColor: 'text-emerald-400 bg-emerald-500/10' },
                        { name: 'ETH Flips BNB', prob: '81%', vol: '$2.1M', badge: 'POLY', badgeColor: 'text-blue-400 bg-blue-500/10' },
                        { name: 'US GDP > 3%', prob: '35%', vol: '$450K', badge: 'KALS', badgeColor: 'text-emerald-400 bg-emerald-500/10' },
                      ].map((card, i) => (
                        <div key={i} className="rounded-lg bg-white/[0.02] border border-[#1A1A1A] p-2.5">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-[7px] font-bold px-1.5 py-0.5 rounded-full ${card.badgeColor}`}>{card.badge}</span>
                            <span className="text-[8px] text-slate-600">{card.vol}</span>
                          </div>
                          <div className="text-[10px] text-slate-300 font-medium mb-1.5 truncate">{card.name}</div>
                          <div className="flex items-center justify-between">
                            <div className="h-1 flex-1 rounded-full bg-white/[0.05] mr-2 overflow-hidden">
                              <div className="h-full rounded-full bg-[#4FFFC8]/40" style={{ width: card.prob }} />
                            </div>
                            <span className="text-[9px] text-[#4FFFC8] font-bold">{card.prob}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Info */}
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                        <Grid3x3 className="w-4 h-4 text-blue-400" strokeWidth={1.5} />
                      </div>
                      <h3 className="text-lg font-black text-white uppercase tracking-tighter">Predictions Explorer</h3>
                    </div>
                    <p className="text-slate-400 text-sm font-medium leading-relaxed mb-4">
                      Browse thousands of live prediction markets across both platforms. Filter by category, track volume, 
                      and compare odds — with provider badges, images, and real-time probability updates on every card.
                    </p>
                    <div className="flex items-center gap-2 text-[#4FFFC8] text-sm font-bold uppercase tracking-wider">
                      Explore Predictions <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            </div>
          </div>
        </section>

        {/* --- HOW IT WORKS --- */}
        <section className="w-full py-16 border-t border-[#1A1A1A] flex flex-col items-center">
          <div className="max-w-4xl w-full px-6 flex flex-col items-center">
            <h2 className="text-xl font-bold text-white mb-8">How it works</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full text-center">
              <div>
                <div className="w-10 h-10 rounded-full bg-[#4FFFC8]/10 border border-[#4FFFC8]/20 flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-5 h-5 text-[#4FFFC8]" strokeWidth={1.5} />
                </div>
                <h3 className="text-sm font-semibold text-white mb-2">Connect wallet</h3>
                <p className="text-slate-500 text-sm">Sign in with Phantom or Solflare. No account required.</p>
              </div>
              <div>
                <div className="w-10 h-10 rounded-full bg-[#4FFFC8]/10 border border-[#4FFFC8]/20 flex items-center justify-center mx-auto mb-4">
                  <Monitor className="w-5 h-5 text-[#4FFFC8]" strokeWidth={1.5} />
                </div>
                <h3 className="text-sm font-semibold text-white mb-2">Open terminal</h3>
                <p className="text-slate-500 text-sm">One live feed across predictions, RWAs, and Bags tokens.</p>
              </div>
              <div>
                <div className="w-10 h-10 rounded-full bg-[#4FFFC8]/10 border border-[#4FFFC8]/20 flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="w-5 h-5 text-[#4FFFC8]" strokeWidth={1.5} />
                </div>
                <h3 className="text-sm font-semibold text-white mb-2">Trade & track</h3>
                <p className="text-slate-500 text-sm">Trade predictions, tokenized RWAs, and Bags tokens in one place.</p>
              </div>
            </div>
          </div>
        </section>

        {/* --- CHALLENGE TIERS (deprecated in terminal pivot) --- */}
        {false && (
        <section className="w-full py-20 border-t border-[#1A1A1A] flex flex-col items-center">
          <div className="max-w-6xl w-full px-6 mx-auto flex flex-col items-center">
            <div className="flex flex-col items-center text-center mb-12">
              <h2 className="text-2xl font-black text-white mb-4 tracking-[-0.05em] uppercase">Choose Your Workspace</h2>
              <div className="h-1.5 w-32 bg-[#4FFFC8] rounded-full mb-4" />
              <p className="text-slate-400 text-lg font-medium max-w-2xl">Customize the tools and layouts that match your trading style. Build views for stocks, meme coins, tokens, and prediction markets in one place.</p>
            </div>

            {/* Tier cards removed in terminal pivot */}
          </div>
        </section>
        )}

        {/* --- LIVE EVALUATION PROGRESS RIBBON (deprecated in terminal pivot) --- */}
        {false && (
        <section className="w-full py-10 border-t border-[#1A1A1A] overflow-hidden">
          <div className="flex flex-col items-center mb-6">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#4FFFC8] animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#4FFFC8]">Live Evaluation Progress</span>
              <span className="w-2 h-2 rounded-full bg-[#4FFFC8] animate-pulse" />
            </div>
          </div>

          {/* Scrolling Ribbon */}
          <div className="relative w-full overflow-hidden">
            {/* Fade edges */}
            <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[#050505] to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[#050505] to-transparent z-10 pointer-events-none" />

            {/* Evaluation payout ribbons removed in terminal pivot */}
          </div>
        </section>
        )}

        {/* --- WHAT YOU GET --- */}
        <section className="w-full py-16 border-t border-[#1A1A1A] flex flex-col items-center">
          <div className="max-w-4xl w-full px-6 mx-auto flex flex-col items-center">
            <h2 className="text-xl font-bold text-white mb-8">What you get</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
              <div className="p-6 bg-[#0a0a0a] border border-[#1A1A1A] rounded-xl text-center">
                <Monitor className="w-6 h-6 text-[#4FFFC8] mx-auto mb-4" strokeWidth={1.5} />
                <h3 className="text-sm font-semibold text-white mb-2">Unified terminal</h3>
                <p className="text-slate-500 text-sm">Unified live feed across predictions, RWAs, and Bags tokens with fast actions.</p>
              </div>
              <div className="p-6 bg-[#0a0a0a] border border-[#1A1A1A] rounded-xl text-center">
                <Grid3x3 className="w-6 h-6 text-[#4FFFC8] mx-auto mb-4" strokeWidth={1.5} />
                <h3 className="text-sm font-semibold text-white mb-2">Predictions explorer</h3>
                <p className="text-slate-500 text-sm">Browse and filter by category with real-time prices and volume.</p>
              </div>
              <div className="p-6 bg-[#0a0a0a] border border-[#1A1A1A] rounded-xl text-center">
                <Activity className="w-6 h-6 text-[#4FFFC8] mx-auto mb-4" strokeWidth={1.5} />
                <h3 className="text-sm font-semibold text-white mb-2">RWAs + Bags trading</h3>
                <p className="text-slate-500 text-sm">Trade tokenized RWAs via Dflow and Bags tokens via the Bags API.</p>
              </div>
            </div>
          </div>
        </section>

        {/* --- INTERACTIVE GRID BACKGROUND SECTION --- */}
        <InteractiveGridSection />

        {/* --- WALLET & VENUES --- */}
        <section className="w-full py-16 border-t border-[#1A1A1A] flex flex-col items-center">
          <div className="max-w-4xl w-full px-6 mx-auto flex flex-col items-center">
            <h2 className="text-xl font-bold text-white mb-8">Wallet-native, multi-venue</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
              <div className="p-6 bg-[#0a0a0a] border border-[#1A1A1A] rounded-xl text-center">
                <Lock className="w-6 h-6 text-[#4FFFC8] mx-auto mb-4" strokeWidth={1.5} />
                <h3 className="text-sm font-semibold text-white mb-2">Connect your wallet</h3>
                <p className="text-slate-500 text-sm">Phantom or Solflare. No account or password.</p>
              </div>
              <div className="p-6 bg-[#0a0a0a] border border-[#1A1A1A] rounded-xl text-center">
                <Globe className="w-6 h-6 text-[#4FFFC8] mx-auto mb-4" strokeWidth={1.5} />
                <h3 className="text-sm font-semibold text-white mb-2">One place, all venues</h3>
                <p className="text-slate-500 text-sm">Polymarket and Kalshi in a single terminal.</p>
              </div>
              <div className="p-6 bg-[#0a0a0a] border border-[#1A1A1A] rounded-xl text-center">
                <Shield className="w-6 h-6 text-[#4FFFC8] mx-auto mb-4" strokeWidth={1.5} />
                <h3 className="text-sm font-semibold text-white mb-2">You hold the keys</h3>
                <p className="text-slate-500 text-sm">We don’t custody funds. Your wallet, your control.</p>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* --- FOOTER --- */}
      <footer className="w-full py-16 border-t border-[#1A1A1A] flex flex-col items-center">
        <div className="max-w-6xl w-full px-6 flex flex-col items-center">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 mb-16 w-full text-center md:text-left">
            <div>
              <div className="flex items-center gap-3 mb-6 justify-center md:justify-start">
                <div className="text-xl font-black text-white tracking-tighter uppercase">Synq</div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#4FFFC8]" />
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto md:mx-0">One terminal for Polymarket and Kalshi. Connect your wallet and trade.</p>
            </div>
            
            <div>
              <div className="font-black text-white mb-6 text-[11px] uppercase tracking-[0.3em]">Protocol</div>
              <ul className="space-y-4 text-xs text-slate-500">
                <li><Link href="/markets" className="hover:text-[#4FFFC8] transition-colors">Live Markets</Link></li>
                <li><Link href="/terminal" className="hover:text-[#4FFFC8] transition-colors">Terminal</Link></li>
                <li><Link href="/stocks" className="hover:text-[#4FFFC8] transition-colors">RWAs</Link></li>
                <li><Link href="/bags" className="hover:text-[#4FFFC8] transition-colors">Bags</Link></li>
                <li><Link href="/leaderboard" className="hover:text-[#4FFFC8] transition-colors">Leaderboard</Link></li>
              </ul>
            </div>
            
            <div>
              <div className="font-black text-white mb-6 text-[11px] uppercase tracking-[0.3em]">Legal</div>
              <ul className="space-y-4 text-xs text-slate-500">
                <li><Link href="/risk-disclosure" className="hover:text-[#4FFFC8] transition-colors">Risk Disclosure</Link></li>
                <li><Link href="/terms-of-service" className="hover:text-[#4FFFC8] transition-colors">Terms of Service</Link></li>
                <li><Link href="/privacy-policy" className="hover:text-[#4FFFC8] transition-colors">Privacy Policy</Link></li>
              </ul>
            </div>
            
            <div>
              <div className="font-black text-white mb-6 text-[11px] uppercase tracking-[0.3em]">Connect</div>
              <ul className="space-y-4 text-xs text-slate-500">
                <li><Link href="/help-center" className="hover:text-[#4FFFC8] transition-colors">Help Center</Link></li>
                <li><Link href="/institutional-relations" className="hover:text-[#4FFFC8] transition-colors">Institutional Relations</Link></li>
                <li><Link href="/platform-support" className="hover:text-[#4FFFC8] transition-colors">Platform Support</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-[#1A1A1A] pt-10 w-full text-center">
            <p className="text-[11px] text-slate-600 font-bold uppercase tracking-[0.3em]">
              © {new Date().getFullYear()} Synq. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── INTERACTIVE GRID SECTION COMPONENT ───
function InteractiveGridSection() {
  return (
    <section className="w-full py-20 border-t border-[#1A1A1A] relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(to right, #4FFFC8 1px, transparent 1px),
            linear-gradient(to bottom, #4FFFC8 1px, transparent 1px)
          `,
          backgroundSize: '64px 64px',
        }}
      />
      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <h2 className="text-xl font-bold text-white mb-6">Everything Synq offers</h2>
        <p className="text-slate-500 text-sm max-w-lg mx-auto mb-10">
          One wallet-native platform for predictions, tokenized RWAs, and Bags tokens. Use the terminal for live activity and fast execution, or use each section to discover and trade.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Predictions', value: 'Polymarket · Kalshi' },
            { label: 'RWAs', value: 'Dflow trading + charts' },
            { label: 'Bags', value: 'Bags API swaps + pools' },
            { label: 'Terminal', value: 'Unified live feed' },
          ].map((item) => (
            <div
              key={item.label}
              className="p-4 rounded-lg bg-[#0a0a0a] border border-[#1A1A1A] text-center"
            >
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{item.label}</div>
              <div className="text-sm font-medium text-white">{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}