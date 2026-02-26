"use client";

import { useEffect, useState } from "react";
import { Share2, TrendingUp, Trophy, Copy, Check } from "lucide-react";
import { motion } from "framer-motion";

type ViewMode = "global" | "per-market";

interface Leader {
  userId: number;
  tradingAlias: string;
  currentEquity: number;
  startBalance: number;
  roi: number;
}

export default function LeaderboardPage() {
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("global");

  useEffect(() => {
    const loadLeaderboard = async () => {
      try {
        const res = await fetch("/api/leaderboard");
        if (res.ok) {
          const data = await res.json();
          setLeaders(data.leaders || []);
        }
      } catch (error) {
        console.error("Failed to load leaderboard:", error);
      } finally {
        setLoading(false);
      }
    };
    loadLeaderboard();
  }, []);

  const generateShareText = (leader?: Leader) => {
    if (leader) {
      return `🏆 Check out ${leader.tradingAlias} on the Prop Market Leaderboard! ${leader.roi.toFixed(2)}% ROI! 🚀\n\nView the full leaderboard: ${typeof window !== 'undefined' ? window.location.origin : ''}/leaderboard`;
    }
    return `🏆 Check out the Prop Market Leaderboard! Top traders competing for the best ROI! 🚀\n\nView the leaderboard: ${typeof window !== 'undefined' ? window.location.origin : ''}/leaderboard`;
  };

  const handleShare = async (leader?: Leader) => {
    const text = generateShareText(leader);
    const url = typeof window !== 'undefined' ? window.location.href : '';
    
    // Try native share API first
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Prop Market Leaderboard',
          text: text,
          url: url,
        });
        return;
      } catch (err) {
        // User cancelled or error, fall through to copy
      }
    }

    // Fallback: Copy to clipboard
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleTwitterShare = (leader?: Leader) => {
    const text = generateShareText(leader);
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitterUrl, '_blank', 'width=550,height=420');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-grid-trading flex items-center justify-center">
        <div className="text-slate-400">Loading leaderboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-grid-trading">
      <main className="pt-24">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-12">
          {/* Header */}
          <div className="mb-12 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Trophy className="w-8 h-8 text-[#4FFFC8]" strokeWidth={2} />
              <h1 className="text-4xl font-bold text-white tracking-tight">Leaderboard</h1>
            </div>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Top traders ranked by Return on Investment (ROI)
            </p>
          </div>

          {/* Capsule Toggle - Global vs Per Market */}
          <div className="mb-8 flex justify-center">
            <div className="inline-flex p-1 rounded-full bg-[#0f0f0f]/80 border border-[#1A1A1A]">
              <button
                onClick={() => setViewMode("global")}
                className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${
                  viewMode === "global"
                    ? "tab-capsule-active"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Global
              </button>
              <button
                onClick={() => setViewMode("per-market")}
                className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${
                  viewMode === "per-market"
                    ? "tab-capsule-active"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Per Market
              </button>
            </div>
          </div>

          {/* Share Button */}
          <div className="mb-8 flex justify-center">
            <button
              onClick={() => handleShare()}
              className="flex items-center gap-2 px-6 py-3 bg-[#4FFFC8] hover:bg-[#3debb8] text-black font-bold rounded-full transition-all shadow-[0_0_20px_rgba(79,255,200,0.3)]"
            >
              {copied ? (
                <>
                  <Check className="w-5 h-5" strokeWidth={2} />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-5 h-5" strokeWidth={2} />
                  <span>Share Leaderboard</span>
                </>
              )}
            </button>
          </div>

          {/* Leaderboard Table - Glassmorphism */}
          <div className="glass-dark rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#0f0f0f]/80 border-b border-[#1A1A1A]">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Rank
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Trader
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Current Equity
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Start Balance
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      ROI
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Share
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A1A1A]">
                  {leaders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                        No traders on the leaderboard yet.
                      </td>
                    </tr>
                  ) : (
                    leaders.map((leader, index) => {
                      const rank = index + 1;
                      const isTopThree = rank <= 3;
                      return (
                        <motion.tr
                          key={leader.userId}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className={`hover:bg-[#0f0f0f]/50 transition-colors ${
                            index % 2 === 0 ? 'bg-transparent' : 'bg-[#0f0f0f]/20'
                          } ${isTopThree ? 'border-l-2 border-[#4FFFC8]' : ''}`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              {rank === 1 && <Trophy className="w-5 h-5 text-yellow-500" strokeWidth={2} />}
                              {rank === 2 && <Trophy className="w-5 h-5 text-slate-400" strokeWidth={2} />}
                              {rank === 3 && <Trophy className="w-5 h-5 text-amber-600" strokeWidth={2} />}
                              <span className={`text-sm font-semibold ${
                                isTopThree ? 'text-[#4FFFC8]' : 'text-slate-300'
                              }`}>
                                #{rank}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-medium text-white">
                              {leader.tradingAlias}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <span className="text-sm font-mono font-semibold text-slate-200">
                              ${leader.currentEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <span className="text-sm font-mono text-slate-400">
                              ${leader.startBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-2">
                              {leader.roi > 0 && (
                                <TrendingUp className="w-4 h-4 text-[#10b981]" strokeWidth={2} />
                              )}
                              <span className={`text-sm font-mono font-bold ${
                                leader.roi > 0 ? 'text-[#10b981]' : leader.roi < 0 ? 'text-[#ef4444]' : 'text-slate-400'
                              }`}>
                                {leader.roi >= 0 ? '+' : ''}{leader.roi.toFixed(2)}%
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <button
                              onClick={() => handleTwitterShare(leader)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-[#4FFFC8] hover:bg-[#0f0f0f]/50 rounded-full transition-colors"
                              title="Share on Twitter/X"
                            >
                              <Share2 className="w-3.5 h-3.5" strokeWidth={2} />
                              <span>Share</span>
                            </button>
                          </td>
                        </motion.tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer Note */}
          <div className="mt-8 text-center">
            <p className="text-xs text-slate-500">
              Rankings are based on Return on Investment (ROI) from active challenge subscriptions.
              <br />
              Privacy: Only trading aliases are displayed to protect user privacy.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

