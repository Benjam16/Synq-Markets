"use client";

import { useEffect, useState } from "react";
import { TrendingUp, DollarSign, Clock, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";

interface WhaleTrade {
  id: string;
  provider: string;
  marketName: string;
  side: 'yes' | 'no';
  price: number;
  quantity: number;
  notional: number; // price * quantity
  timestamp: string;
}

export default function WhaleTracker() {
  const [whaleTrades, setWhaleTrades] = useState<WhaleTrade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadWhaleTrades = async () => {
      try {
        const res = await fetch("/api/whale-trades");
        if (res.ok) {
          const data = await res.json();
          setWhaleTrades(data.trades || []);
        }
      } catch (error) {
        console.error("Failed to load whale trades:", error);
      } finally {
        setLoading(false);
      }
    };

    loadWhaleTrades();
    // Refresh every 30 seconds
    const interval = setInterval(loadWhaleTrades, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className="bg-[#0F172A] border border-slate-800/50 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-[#4FFFC8]" strokeWidth={2} />
          <h3 className="text-lg font-semibold text-white">Whale Activity</h3>
        </div>
        <div className="text-center py-8 text-slate-400 text-sm">Loading whale trades...</div>
      </div>
    );
  }

  return (
    <div className="bg-[#0F172A] border border-slate-800/50 rounded-lg p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#4FFFC8]" strokeWidth={2} />
          <h3 className="text-lg font-semibold text-white">Whale Activity</h3>
        </div>
        <span className="text-xs text-slate-500">Large trades &gt;$10k</span>
      </div>

      {whaleTrades.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-slate-400 text-sm mb-2">No whale trades detected</div>
            <div className="text-xs text-slate-500">Monitoring for large institutional trades...</div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-3 max-h-[400px] pr-2">
          {whaleTrades.map((trade, index) => (
            <motion.div
              key={trade.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="p-3 bg-slate-900/30 border border-slate-800/50 rounded-lg hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      trade.provider.toLowerCase().includes('kalshi')
                        ? 'bg-[#10b981]/20 text-[#10b981]'
                        : 'bg-[#3b82f6]/20 text-[#3b82f6]'
                    }`}>
                      {trade.provider}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      trade.side === 'yes'
                        ? 'bg-[#10b981]/20 text-[#10b981]'
                        : 'bg-[#ef4444]/20 text-[#ef4444]'
                    }`}>
                      {trade.side.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-white truncate" title={trade.marketName}>
                    {trade.marketName}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="flex items-center gap-1 text-[#4FFFC8] font-mono font-bold text-sm">
                    <DollarSign className="w-3.5 h-3.5" strokeWidth={2} />
                    {trade.notional.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-1">
                  <span>Price:</span>
                  <span className="font-mono text-slate-300">${trade.price.toFixed(2)}</span>
                  <span className="text-slate-500">×</span>
                  <span className="font-mono text-slate-300">{trade.quantity.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" strokeWidth={2} />
                  <span>{formatTimeAgo(trade.timestamp)}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

