'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet } from '@solana/wallet-adapter-react';

interface PortalLoaderProps {
  children: React.ReactNode;
}

const BOOT_LINES = [
  '[OK] INITIALIZING DFLOW LIQUIDITY LAYER...',
  '[OK] SYNCING KALSHI ORDERBOOKS...',
  '[OK] FETCHING PYTH ORACLE PRICE FEEDS (STOCKS)...',
  '[OK] VERIFYING ON-CHAIN KILL-LOGIC RULES...',
  '[OK] BINDING WALLET ADAPTER...',
  '[OK] LOADING PREDICTION MARKETS INDEX...',
  '[OK] ESTABLISHING WEBSOCKET FEEDS...',
  '[OK] CACHE WARM...',
];

const GRID_FRAGMENTS = [
  '$NVDA', '$SOL', '$BTC', '$ETH', '$TSLA', '$AAPL', '$MSTR', '$COIN',
  '0x4f...', '0x7b...', '0xa1...', '0x2c...', '0x8f...', '0x1e...',
  'KALSHI', 'POLY', 'PYTH', 'DFLOW',
];

const GRID_SIZE = 12;
const CELL_COUNT = GRID_SIZE * GRID_SIZE;

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

export default function PortalLoader({ children }: PortalLoaderProps) {
  const { connected } = useWallet();
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [stage, setStage] = useState<'boot' | 'grid' | 'heartbeat' | 'out'>('boot');
  const [portalOpen, setPortalOpen] = useState(false);
  const [filledCells, setFilledCells] = useState<Set<number>>(new Set());
  const [volumeDisplay, setVolumeDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);
  const gridStartRef = useRef<number>(0);
  const startedRef = useRef(false);

  const finishLoading = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setStage('out');
    setPortalOpen(true);
    setTimeout(() => {
      setIsLoading(false);
      sessionStorage.setItem('synq-loaded', '1');
    }, 600);
  }, []);

  // Return visit: skip loader. Otherwise run stage logic once (give wallet 100ms to restore).
  useEffect(() => {
    setMounted(true);
    const hasVisited = sessionStorage.getItem('synq-loaded');
    if (hasVisited) {
      setIsLoading(false);
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    let cleanup: (() => void) | undefined;
    const startStages = () => {
      // Authenticated: go straight to Market Heartbeat for 0.2s (prefetch in background)
      if (connected) {
        setStage('heartbeat');
        fetch('/api/markets/trending?limit=9').catch(() => {});
        fetch('/api/terminal/feed').catch(() => {});
        const targetVolume = 2847650 + Math.floor(Math.random() * 500000);
        const start = Date.now();
        const tick = () => {
          const elapsed = Date.now() - start;
          if (elapsed >= 200) {
            setVolumeDisplay(targetVolume);
            finishLoading();
            return;
          }
          setVolumeDisplay(Math.floor((elapsed / 200) * targetVolume));
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // Stage 1: Verbose Boot — show for 0.5s then go to grid
      setStage('boot');
      const toGrid = setTimeout(() => {
        setStage('grid');
        gridStartRef.current = Date.now();
      }, 500);
      cleanup = () => clearTimeout(toGrid);
    };

    const t = setTimeout(startStages, 100);
    return () => {
      clearTimeout(t);
      cleanup?.();
    };
  }, [connected, finishLoading]);

  // Grid stage: run fetches and fill cells
  useEffect(() => {
    if (stage !== 'grid' || !mounted) return;

    const minGridTime = 1200;
    const maxGridTime = 4500;
    const startTime = Date.now();
    let marketsDone = false;
    let feedDone = false;

    const checkDone = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed >= maxGridTime) {
        finishLoading();
        return;
      }
      if (marketsDone && feedDone && elapsed >= minGridTime) {
        finishLoading();
        return;
      }
    };

    fetch('/api/markets/trending?limit=9')
      .then(() => { marketsDone = true; checkDone(); })
      .catch(() => { marketsDone = true; checkDone(); });
    fetch('/api/terminal/feed')
      .then(() => { feedDone = true; checkDone(); })
      .catch(() => { feedDone = true; checkDone(); });

    // Fill grid cells randomly over time
    const fillInterval = setInterval(() => {
      setFilledCells((prev) => {
        if (prev.size >= CELL_COUNT) return prev;
        const next = new Set(prev);
        const pool: number[] = [];
        for (let i = 0; i < CELL_COUNT; i++) if (!next.has(i)) pool.push(i);
        if (pool.length === 0) return prev;
        const idx = pool[Math.floor(seededRandom(Date.now() + next.size) * pool.length)];
        next.add(idx);
        return next;
      });
    }, 35);

    return () => clearInterval(fillInterval);
  }, [stage, mounted, finishLoading]);

  if (!mounted) return <>{children}</>;

  return (
    <>
      <AnimatePresence>
        {isLoading && (
          <motion.div
            className="fixed inset-0 z-[99999] bg-[#030303] flex flex-col items-center justify-center overflow-hidden"
            style={{ minHeight: '100dvh' }}
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
          >
            {/* ——— Stage 1: Verbose Boot ——— */}
            <AnimatePresence mode="wait">
              {stage === 'boot' && (
                <motion.div
                  key="boot"
                  className="absolute inset-0 flex flex-col justify-end pb-8 px-6"
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.25 } }}
                >
                  <div
                    className="font-mono text-[11px] md:text-xs text-[#4FFFC8]/90 space-y-0.5 overflow-hidden max-h-[70vh] portal-crt-flicker"
                    style={{ fontFamily: 'var(--font-geist-mono), monospace' }}
                    aria-live="polite"
                  >
                    {BOOT_LINES.map((line, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06, duration: 0.1 }}
                      >
                        {line}
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ——— Stage 2: Grid Reconstruction ——— */}
            <AnimatePresence mode="wait">
              {stage === 'grid' && (
                <motion.div
                  key="grid"
                  className="absolute inset-0 flex items-center justify-center p-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Scanline */}
                  <motion.div
                    className="absolute left-0 right-0 h-px bg-[#4FFFC8]/30 pointer-events-none z-10"
                    initial={{ top: 0 }}
                    animate={{ top: '100%' }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
                    style={{ boxShadow: '0 0 12px rgba(79,255,200,0.4)' }}
                  />
                  {/* Grid */}
                  <div
                    className="grid gap-0.5 md:gap-1"
                    style={{
                      gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
                      width: 'min(90vmin, 420px)',
                      aspectRatio: '1',
                    }}
                  >
                    {Array.from({ length: CELL_COUNT }, (_, i) => {
                      const filled = filledCells.has(i);
                      const fragment = filled
                        ? GRID_FRAGMENTS[i % GRID_FRAGMENTS.length]
                        : '';
                      return (
                        <motion.div
                          key={i}
                          className="border border-[#1A1A1A] rounded-[2px] flex items-center justify-center text-[8px] md:text-[10px] font-mono text-[#4FFFC8]/80 bg-[#0a0a0a] overflow-hidden"
                          initial={{ opacity: 0.6 }}
                          animate={{
                            opacity: filled ? 1 : 0.5,
                            backgroundColor: filled ? 'rgba(79,255,200,0.06)' : 'rgba(10,10,10,0.9)',
                            borderColor: filled ? 'rgba(79,255,200,0.25)' : '#1A1A1A',
                          }}
                          transition={{ duration: 0.2 }}
                          style={{ fontFamily: 'var(--font-geist-mono), monospace' }}
                        >
                          {fragment}
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ——— Stage 3: Market Heartbeat (authenticated) ——— */}
            <AnimatePresence mode="wait">
              {stage === 'heartbeat' && (
                <motion.div
                  key="heartbeat"
                  className="absolute inset-0 flex flex-col items-center justify-center"
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Blurred dark terminal-style background */}
                  <div
                    className="absolute inset-0 bg-[#050505]"
                    style={{
                      backgroundImage: `
                        linear-gradient(180deg, rgba(79,255,200,0.03) 0%, transparent 40%),
                        linear-gradient(90deg, #0a0a0a 0%, #050505 50%, #0a0a0a 100%)
                      `,
                    }}
                  />
                  <div className="absolute inset-0 backdrop-blur-[2px]" />

                  {/* EKG line */}
                  <div className="relative w-full max-w-2xl h-24 flex items-center justify-center overflow-hidden">
                    <svg
                      className="absolute w-full h-full"
                      viewBox="0 0 400 80"
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <linearGradient id="ekgGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#10b981" />
                          <stop offset="50%" stopColor="#10b981" />
                          <stop offset="50%" stopColor="#ef4444" />
                          <stop offset="100%" stopColor="#ef4444" />
                        </linearGradient>
                      </defs>
                      <motion.path
                        d="M0,40 L40,40 L50,20 L60,60 L70,40 L120,40 L130,35 L140,45 L150,40 L200,40 L210,50 L220,30 L230,40 L280,40 L290,38 L300,42 L310,40 L360,40 L400,40"
                        fill="none"
                        stroke="url(#ekgGrad)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeDasharray="400"
                        initial={{ strokeDashoffset: 400 }}
                        animate={{ strokeDashoffset: 0 }}
                        transition={{ duration: 0.18, ease: 'linear' }}
                        style={{ filter: 'drop-shadow(0 0 4px rgba(16,185,129,0.6))' }}
                      />
                    </svg>
                  </div>

                  {/* 24h Volume counter */}
                  <motion.p
                    className="relative z-10 mt-4 font-mono text-lg text-[#4FFFC8] tabular-nums"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.05 }}
                    style={{ fontFamily: 'var(--font-geist-mono), monospace' }}
                  >
                    24h Vol <span className="text-white">${volumeDisplay.toLocaleString()}</span>
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ——— Exit: warp / portal open ——— */}
            {stage === 'out' && (
              <motion.div
                className="absolute inset-0 bg-[#030303]"
                initial={{ opacity: 1 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ opacity: isLoading ? 0 : 1, transition: 'opacity 0.6s ease' }}>
        {children}
      </div>
    </>
  );
}
