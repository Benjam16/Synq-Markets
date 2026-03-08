'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
  PieChart,
  Activity,
  CheckCircle2,
  Monitor,
  Grid3x3,
  DollarSign,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from './components/AuthProvider';
import { Market } from '@/lib/types';

export default function LandingPage() {
  const { user } = useAuth();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Prevent hydration mismatch
  useEffect(() => { setMounted(true); }, []);

  // Mouse-follow glow — throttled to 1 update per frame
  useEffect(() => {
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setMousePos({ x: e.clientX, y: e.clientY });
      });
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

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
    const interval = setInterval(loadMarkets, 15000);
    return () => { active = false; controller.abort(); clearInterval(interval); };
  }, []); // ← stable deps: runs once

  return (
    <div className="min-h-screen bg-[#050505] bg-radial-glow flex flex-col items-center overflow-x-hidden relative">
      
      {/* Mouse-follow glow */}
      <div
        className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-300"
        style={{
          background: `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, rgba(79,255,200,0.04), transparent 40%)`,
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
              <Link href="/" className="text-2xl font-black text-white tracking-tighter uppercase">Prop Market</Link>
            </div>
            
            <div className="hidden lg:flex items-center gap-10">
              <Link href="/markets" className="text-slate-400 hover:text-[#4FFFC8] font-bold text-xs uppercase tracking-widest">Markets</Link>
              <Link href="/terminal" className="text-slate-400 hover:text-[#4FFFC8] font-bold text-xs uppercase tracking-widest">Terminal</Link>
              {mounted && user ? (
                <Link href="/dashboard" className="px-8 py-3 bg-[#4FFFC8] text-black font-black rounded-full text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(79,255,200,0.3)]">Dashboard</Link>
              ) : (
                <div className="flex items-center gap-6">
                  <Link href="/login" className="text-white hover:text-[#4FFFC8] font-bold text-xs uppercase tracking-widest">Login</Link>
                  <Link href="/login" className="px-8 py-3 bg-[#4FFFC8] text-black font-black rounded-full text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(79,255,200,0.3)]">Get Started</Link>
                </div>
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
          {/* Animated Background Effects */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Large pulsing gradient orb - top left */}
            <motion.div
              className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(79,255,200,0.08) 0%, transparent 70%)',
              }}
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            
            {/* Secondary orb - bottom right */}
            <motion.div
              className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(123,97,255,0.06) 0%, transparent 70%)',
              }}
              animate={{
                scale: [1.2, 1, 1.2],
                opacity: [0.2, 0.5, 0.2],
              }}
              transition={{
                duration: 10,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: 2,
              }}
            />

            {/* Floating particles */}
            {[...Array(30)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 rounded-full bg-[#4FFFC8]"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
                animate={{
                  y: [0, -30, 0],
                  opacity: [0, 0.6, 0],
                  scale: [0, 1, 0],
                }}
                transition={{
                  duration: 3 + Math.random() * 4,
                  repeat: Infinity,
                  delay: Math.random() * 5,
                  ease: 'easeInOut',
                }}
              />
            ))}

            {/* Animated grid lines - subtle */}
            <div 
              className="absolute inset-0 opacity-[0.02]"
              style={{
                backgroundImage: `
                  linear-gradient(to right, #4FFFC8 1px, transparent 1px),
                  linear-gradient(to bottom, #4FFFC8 1px, transparent 1px)
                `,
                backgroundSize: '100px 100px',
              }}
            />

            {/* Diagonal light beams */}
            <motion.div
              className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-[#4FFFC8]/20 to-transparent"
              style={{ transform: 'rotate(25deg)', transformOrigin: 'top' }}
              animate={{
                opacity: [0.1, 0.3, 0.1],
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            <motion.div
              className="absolute top-0 right-1/3 w-px h-full bg-gradient-to-b from-transparent via-[#7B61FF]/15 to-transparent"
              style={{ transform: 'rotate(-20deg)', transformOrigin: 'top' }}
              animate={{
                opacity: [0.1, 0.25, 0.1],
              }}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: 1,
              }}
            />

            {/* Concentric circles - ripple effect */}
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#4FFFC8]/10"
                style={{
                  width: 300 + i * 200,
                  height: 300 + i * 200,
                }}
                animate={{
                  scale: [1, 1.1, 1],
                  opacity: [0.1, 0.3, 0.1],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  delay: i * 1.3,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-6xl w-full flex flex-col items-center text-center relative z-10"
          >
            <div className="inline-block px-4 py-1.5 rounded-full bg-[#0f0f0f]/80 border border-[#1A1A1A] text-[#4FFFC8] text-[8px] font-black tracking-[0.3em] uppercase mb-6">
              Onchain Multi‑Venue Trading Terminal
            </div>
            
            <h1 className="text-5xl md:text-6xl font-black text-white mb-8 leading-tight tracking-[-0.05em] uppercase">
              Trade Stocks, Memes,<br />
              <span className="text-gradient-cyan-indigo">Tokens & Prediction Markets</span>
            </h1>
            
            <p className="text-lg md:text-xl text-slate-400 mb-12 max-w-3xl leading-relaxed font-medium">
              Connect to Kalshi, Polymarket, and onchain venues from a single interface. Watch flows, prices, and opportunities update in real time across your entire watchlist.
            </p>
            
            <div className="flex flex-col md:flex-row gap-4 justify-center items-center w-full mb-8">
              <Link
                href={mounted && user ? "/terminal" : "/login"}
                className="w-full md:w-auto px-12 py-5 bg-[#4FFFC8] hover:bg-[#3debb8] text-black font-black rounded-full transition-all hover:scale-[1.02] shadow-[0_0_20px_rgba(79,255,200,0.3)] text-lg uppercase tracking-tighter flex items-center gap-3"
              >
                {mounted && user ? "Enter Terminal" : "Open Terminal"}
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </motion.div>

          {/* Floating Provider Badges */}
          <div className="hidden md:block absolute inset-0 pointer-events-none z-0">
            {/* Polymarket — left side */}
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute left-[6%] lg:left-[10%] top-[55%]"
            >
              <div className="flex items-center gap-3 px-5 py-3 bg-[#0a0a0a]/80 backdrop-blur-xl border border-[#1A1A1A] rounded-2xl shadow-lg">
                <div className="w-9 h-9 rounded-lg overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/polymarket-logo.svg" alt="Polymarket" className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white leading-tight">Polymarket</div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    <span className="text-[10px] text-blue-400 font-semibold">Live</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Kalshi — right side */}
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute right-[6%] lg:right-[10%] top-[60%]"
            >
              <div className="flex items-center gap-3 px-5 py-3 bg-[#0a0a0a]/80 backdrop-blur-xl border border-[#1A1A1A] rounded-2xl shadow-lg">
                <div className="w-9 h-9 rounded-lg overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/kalshi-logo.svg" alt="Kalshi" className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white leading-tight">Kalshi</div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] text-emerald-400 font-semibold">Live</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* --- LIVE MARKETS - Floating Cards with Live Dot --- */}
        <section className="w-full py-16 border-y border-[#1A1A1A] flex flex-col items-center">
          <div className="max-w-6xl w-full px-6 flex flex-col items-center">
            <div className="w-full flex flex-col items-center text-center mb-10 gap-6">
              <div className="text-center">
                <h2 className="text-2xl font-black text-white mb-4 tracking-tighter uppercase">Real-Time Feeds</h2>
                <p className="text-slate-400 text-xl font-medium">Synced institutional data from Polymarket & Kalshi protocols.</p>
              </div>
              <Link href="/markets" className="px-8 py-3 bg-transparent border border-[#1A1A1A] text-white font-bold rounded-full flex items-center gap-3 hover:border-[#4FFFC8]/30 hover:bg-[#4FFFC8]/5 transition-all tracking-widest uppercase text-xs">
                Browse Markets <ChevronRight className="w-5 h-5" />
              </Link>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
                {[...Array(9)].map((_, i) => (
                  <div key={i} className="h-32 card-floating rounded-xl animate-pulse" />
                ))}
              </div>
            ) : markets.length === 0 ? (
              <div className="w-full py-16 text-center text-slate-500">
                No live markets available right now. Check back in a few minutes or browse all markets.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
                {markets.slice(0, 9).map((market, idx) => (
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
            <div className="flex flex-col items-center text-center mb-12">
              <h2 className="text-2xl font-black text-white mb-4 tracking-[-0.05em] uppercase">Technical Advantages</h2>
              <div className="h-1.5 w-32 bg-[#4FFFC8] rounded-full mb-4" />
              <p className="text-slate-400 text-lg font-medium max-w-2xl">Institutional-grade infrastructure built for speed, clarity, and cross-market intelligence.</p>
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
                      <span className="text-[9px] text-slate-600 font-mono ml-2">PROP MARKET — LIVE TERMINAL</span>
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
                  {/* Markets Explorer Mockup */}
                  <div className="w-full aspect-[16/9] overflow-hidden border-b border-[#1A1A1A] bg-[#060606] p-4 group-hover:bg-[#080808] transition-colors">
                    {/* Search bar mockup */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex-1 h-7 rounded-full bg-white/[0.04] border border-[#1A1A1A] flex items-center px-3">
                        <span className="text-[10px] text-slate-600">🔍 Search markets...</span>
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
                      <h3 className="text-lg font-black text-white uppercase tracking-tighter">Markets Explorer</h3>
                    </div>
                    <p className="text-slate-400 text-sm font-medium leading-relaxed mb-4">
                      Browse thousands of live prediction markets across both platforms. Filter by category, track volume, 
                      and compare odds — with provider badges, images, and real-time probability updates on every card.
                    </p>
                    <div className="flex items-center gap-2 text-[#4FFFC8] text-sm font-bold uppercase tracking-wider">
                      Explore Markets <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            </div>
          </div>
        </section>

        {/* --- THE EVALUATION PROCESS --- */}
        <section className="w-full py-20 flex flex-col items-center">
          <div className="max-w-6xl w-full px-6 flex flex-col items-center">
            <div className="flex flex-col items-center text-center mb-12">
              <h2 className="text-2xl font-black text-white mb-4 tracking-[-0.05em] uppercase">Evaluation Process</h2>
              <div className="h-1.5 w-32 bg-[#4FFFC8] rounded-full mb-4" />
              <p className="text-slate-400 text-lg font-medium max-w-2xl">Proven paths to institutional liquidity.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 w-full relative">
              <div className="hidden md:block absolute top-12 left-1/4 right-1/4 h-px bg-[#1A1A1A]" />
              
              {/* STEP 1 */}
              <div className="flex flex-col items-center text-center group relative z-10">
                <div className="w-16 h-16 flex items-center justify-center mb-6">
                  <BarChart3 className="w-7 h-7 text-[#4FFFC8]" strokeWidth={1.5} />
                </div>
                <div className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] mb-3">PHASE 01</div>
                <h3 className="text-2xl font-black text-white mb-4 uppercase tracking-tighter">Evaluation</h3>
                <p className="text-slate-500 text-lg font-medium leading-relaxed">Demonstrate your predictive accuracy in a high-liquidity sandbox while following 5% risk caps.</p>
              </div>

              {/* STEP 2 */}
              <div className="flex flex-col items-center text-center group relative z-10">
                <div className="w-16 h-16 flex items-center justify-center mb-6">
                  <Shield className="w-7 h-7 text-[#4FFFC8]" strokeWidth={1.5} />
                </div>
                <div className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] mb-3">PHASE 02</div>
                <h3 className="text-2xl font-black text-white mb-4 uppercase tracking-tighter">Verification</h3>
                <p className="text-slate-500 text-sm font-medium leading-relaxed">Automated consistency auditing ensures your trading strategy is sustainable for institutional capital.</p>
              </div>

              {/* STEP 3 */}
              <div className="flex flex-col items-center text-center group relative z-10">
                <div className="w-16 h-16 flex items-center justify-center mb-6">
                  <Zap className="w-7 h-7 text-[#4FFFC8]" strokeWidth={1.5} />
                </div>
                <div className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] mb-3">PHASE 03</div>
                <h3 className="text-2xl font-black text-white mb-4 uppercase tracking-tighter">Funded</h3>
                <p className="text-slate-500 text-lg font-medium leading-relaxed">Unlock access to our master liquidity pool. Keep 80% of all monthly performance fees generated.</p>
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

        {/* --- PLATFORM PILLARS --- */}
        <section className="w-full py-20 border-t border-[#1A1A1A] flex flex-col items-center">
          <div className="max-w-6xl w-full px-6 mx-auto flex flex-col items-center">
            <div className="flex flex-col items-center text-center mb-12">
              <h2 className="text-2xl font-black text-white mb-4 tracking-[-0.05em] uppercase">The Prop Market Platform</h2>
              <div className="h-1.5 w-32 bg-[#4FFFC8] rounded-full mb-4" />
              <p className="text-slate-400 text-lg font-medium max-w-2xl">Built for the next generation of prediction market traders.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
              <div className="p-8 bg-[#0f0f0f]/80 border border-[#1A1A1A] rounded-xl hover:border-[#4FFFC8]/20 transition-colors text-center">
                <BarChart3 className="w-8 h-8 text-[#4FFFC8] mx-auto mb-6" strokeWidth={1.5} />
                <h3 className="text-xl font-black text-white mb-4 uppercase tracking-tighter">The Trading Terminal</h3>
                <p className="text-slate-500 text-sm font-medium leading-relaxed">
                  Experience a pro-grade command center built specifically for prediction markets. Our terminal features
                  high-density order books, real-time depth charts, and sub-second trade execution across global venues.
                  Designed for speed and clarity, it provides the institutional tools you need to stay ahead of the curve.
                </p>
              </div>

              <div className="p-8 bg-[#0f0f0f]/80 border border-[#1A1A1A] rounded-xl hover:border-[#4FFFC8]/20 transition-colors text-center">
                <PieChart className="w-8 h-8 text-[#4FFFC8] mx-auto mb-6" strokeWidth={1.5} />
                <h3 className="text-xl font-black text-white mb-4 uppercase tracking-tighter">Education &amp; Trading Strategy</h3>
                <p className="text-slate-500 text-sm font-medium leading-relaxed">
                  Bridging the gap between learning and earning. Our platform offers a structured educational path paired
                  with simulated funding challenges. Master risk management, hit your profit targets, and earn funded seats
                  without risking your own capital—the ultimate environment for professional growth.
                </p>
              </div>

              <div className="p-8 bg-[#0f0f0f]/80 border border-[#1A1A1A] rounded-xl hover:border-[#4FFFC8]/20 transition-colors text-center">
                <Activity className="w-8 h-8 text-[#4FFFC8] mx-auto mb-6" strokeWidth={1.5} />
                <h3 className="text-xl font-black text-white mb-4 uppercase tracking-tighter">Cross-Market &amp; Arbitrage</h3>
                <p className="text-slate-500 text-sm font-medium leading-relaxed">
                  Capitalize on market inefficiencies with our integrated arbitrage engine. We scan Polymarket and Kalshi
                  simultaneously to highlight live spread opportunities in real-time. Whether you&#39;re stringing together
                  complex parlay slips or executing cross-platform hedges, our engine ensures you capture the edge every time.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* --- INTERACTIVE GRID BACKGROUND SECTION --- */}
        <InteractiveGridSection />

        {/* --- INSTITUTIONAL ADVANTAGE --- */}
        <section className="w-full py-20 border-t border-[#1A1A1A] flex flex-col items-center">
          <div className="max-w-6xl w-full px-6 mx-auto flex flex-col items-center">
            <div className="flex flex-col items-center text-center mb-12">
              <h2 className="text-2xl font-black text-white mb-4 tracking-[-0.05em] uppercase">Institutional Grade</h2>
              <div className="h-1.5 w-32 bg-[#4FFFC8] rounded-full mb-4" />
              <p className="text-slate-400 text-lg font-medium max-w-2xl">Enterprise-level infrastructure for serious traders.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
              <div className="p-8 bg-[#0f0f0f]/80 border border-[#1A1A1A] rounded-xl hover:border-[#4FFFC8]/20 transition-colors text-center">
                <Shield className="w-8 h-8 text-[#4FFFC8] mx-auto mb-6" strokeWidth={1.5} />
                <h3 className="text-xl font-black text-white mb-4 uppercase tracking-tighter">Risk Shield</h3>
                <p className="text-slate-500 text-sm font-medium leading-relaxed">Automated 5% daily loss monitoring ensures your capital exposure is managed in real-time.</p>
              </div>
              <div className="p-8 bg-[#0f0f0f]/80 border border-[#1A1A1A] rounded-xl hover:border-[#4FFFC8]/20 transition-colors text-center">
                <Globe className="w-8 h-8 text-[#4FFFC8] mx-auto mb-6" strokeWidth={1.5} />
                <h3 className="text-xl font-black text-white mb-4 uppercase tracking-tighter">Global Liquidity</h3>
                <p className="text-slate-500 text-sm font-medium leading-relaxed">Direct unfiltered access to the most liquid event contracts across Polymarket protocols.</p>
              </div>
              <div className="p-8 bg-[#0f0f0f]/80 border border-[#1A1A1A] rounded-xl hover:border-[#4FFFC8]/20 transition-colors text-center">
                <CheckCircle2 className="w-8 h-8 text-[#4FFFC8] mx-auto mb-6" strokeWidth={1.5} />
                <h3 className="text-xl font-black text-white mb-4 uppercase tracking-tighter">Transparency</h3>
                <p className="text-slate-500 text-sm font-medium leading-relaxed">No hidden fees or complex payout windows. Your performance metrics are updated every 30 seconds.</p>
              </div>
              <div className="p-8 bg-[#0f0f0f]/80 border border-[#1A1A1A] rounded-xl hover:border-[#4FFFC8]/20 transition-colors text-center">
                <Filter className="w-8 h-8 text-[#4FFFC8] mx-auto mb-6" strokeWidth={1.5} />
                <h3 className="text-xl font-black text-white mb-4 uppercase tracking-tighter">Event Filtering</h3>
                <p className="text-slate-500 text-sm font-medium leading-relaxed">Sort through thousands of markets by category: Politics, Economics, Entertainment, and News.</p>
              </div>
              <div className="p-8 bg-[#0f0f0f]/80 border border-[#1A1A1A] rounded-xl hover:border-[#4FFFC8]/20 transition-colors text-center">
                <Lock className="w-8 h-8 text-[#4FFFC8] mx-auto mb-6" strokeWidth={1.5} />
                <h3 className="text-xl font-black text-white mb-4 uppercase tracking-tighter">Secure Escrow</h3>
                <p className="text-slate-500 text-sm font-medium leading-relaxed">Performance payouts are held in auditable secure accounts until the monthly clearing cycle completes.</p>
              </div>
              <div className="p-8 bg-[#0f0f0f]/80 border border-[#1A1A1A] rounded-xl hover:border-[#4FFFC8]/20 transition-colors text-center">
                <Zap className="w-8 h-8 text-[#4FFFC8] mx-auto mb-6" strokeWidth={1.5} />
                <h3 className="text-xl font-black text-white mb-4 uppercase tracking-tighter">Pro Terminal</h3>
                <p className="text-slate-500 text-sm font-medium leading-relaxed">Advanced institutional dashboard with deep position tracking, trade history, and equity analytics.</p>
              </div>
            </div>
          </div>
        </section>

        {/* --- BOTTOM FIXED CTA: ACCESS FUNDING --- */}
        <div className="fixed bottom-4 left-0 right-0 z-40 flex justify-center pointer-events-none px-4">
          <Link
            href="/challenges"
            className="pointer-events-auto inline-flex items-center gap-3 px-10 py-4 bg-[#4FFFC8] text-black font-black rounded-full shadow-[0_0_24px_rgba(79,255,200,0.4)] text-xs md:text-sm uppercase tracking-[0.2em]"
          >
            Access Funding <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
          </Link>
        </div>
      </main>

      {/* --- FOOTER --- */}
      <footer className="w-full py-16 border-t border-[#1A1A1A] flex flex-col items-center">
        <div className="max-w-6xl w-full px-6 flex flex-col items-center">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 mb-16 w-full text-center md:text-left">
            <div>
              <div className="flex items-center gap-3 mb-6 justify-center md:justify-start">
                <div className="text-xl font-black text-white tracking-tighter uppercase">Prop Market</div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#4FFFC8]" />
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto md:mx-0">Empowering the predictive elite with institutional liquidity and world-class analytics.</p>
            </div>
            
            <div>
              <div className="font-black text-white mb-6 text-[11px] uppercase tracking-[0.3em]">Protocol</div>
              <ul className="space-y-4 text-xs text-slate-500">
                <li><Link href="/challenges" className="hover:text-[#4FFFC8] transition-colors">Evaluation Tiers</Link></li>
                <li><Link href="/markets" className="hover:text-[#4FFFC8] transition-colors">Live Markets</Link></li>
                <li><Link href="/dashboard" className="hover:text-[#4FFFC8] transition-colors">Trader Dashboard</Link></li>
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
              © {new Date().getFullYear()} Prop Market Ltd. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── INTERACTIVE GRID SECTION COMPONENT ───
function InteractiveGridSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [localMouse, setLocalMouse] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  // Track scroll position relative to this section
  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current) return;
      
      const rect = sectionRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const sectionHeight = rect.height;
      
      // Calculate how much of the section is in view (0 to 1)
      const topVisible = Math.max(0, windowHeight - rect.top);
      const bottomVisible = Math.max(0, rect.bottom);
      const visibleHeight = Math.min(topVisible, bottomVisible, sectionHeight);
      
      // Progress is strongest when section is centered in viewport
      const centerOffset = Math.abs((rect.top + sectionHeight / 2) - windowHeight / 2);
      const maxOffset = windowHeight / 2 + sectionHeight / 2;
      const progress = 1 - Math.min(centerOffset / maxOffset, 1);
      
      setScrollProgress(progress);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Track mouse position within the section
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!sectionRef.current) return;
    const rect = sectionRef.current.getBoundingClientRect();
    setLocalMouse({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  // Calculate dynamic opacity based on scroll and hover
  const baseOpacity = 0.03 + (scrollProgress * 0.12); // 0.03 to 0.15
  const hoverBoost = isHovering ? 0.08 : 0;
  const gridOpacity = baseOpacity + hoverBoost;

  return (
    <section
      ref={sectionRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className="w-full py-32 border-t border-[#1A1A1A] relative overflow-hidden"
    >
      {/* Animated Grid Background */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Base grid - always visible but dim */}
        <div
          className="absolute inset-0 transition-opacity duration-500"
          style={{
            opacity: gridOpacity,
            backgroundImage: `
              linear-gradient(to right, #4FFFC8 1px, transparent 1px),
              linear-gradient(to bottom, #4FFFC8 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />
        
        {/* Mouse-following spotlight effect */}
        {isHovering && (
          <motion.div
            className="absolute pointer-events-none"
            animate={{
              x: localMouse.x - 200,
              y: localMouse.y - 200,
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{
              width: 400,
              height: 400,
              background: 'radial-gradient(circle, rgba(79,255,200,0.15) 0%, transparent 70%)',
            }}
          />
        )}
        
        {/* Pulsing grid nodes at intersections */}
        <div className="absolute inset-0" style={{ opacity: gridOpacity * 1.5 }}>
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-[#4FFFC8]"
              style={{
                left: `${(i % 5) * 20 + 10}%`,
                top: `${Math.floor(i / 5) * 25 + 12}%`,
              }}
              animate={{
                opacity: [0.2, 0.8, 0.2],
                scale: [1, 1.5, 1],
              }}
              transition={{
                duration: 2 + (i % 3),
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
        </div>
        
        {/* Horizontal scan line */}
        <motion.div
          className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#4FFFC8] to-transparent"
          animate={{
            top: ['0%', '100%', '0%'],
            opacity: [0, 0.3, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#4FFFC8]/5 border border-[#4FFFC8]/20 mb-6">
            <Grid3x3 className="w-4 h-4 text-[#4FFFC8]" />
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#4FFFC8]">Live Infrastructure</span>
          </div>
          
          <h2 className="text-3xl md:text-4xl font-black text-white mb-6 tracking-tight uppercase">
            The Technology <span className="text-[#4FFFC8]">Backbone</span>
          </h2>
          
          <p className="text-slate-400 text-lg max-w-2xl mx-auto mb-12 leading-relaxed">
            Every trade flows through our distributed grid. Hover to illuminate the network. 
            Scroll to see the infrastructure pulse with live market data.
          </p>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: 'Latency', value: '<50ms', desc: 'Round-trip' },
              { label: 'Uptime', value: '99.99%', desc: 'SLA Guaranteed' },
              { label: 'Markets', value: '5,000+', desc: 'Live Contracts' },
              { label: 'Throughput', value: '10K+', desc: 'Trades/Second' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-6 rounded-xl bg-[#0a0a0a]/60 border border-[#1A1A1A] backdrop-blur-sm hover:border-[#4FFFC8]/20 transition-colors"
              >
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
                  {stat.label}
                </div>
                <div className="text-2xl font-black text-white mb-1">{stat.value}</div>
                <div className="text-[10px] text-slate-600 uppercase tracking-wider">{stat.desc}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}