"use client";

import { memo, useMemo } from "react";
import { Market } from "@/lib/types";
import { Clock, Activity, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { motion } from "framer-motion";

interface DashboardMarketCardProps {
  market: Market;
  priceHistory?: Array<{ timestamp: string; price: number }>;
  onBuy: (market: Market, side: "yes" | "no") => void;
  onSelect?: (market: Market) => void;
  isSelected?: boolean;
  priceChange?: 'up' | 'down' | null;
}

function DashboardMarketCardComponent({
  market,
  priceHistory = [],
  onBuy,
  onSelect,
  isSelected = false,
  priceChange = null,
}: DashboardMarketCardProps) {
  const probability = useMemo(() => market.price * 100, [market.price]);
  const noProbability = useMemo(() => (1 - market.price) * 100, [market.price]);
  const daysUntilResolution = useMemo(() => {
    if (!market.resolutionDate) return null;
    return Math.ceil((new Date(market.resolutionDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }, [market.resolutionDate]);

  return (
    <motion.div
      onClick={() => onSelect?.(market)}
      whileHover={{ y: -2 }}
      className={`group relative p-6 rounded-xl bg-slate-950/50 backdrop-blur-md border border-white/5 transition-all cursor-pointer ${
        isSelected
          ? "border-[#4FFFC8] bg-[#0f0f0f]"
          : "bg-[#0f0f0f] hover:border-[#4FFFC8]"
      }`}
    >
      {/* Platform Badge - Top Right */}
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-bold text-white leading-tight tracking-tight line-clamp-2 pr-16">
          {market.name}
        </h3>
        <span className="text-xs px-2 py-0.5 rounded border font-medium bg-slate-900/50 text-slate-400 border-white/5 shrink-0">
          {market.provider?.toUpperCase() || 'MARKET'}
        </span>
      </div>

      {/* 2-Column Grid: Current Price & Probability */}
      <div className="grid grid-cols-2 gap-4 py-4 border-t border-white/5 mb-4">
        <div>
          <div className="text-xs text-slate-400 mb-1">Current Price</div>
          <motion.div
            key={market.price}
            initial={false}
            animate={{
              color: priceChange === 'up' ? '#10b981' : priceChange === 'down' ? '#ef4444' : '#4FFFC8',
              scale: priceChange ? [1, 1.1, 1] : 1,
            }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="text-2xl font-mono font-semibold"
          >
            ${market.price.toFixed(2)}
          </motion.div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-400 mb-1">Probability</div>
          <motion.div
            key={probability}
            initial={false}
            animate={{
              color: priceChange === 'up' ? '#10b981' : priceChange === 'down' ? '#ef4444' : 'white',
              scale: priceChange ? [1, 1.1, 1] : 1,
            }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="text-2xl font-mono font-semibold"
          >
            {probability.toFixed(0)}%
          </motion.div>
        </div>
      </div>

      {/* Yes/No Price Bars */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-[#10b981]"
              initial={{ width: 0 }}
              animate={{ width: `${probability}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <span className="text-xs font-mono font-semibold text-[#10b981] min-w-[45px] text-right">
            {probability.toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-[#ef4444] ml-auto"
              initial={{ width: 0 }}
              animate={{ width: `${noProbability}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <span className="text-xs font-mono font-semibold text-[#ef4444] min-w-[45px] text-right">
            {noProbability.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Yes/No Trading Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onBuy(market, "yes");
          }}
          className="flex items-center justify-center gap-2 py-3 px-4 bg-[#10b981] hover:bg-[#059669] text-white font-semibold rounded-lg transition-all text-sm"
        >
          <ArrowUpRight className="w-4 h-4" strokeWidth={1.5} />
          <span>YES</span>
          <span className="text-xs mono-number percentage">({probability.toFixed(0)}%)</span>
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onBuy(market, "no");
          }}
          className="flex items-center justify-center gap-2 py-3 px-4 bg-[#ef4444] hover:bg-[#dc2626] text-white font-semibold rounded-lg transition-all text-sm"
        >
          <ArrowDownRight className="w-4 h-4" strokeWidth={1.5} />
          <span>NO</span>
          <span className="text-xs mono-number percentage">({noProbability.toFixed(0)}%)</span>
        </button>
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between mt-4 text-xs text-slate-500 border-t border-white/5 pt-4">
        <div className="flex items-center gap-1">
          <Activity className="w-3 h-3" strokeWidth={1.5} />
          <span>Volume: N/A</span>
        </div>
        {daysUntilResolution !== null && (
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" strokeWidth={1.5} />
            <span>{daysUntilResolution}d</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

const DashboardMarketCard = memo(DashboardMarketCardComponent, (prevProps, nextProps) => {
  // Custom comparison for better performance
  return (
    prevProps.market.id === nextProps.market.id &&
    prevProps.market.price === nextProps.market.price &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.priceChange === nextProps.priceChange
  );
});

export default DashboardMarketCard;
