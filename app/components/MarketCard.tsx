"use client";

import { memo } from "react";
import { Market } from "@/lib/types";
import { ExternalLink, ArrowUpRight, Plus, Check, Layers } from "lucide-react";

export interface ParlayLeg {
  marketId: string;
  provider: string;
  outcome: 'yes' | 'no';
  price: number;
  marketName: string;
  status: 'pending' | 'won' | 'lost';
}

interface MarketCardProps {
  market: Market;
  onBuy: (market: Market, side: "yes" | "no") => void;
  onSelect?: (market: Market) => void;
  isSelected?: boolean;
  previousPrice?: number;
  marketCount?: number;
  parlayMode?: boolean;
  parlayLegs?: ParlayLeg[];
}

function MarketCardComponent({
  market,
  onBuy,
  onSelect,
  isSelected = false,
  previousPrice,
  marketCount = 1,
  parlayMode = false,
  parlayLegs = [],
}: MarketCardProps) {
  const parlayLeg = parlayLegs.find(l => l.marketId === market.id);
  const inParlay = !!parlayLeg;
  // Get all outcomes from market data
  const getAllOutcomes = () => {
    // If market has explicit outcomes array with more than 2, show count
    if (market.outcomes && market.outcomes.length > 2) {
      return {
        hasMultiple: true,
        count: market.outcomes.length,
        topOutcomes: market.outcomes.slice(0, 2), // Show top 2 for preview
        allOutcomes: market.outcomes,
      };
    }
    
    // If market has exactly 2 outcomes, show both
    if (market.outcomes && market.outcomes.length === 2) {
      return {
        hasMultiple: false,
        count: 2,
        topOutcomes: market.outcomes,
        allOutcomes: market.outcomes,
      };
    }
    
    // For crypto "Up or Down" markets
    const nameLower = market.name.toLowerCase();
    if (nameLower.includes('up or down') || nameLower.includes('up/down')) {
      return {
        hasMultiple: false,
        count: 2,
        topOutcomes: [
          { name: 'Up', price: market.yesPrice ?? market.price },
          { name: 'Down', price: market.noPrice ?? (1 - market.price) },
        ],
        allOutcomes: [
          { name: 'Up', price: market.yesPrice ?? market.price },
          { name: 'Down', price: market.noPrice ?? (1 - market.price) },
        ],
      };
    }
    
    // Default to YES/NO for binary markets
    return {
      hasMultiple: false,
      count: 2,
      topOutcomes: [
        { name: 'YES', price: market.yesPrice ?? market.price },
        { name: 'NO', price: market.noPrice ?? (1 - market.price) },
      ],
      allOutcomes: [
        { name: 'YES', price: market.yesPrice ?? market.price },
        { name: 'NO', price: market.noPrice ?? (1 - market.price) },
      ],
    };
  };

  const outcomeInfo = getAllOutcomes();
  const firstPrice = outcomeInfo.topOutcomes[0]?.price || 0;
  const secondPrice = outcomeInfo.topOutcomes[1]?.price || 0;
  const probability = firstPrice * 100;

  // Format volume display
  const volumeDisplay = market.volumeFormatted || 
    (market.volume && market.volume > 0
      ? `$${(market.volume / 1000).toFixed(1)}k`
      : 'N/A');

  return (
    <div
      onClick={() => { if (!parlayMode) onSelect?.(market); }}
      className={`group relative bg-slate-950/50 backdrop-blur-md border rounded-md transition-all overflow-hidden ${
        parlayMode
          ? inParlay
            ? 'border-violet-500/50 ring-1 ring-violet-500/20 cursor-default'
            : 'border-white/5 hover:border-violet-500/20 cursor-default'
          : isSelected
          ? 'border-[#4FFFC8] ring-1 ring-[#4FFFC8]/20 cursor-pointer'
          : 'border-white/5 hover:border-white/10 hover:border-[#4FFFC8]/30 cursor-pointer'
      }`}
    >
      {/* Parlay indicator badge */}
      {parlayMode && inParlay && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/30">
          <Check className="w-2.5 h-2.5 text-violet-300" />
          <span className="text-[9px] text-violet-300 font-bold uppercase">{parlayLeg?.outcome}</span>
        </div>
      )}
      {/* Compact spacing - Professional look */}
      <div className="flex flex-col p-4">
        {/* Top Row: Image, Name, and Prices */}
        <div className="flex items-start gap-3 mb-3">
          {/* Market Image - Compact */}
          <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-slate-900/50 border border-white/5">
          {market.imageUrl ? (
            <img
              src={market.imageUrl}
              alt={market.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                // On image load failure, replace with a provider initial
                const el = e.target as HTMLImageElement;
                el.style.display = 'none';
                const parent = el.parentElement;
                if (parent && !parent.querySelector('.fallback-initial')) {
                  const fallback = document.createElement('div');
                  fallback.className = 'fallback-initial w-full h-full flex items-center justify-center text-xs font-bold ' +
                    (market.provider === 'Kalshi' ? 'text-emerald-400 bg-emerald-500/10' : 'text-blue-400 bg-blue-500/10');
                  fallback.textContent = market.provider === 'Kalshi' ? 'K' : 'P';
                  parent.appendChild(fallback);
                }
              }}
            />
          ) : (
            <div className={`w-full h-full flex items-center justify-center text-xs font-bold ${
              market.provider === 'Kalshi' ? 'text-emerald-400 bg-emerald-500/10' : 'text-blue-400 bg-blue-500/10'
            }`}>
              {market.provider === 'Kalshi' ? 'K' : 'P'}
            </div>
          )}
        </div>

          {/* Market Name - Compact, no clipping */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white leading-snug mb-1 line-clamp-2 break-words">
              {market.eventTitle || market.name}
            </h3>
            {market.marketType && market.marketType !== "Main" && (
              <p className="text-[10px] text-slate-500 mb-1">{market.marketType}</p>
            )}
          </div>

          {/* Prices - Right aligned - Compact */}
          <div className="flex-shrink-0 text-right">
            <div className="text-xs space-y-1">
              <div className="flex flex-col items-end gap-0.5">
                {/* For multi-choice markets, show top 2 outcomes + count (compact like before) */}
                {outcomeInfo.hasMultiple ? (
                  <>
                    {outcomeInfo.topOutcomes.map((outcome, idx) => (
                      <div key={idx}>
                        <span className="text-slate-400 text-[10px] mr-1">{outcome.name}</span>
                        <span className={`mono-number text-[10px] ${idx === 0 ? 'text-[#4FFFC8] font-bold' : 'text-slate-300'}`}>
                          ${outcome.price.toFixed(2)}
                        </span>
                      </div>
                    ))}
                    <div className="text-[9px] text-slate-500 mt-0.5">
                      +{outcomeInfo.count - 2} more
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <span className="text-slate-400 text-[10px] mr-1">{outcomeInfo.topOutcomes[0]?.name || 'YES'}</span>
                      <span className="text-[#4FFFC8] mono-number font-bold">${firstPrice.toFixed(2)}</span>
                    </div>
                    {outcomeInfo.topOutcomes[1] && (
                      <div>
                        <span className="text-slate-400 text-[10px] mr-1">{outcomeInfo.topOutcomes[1].name}</span>
                        <span className="text-slate-300 mono-number">${secondPrice.toFixed(2)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="text-[10px] text-slate-500 mt-1 mono-number whitespace-nowrap">
                {probability.toFixed(0)}%
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Row: Provider badge | Volume | Actions — no overlap */}
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5">
          {/* Provider Badge — fixed width, never wraps */}
          <div className="flex-shrink-0">
            {market.provider === 'Kalshi' ? (
              <span className="inline-flex items-center gap-1 text-[9px] leading-none px-1.5 py-[3px] rounded-full font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                <span className="w-1 h-1 rounded-full bg-emerald-400" />
                KALSHI
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[9px] leading-none px-1.5 py-[3px] rounded-full font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 whitespace-nowrap">
                <span className="w-1 h-1 rounded-full bg-blue-400" />
                POLY
              </span>
            )}
          </div>

          {/* Volume — fills remaining space */}
          <span className="text-[10px] text-slate-500 mono-number truncate min-w-0">
            {volumeDisplay}
          </span>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Actions — fixed right side */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {market.polymarketUrl && !parlayMode && (
              <a
                href={market.polymarketUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1 hover:bg-slate-800/50 rounded transition-colors"
                title={`View on ${market.provider || 'Polymarket'}`}
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 hover:text-[#4FFFC8]" strokeWidth={1.5} />
              </a>
            )}

            {parlayMode ? (
              inParlay ? (
                /* Already in slip — show which side was added */
                <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-500/20 border border-violet-500/30 text-violet-300 font-bold text-[10px] rounded-full whitespace-nowrap">
                  <Check className="w-3 h-3" />
                  Added
                </div>
              ) : (
                /* Parlay YES/NO quick buttons */
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); onBuy(market, 'yes'); }}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 font-bold text-[10px] rounded-full transition-all whitespace-nowrap"
                  >
                    <Plus className="w-2.5 h-2.5" />
                    YES
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onBuy(market, 'no'); }}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 font-bold text-[10px] rounded-full transition-all whitespace-nowrap"
                  >
                    <Plus className="w-2.5 h-2.5" />
                    NO
                  </button>
                </div>
              )
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect?.(market);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#4FFFC8]/10 hover:bg-[#4FFFC8]/20 border border-[#4FFFC8]/30 hover:border-[#4FFFC8]/50 text-[#4FFFC8] font-medium text-[10px] rounded-full transition-all whitespace-nowrap"
              >
                Trade
                <ArrowUpRight className="w-3 h-3" strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const MarketCard = memo(MarketCardComponent);

export default MarketCard;
