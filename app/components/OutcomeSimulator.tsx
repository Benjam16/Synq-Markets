"use client";

import { useState } from "react";

interface OutcomeSimulatorProps {
  currentPrice: number;
}

export default function OutcomeSimulator({ currentPrice }: OutcomeSimulatorProps) {
  const [quantity, setQuantity] = useState(1000);
  const [entryPrice, setEntryPrice] = useState(currentPrice);
  const [outcome, setOutcome] = useState<"yes" | "no">("yes");

  const cost = entryPrice * quantity;
  const profitIfYes = outcome === "yes" ? (1 - entryPrice) * quantity : -cost;
  const profitIfNo = outcome === "no" ? entryPrice * quantity : -cost;
  const roi = outcome === "yes" ? ((1 - entryPrice) / entryPrice) * 100 : (entryPrice / (1 - entryPrice)) * 100;

  return (
    <div className="p-4 bg-[#161b22] rounded-xl border border-[#30363d]">
      <h3 className="text-lg font-bold text-[#c9d1d9] mb-4">Outcome Simulator</h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Entry Price
          </label>
          <input
            type="number"
            min="0.01"
            max="0.99"
            step="0.01"
            value={entryPrice}
            onChange={(e) => setEntryPrice(Number(e.target.value))}
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-[#c9d1d9] focus:outline-none focus:border-[#58a6ff]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Quantity (contracts)
          </label>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-[#c9d1d9] focus:outline-none focus:border-[#58a6ff]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Position
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setOutcome("yes")}
              className={`flex-1 py-2 rounded-lg font-semibold transition-all ${
                outcome === "yes"
                  ? "bg-[#00ff88] text-[#0d1117]"
                  : "bg-[#0d1117] border border-[#30363d] text-gray-400 hover:border-[#00ff88]"
              }`}
            >
              YES
            </button>
            <button
              onClick={() => setOutcome("no")}
              className={`flex-1 py-2 rounded-lg font-semibold transition-all ${
                outcome === "no"
                  ? "bg-[#ff0040] text-white"
                  : "bg-[#0d1117] border border-[#30363d] text-gray-400 hover:border-[#ff0040]"
              }`}
            >
              NO
            </button>
          </div>
        </div>

        <div className="pt-4 border-t border-[#30363d] space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-gray-400">Cost</span>
            <span className="text-sm font-semibold text-[#c9d1d9]">${cost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
          
          <div className="p-3 bg-[#0d1117] rounded-lg border border-[#30363d]">
            <div className="text-xs text-gray-500 mb-2">If {outcome.toUpperCase()} resolves:</div>
            <div className={`text-xl font-bold ${
              (outcome === "yes" ? profitIfYes : profitIfNo) >= 0 ? "text-[#00ff88]" : "text-[#ff0040]"
            }`}>
              ${(outcome === "yes" ? profitIfYes : profitIfNo).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              ROI: {roi.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

