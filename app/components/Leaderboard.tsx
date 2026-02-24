"use client";

interface Leader {
  userId: number;
  tradingAlias?: string;
  userName?: string; // For backward compatibility
  currentEquity: number;
  startBalance?: number;
  roi: number;
  dailyReturn?: number; // For backward compatibility
  totalReturn?: number; // For backward compatibility
}

interface LeaderboardProps {
  leaders: Leader[];
}

export default function Leaderboard({ leaders }: LeaderboardProps) {
  return (
    <div className="bg-[#0f0f0f] rounded-lg border border-[#1A1A1A] p-6">
      <h2 className="text-xl font-bold text-[#e2e8f0] mb-4">Top Traders</h2>
      
      {leaders.length === 0 ? (
        <div className="text-center py-8 text-[#64748b]">
          No leaderboard data available
        </div>
      ) : (
        <div className="space-y-3">
          {leaders.map((leader, index) => {
            // Use tradingAlias if available, fallback to userName for backward compatibility
            const displayName = leader.tradingAlias || leader.userName || `Trader ${leader.userId}`;
            // Use roi if available, fallback to dailyReturn or totalReturn for backward compatibility
            const returnValue = leader.roi !== undefined ? leader.roi : (leader.dailyReturn !== undefined ? leader.dailyReturn : (leader.totalReturn || 0));
            
            return (
              <div
                key={leader.userId}
                className={`p-3 rounded-lg border ${
                  index === 0
                    ? "bg-gradient-to-r from-[#eab308]/10 to-[#facc15]/10 border-[#eab308]/30"
                    : index === 1
                    ? "bg-gradient-to-r from-[#64748b]/10 to-[#94a3b8]/10 border-[#64748b]/30"
                    : index === 2
                    ? "bg-gradient-to-r from-[#f59e0b]/10 to-[#fbbf24]/10 border-[#f59e0b]/30"
                    : "bg-[#1A1A1A] border-[#334155]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      index === 0
                        ? "bg-[#eab308] text-[#050505]"
                        : index === 1
                        ? "bg-[#64748b] text-white"
                        : index === 2
                        ? "bg-[#f59e0b] text-white"
                        : "bg-[#334155] text-[#94a3b8]"
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-semibold text-[#e2e8f0]">{displayName}</div>
                      <div className="text-xs text-[#64748b]">Equity: ${leader.currentEquity.toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-bold ${
                      returnValue >= 0 ? "text-[#10b981]" : "text-[#ef4444]"
                    }`}>
                      {returnValue >= 0 ? "+" : ""}{returnValue.toFixed(2)}%
                    </div>
                    <div className="text-xs text-[#64748b]">{leader.roi !== undefined ? "ROI" : "Today"}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

