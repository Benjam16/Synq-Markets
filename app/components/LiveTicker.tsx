'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Market } from '@/lib/types';

export default function LiveTicker() {
  const [markets, setMarkets] = useState<Market[]>([]);

  useEffect(() => {
    const loadMarkets = async () => {
      try {
        const res = await fetch('/api/markets');
        if (res.ok) {
          const data = await res.json();
          setMarkets((data.markets || []).slice(0, 10)); // Show top 10
        }
      } catch (error) {
        console.error('Failed to load markets:', error);
      }
    };

    loadMarkets();
    const interval = setInterval(loadMarkets, 10000); // Update every 10s
    return () => clearInterval(interval);
  }, []);

  if (markets.length === 0) {
    return null;
  }

  // Calculate total width for smooth infinite scroll
  const itemWidth = 350; // Approximate width per item
  const totalWidth = markets.length * itemWidth;

  return (
    <div className="bg-[#0f172a] border-b border-slate-800 overflow-hidden">
      <div className="flex">
        <motion.div
          className="flex gap-12 whitespace-nowrap"
          animate={{
            x: [0, -totalWidth],
          }}
          transition={{
            duration: 60, // 60 seconds for full loop - readable speed
            repeat: Infinity,
            ease: 'linear',
          }}
        >
          {[...markets, ...markets].map((market, idx) => (
            <div
              key={`${market.id}-${idx}`}
              className="flex items-center gap-4 px-8 py-3 border-r border-slate-800"
            >
              <span className="text-xs text-slate-400 uppercase tracking-wider">
                {market.provider === 'Kalshi' ? 'Kalshi' : 'Polymarket'}
              </span>
              <span className="text-sm text-[#e2e8f0] font-medium max-w-[250px] truncate">
                {market.name}
              </span>
              <span className="text-sm font-mono font-bold text-[#3b82f6]">
                ${market.price.toFixed(2)}
              </span>
              {market.change !== undefined && (
                <div className={`flex items-center gap-1 text-xs ${
                  market.change >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'
                }`}>
                  {market.change >= 0 ? (
                    <TrendingUp className="w-3 h-3" strokeWidth={1.5} />
                  ) : (
                    <TrendingDown className="w-3 h-3" strokeWidth={1.5} />
                  )}
                  <span>
                    {market.change >= 0 ? '+' : ''}{(market.change * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

