'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PortalLoaderProps {
  children: React.ReactNode;
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

export default function PortalLoader({ children }: PortalLoaderProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('Initializing');
  const [portalOpen, setPortalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [warpSpeed, setWarpSpeed] = useState(false);

  // Minimal starfield - just 30 stars
  const stars = useMemo(() => {
    return [...Array(30)].map((_, i) => ({
      id: i,
      x: Math.round(seededRandom(i) * 100),
      y: Math.round(seededRandom(i + 100) * 100),
      size: 1 + Math.round(seededRandom(i + 200) * 2),
      delay: seededRandom(i + 300) * 3,
    }));
  }, []);

  // Just 6 clean tunnel rings
  const rings = useMemo(() => {
    return [...Array(6)].map((_, i) => ({
      id: i,
      size: 200 + i * 80,
      delay: i * 0.4,
    }));
  }, []);

  const loadingMessages = [
    'Initializing',
    'Connecting to Polymarket',
    'Syncing Kalshi feeds',
    'Loading market data',
    'Warming up terminal',
    'Establishing WebSocket',
    'Ready',
  ];

  useEffect(() => {
    setMounted(true);

    // Skip the full animation on return visits — go straight to content
    const hasVisited = sessionStorage.getItem('prop-market-loaded');
    if (hasVisited) {
      setIsLoading(false);
      setProgress(100);
      return;
    }

    // First visit: show loader but cap at 4s (not 6-9s)
    const loadTime = 3500;
    const startTime = Date.now();
    let animationFrame: number;
    
    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const rawProgress = Math.min((elapsed / loadTime) * 100, 100);
      const easedProgress = 100 - Math.pow(1 - rawProgress / 100, 3) * 100;
      setProgress(easedProgress);
      
      const messageIndex = Math.min(
        Math.floor((easedProgress / 100) * loadingMessages.length),
        loadingMessages.length - 1
      );
      setLoadingText(loadingMessages[messageIndex]);
      
      if (rawProgress < 100) {
        animationFrame = requestAnimationFrame(updateProgress);
      } else {
        setWarpSpeed(true);
        setTimeout(() => {
          setPortalOpen(true);
          setTimeout(() => {
            setIsLoading(false);
            sessionStorage.setItem('prop-market-loaded', '1');
          }, 800);
        }, 400);
      }
    };

    // Prefetch critical data during animation
    fetch('/api/markets/trending?limit=9').catch(() => {});
    fetch('/api/terminal/feed').catch(() => {});
    
    animationFrame = requestAnimationFrame(updateProgress);
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  if (!mounted) return <>{children}</>;

  return (
    <>
      <AnimatePresence>
        {isLoading && (
          <motion.div
            className="fixed inset-0 z-[99999] bg-[#030303] flex flex-col items-center justify-center"
            style={{ minHeight: '100dvh' }}
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
          >
            {/* Clean Background - Single gradient orb */}
            <div className="absolute inset-0 overflow-hidden">
              <motion.div
                className="absolute left-1/2 top-[46%] md:top-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full"
                style={{
                  background: 'radial-gradient(circle, rgba(79,255,200,0.08) 0%, transparent 50%)',
                }}
                animate={{
                  scale: warpSpeed ? [1, 1.3, 1.5] : [1, 1.1, 1],
                  opacity: warpSpeed ? [0.3, 0.6, 0] : [0.2, 0.4, 0.2],
                }}
                transition={{
                  duration: warpSpeed ? 1.5 : 6,
                  ease: 'easeInOut',
                  repeat: warpSpeed ? 0 : Infinity,
                }}
              />
            </div>

            {/* Subtle Starfield */}
            <div className="absolute inset-0">
              {stars.map((star) => (
                <motion.div
                  key={star.id}
                  className="absolute rounded-full bg-white"
                  style={{
                    width: star.size,
                    height: star.size,
                    left: `${star.x}%`,
                    top: `${star.y}%`,
                  }}
                  animate={warpSpeed ? {
                    opacity: [0.3, 1, 0],
                    scale: [1, 4, 0],
                    x: [0, (50 - star.x) * 6],
                    y: [0, (50 - star.y) * 6],
                  } : {
                    opacity: [0.2, 0.6, 0.2],
                  }}
                  transition={warpSpeed ? {
                    duration: 1.2,
                    ease: 'easeIn',
                  } : {
                    duration: 3,
                    repeat: Infinity,
                    delay: star.delay,
                    ease: 'easeInOut',
                  }}
                />
              ))}
            </div>

            {/* Clean Tunnel Rings */}
            <div 
              className="absolute inset-0 flex items-center justify-center"
              style={{ perspective: '1200px' }}
            >
              {rings.map((ring) => (
                <motion.div
                  key={ring.id}
                  className="absolute rounded-full border border-[#4FFFC8]/20"
                  style={{
                    width: ring.size,
                    height: ring.size,
                  }}
                  initial={{ 
                    transform: 'translateZ(-800px) scale(0.3)',
                    opacity: 0,
                  }}
                  animate={warpSpeed ? {
                    transform: [
                      'translateZ(-800px) scale(0.3)',
                      'translateZ(400px) scale(2)',
                    ],
                    opacity: [0, 0.6, 0],
                  } : {
                    transform: [
                      'translateZ(-800px) scale(0.3)',
                      'translateZ(200px) scale(1)',
                    ],
                    opacity: [0, 0.3, 0],
                  }}
                  transition={{
                    duration: warpSpeed ? 1 : 4,
                    delay: ring.delay,
                    ease: warpSpeed ? 'easeIn' : 'linear',
                    repeat: warpSpeed ? 0 : Infinity,
                  }}
                />
              ))}
            </div>

            {/* Central Content */}
            <div className="relative z-10 flex flex-col items-center justify-center w-full px-4">
              {/* Main Portal */}
              <div className="relative mb-10 mx-auto flex items-center justify-center">
                {/* Outer glow */}
                <motion.div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full"
                  style={{
                    background: 'radial-gradient(circle, rgba(79,255,200,0.15) 0%, transparent 70%)',
                  }}
                  animate={{
                    scale: [1, 1.15, 1],
                    opacity: [0.5, 0.8, 0.5],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />

                {/* Portal Ring */}
                <motion.div
                  className="w-56 h-56 rounded-full relative flex items-center justify-center"
                  style={{
                    background: 'radial-gradient(circle, #0a0a0a 0%, #050505 100%)',
                    border: '1px solid rgba(79,255,200,0.3)',
                    boxShadow: `
                      0 0 40px rgba(79,255,200,0.2),
                      inset 0 0 40px rgba(79,255,200,0.05)
                    `,
                  }}
                  animate={portalOpen ? {
                    scale: [1, 1.3, 4],
                    opacity: [1, 0.7, 0],
                  } : warpSpeed ? {
                    scale: [1, 1.1, 0.95, 1.05],
                  } : {
                    scale: [1, 1.02, 1],
                  }}
                  transition={{
                    duration: portalOpen ? 1.2 : warpSpeed ? 0.4 : 4,
                    ease: 'easeInOut',
                  }}
                >
                  {/* Inner rotating ring */}
                  <motion.div
                    className="absolute inset-2 rounded-full border border-[#4FFFC8]/20"
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: portalOpen ? 0.5 : 8,
                      ease: 'linear',
                      repeat: portalOpen ? 0 : Infinity,
                    }}
                    style={{
                      borderStyle: 'dashed',
                    }}
                  />

                  {/* Center logo */}
                  <motion.div
                    animate={portalOpen ? {
                      scale: [1, 0.6, 0],
                      opacity: [1, 0.5, 0],
                      rotate: [0, -180],
                    } : {
                      scale: [1, 1.05, 1],
                    }}
                    transition={{
                      duration: portalOpen ? 1 : 2,
                      ease: 'easeInOut',
                    }}
                  >
                    <div className="w-16 h-16 bg-[#4FFFC8] rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(79,255,200,0.5)]">
                      <svg
                        className="w-8 h-8 text-black"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                        />
                      </svg>
                    </div>
                  </motion.div>
                </motion.div>

                {/* Progress Ring */}
                <svg
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 -rotate-90"
                  viewBox="0 0 100 100"
                >
                  <defs>
                    <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#4FFFC8" />
                      <stop offset="100%" stopColor="#7B61FF" />
                    </linearGradient>
                  </defs>
                  <circle
                    cx="50"
                    cy="50"
                    r="46"
                    fill="none"
                    stroke="rgba(79,255,200,0.1)"
                    strokeWidth="1.5"
                  />
                  <motion.circle
                    cx="50"
                    cy="50"
                    r="46"
                    fill="none"
                    stroke="url(#progressGrad)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray={289}
                    strokeDashoffset={289 - (289 * progress) / 100}
                    style={{
                      filter: 'drop-shadow(0 0 4px rgba(79,255,200,0.5))',
                    }}
                  />
                </svg>
              </div>

              {/* Text */}
              <motion.div
                className="text-center"
                animate={portalOpen ? { opacity: 0, y: -20 } : { opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-2">
                  Prop Market
                </h2>
                <p className="text-[#4FFFC8] text-xs font-bold uppercase tracking-[0.2em]">
                  {loadingText}
                  <span className="inline-block animate-pulse">...</span>
                </p>
              </motion.div>

              {/* Progress Bar */}
              <motion.div
                className="mt-8 w-64 h-1 bg-[#1A1A1A] rounded-full overflow-hidden"
                animate={portalOpen ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
                transition={{ duration: 0.3 }}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, #4FFFC8, #7B61FF)',
                    boxShadow: '0 0 10px rgba(79,255,200,0.4)',
                  }}
                />
              </motion.div>

              <motion.p
                className="mt-3 text-slate-500 text-xs font-mono"
                animate={portalOpen ? { opacity: 0 } : { opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                {Math.round(progress)}%
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ opacity: isLoading ? 0 : 1, transition: 'opacity 0.6s ease' }}>
        {children}
      </div>
    </>
  );
}
