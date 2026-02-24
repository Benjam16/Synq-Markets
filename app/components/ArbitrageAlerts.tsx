"use client";

import { useEffect, useState } from "react";
import { Zap, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { scanArbitrageOpportunities, ArbitrageOpportunity } from "@/lib/arbitrage-scanner";
import { Market } from "@/lib/types";

export default function ArbitrageAlerts() {
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOpportunities = async () => {
      try {
        const res = await fetch("/api/markets?limit=100");
        if (res.ok) {
          const data = await res.json();
          const markets: Market[] = data.markets || [];
          const found = scanArbitrageOpportunities(markets);
          setOpportunities(found);
        }
      } catch (error) {
        console.error("Failed to load arbitrage opportunities:", error);
      } finally {
        setLoading(false);
      }
    };

    loadOpportunities();
    const interval = setInterval(loadOpportunities, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-[#0F172A] border border-slate-800/50 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-[#4FFFC8]" strokeWidth={2} />
          <h3 className="text-lg font-semibold text-white">Arbitrage Alerts</h3>
        </div>
        <div className="text-center py-8 text-slate-400 text-sm">Scanning markets...</div>
      </div>
    );
  }

  return (
    <div className="bg-[#0F172A] border border-slate-800/50 rounded-lg p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-[#4FFFC8]" strokeWidth={2} />
          <h3 className="text-lg font-semibold text-white">Arbitrage Alerts</h3>
        </div>
        <span className="text-xs text-slate-500">Price diff &gt;3%</span>
      </div>

      {opportunities.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-slate-400 text-sm mb-2">No arbitrage opportunities</div>
            <div className="text-xs text-slate-500">Markets are efficiently priced</div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-3 max-h-[400px] pr-2">
          {opportunities.map((opp, index) => (
            <div
              key={index}
              className="p-4 bg-slate-900/30 border border-[#4FFFC8]/20 rounded-lg hover:border-[#4FFFC8]/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white mb-2 line-clamp-2">
                    {opp.marketName}
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-slate-500">Kalshi:</span>
                      <span className="font-mono text-[#10b981]">${opp.kalshiPrice.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-500">Polymarket:</span>
                      <span className="font-mono text-[#3b82f6]">${opp.polymarketPrice.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-lg font-bold font-mono text-[#4FFFC8]">
                    +{opp.priceDifferencePercent.toFixed(1)}%
                  </div>
                  <div className="text-xs text-slate-500">Difference</div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800/50">
                <div className="flex items-center gap-2">
                  {opp.opportunity === 'buy-kalshi-sell-polymarket' ? (
                    <>
                      <TrendingUp className="w-4 h-4 text-[#10b981]" strokeWidth={2} />
                      <span className="text-xs text-slate-400">Buy Kalshi, Sell Polymarket</span>
                    </>
                  ) : (
                    <>
                      <TrendingDown className="w-4 h-4 text-[#3b82f6]" strokeWidth={2} />
                      <span className="text-xs text-slate-400">Buy Polymarket, Sell Kalshi</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <DollarSign className="w-3.5 h-3.5" strokeWidth={2} />
                  <span>~${opp.potentialProfit}/$1k</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

