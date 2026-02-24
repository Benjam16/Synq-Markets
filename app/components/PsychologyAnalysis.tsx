"use client";

import { useEffect, useState } from "react";
import { Brain, AlertTriangle, TrendingDown, Clock, CheckCircle2 } from "lucide-react";
import { analyzeTraderPsychology, PsychologyAnalysis, Trade } from "@/lib/trader-psychology";

interface PsychologyAnalysisProps {
  userId: number | null;
}

export default function PsychologyAnalysisCard({ userId }: PsychologyAnalysisProps) {
  const [analysis, setAnalysis] = useState<PsychologyAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const loadAnalysis = async () => {
      try {
        const res = await fetch(`/api/trades?userId=${userId}`);
        if (res.ok) {
          const data = await res.json();
          const trades: Trade[] = data.trades || [];
          const result = analyzeTraderPsychology(trades);
          setAnalysis(result);
        }
      } catch (error) {
        console.error("Failed to load psychology analysis:", error);
      } finally {
        setLoading(false);
      }
    };

    loadAnalysis();
    const interval = setInterval(loadAnalysis, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [userId]);

  if (loading) {
    return (
      <div className="bg-[#0F172A] border border-slate-800/50 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-5 h-5 text-[#4FFFC8]" strokeWidth={2} />
          <h3 className="text-lg font-semibold text-white">Psychology Analysis</h3>
        </div>
        <div className="text-center py-8 text-slate-400 text-sm">Analyzing trading patterns...</div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="bg-[#0F172A] border border-slate-800/50 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-5 h-5 text-[#4FFFC8]" strokeWidth={2} />
          <h3 className="text-lg font-semibold text-white">Psychology Analysis</h3>
        </div>
        <div className="text-center py-8 text-slate-400 text-sm">No trading data available</div>
      </div>
    );
  }

  const getRiskColor = () => {
    switch (analysis.riskLevel) {
      case 'critical':
        return 'text-[#ef4444]';
      case 'high':
        return 'text-[#f59e0b]';
      case 'medium':
        return 'text-[#eab308]';
      default:
        return 'text-[#10b981]';
    }
  };

  const getRiskBgColor = () => {
    switch (analysis.riskLevel) {
      case 'critical':
        return 'bg-[#ef4444]/10 border-[#ef4444]/30';
      case 'high':
        return 'bg-[#f59e0b]/10 border-[#f59e0b]/30';
      case 'medium':
        return 'bg-[#eab308]/10 border-[#eab308]/30';
      default:
        return 'bg-[#10b981]/10 border-[#10b981]/30';
    }
  };

  return (
    <div className="bg-[#0F172A] border border-slate-800/50 rounded-lg p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-[#4FFFC8]" strokeWidth={2} />
          <h3 className="text-lg font-semibold text-white">Psychology Analysis</h3>
        </div>
        <div className={`px-3 py-1 rounded-md text-xs font-semibold border ${getRiskBgColor()} ${getRiskColor()}`}>
          {analysis.riskLevel.toUpperCase()}
        </div>
      </div>

      {/* Tilt Score */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-400">Tilt Score</span>
          <span className={`text-2xl font-bold font-mono ${getRiskColor()}`}>
            {analysis.tiltScore}/100
          </span>
        </div>
        <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              analysis.tiltScore >= 70 ? 'bg-[#ef4444]' :
              analysis.tiltScore >= 50 ? 'bg-[#f59e0b]' :
              analysis.tiltScore >= 30 ? 'bg-[#eab308]' :
              'bg-[#10b981]'
            }`}
            style={{ width: `${analysis.tiltScore}%` }}
          />
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-3 bg-slate-900/30 border border-slate-800/50 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-slate-400" strokeWidth={2} />
            <span className="text-xs text-slate-500">Revenge Trades</span>
          </div>
          <div className="text-xl font-bold text-white">{analysis.revengeTrades}</div>
        </div>
        <div className="p-3 bg-slate-900/30 border border-slate-800/50 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-slate-400" strokeWidth={2} />
            <span className="text-xs text-slate-500">Avg Time</span>
          </div>
          <div className="text-xl font-bold text-white">{analysis.avgTimeBetweenTrades}m</div>
        </div>
      </div>

      {/* Insights */}
      <div className="flex-1">
        <h4 className="text-sm font-semibold text-slate-300 mb-3">Insights</h4>
        <div className="space-y-2">
          {analysis.insights.map((insight, index) => (
            <div
              key={index}
              className="flex items-start gap-2 p-2 bg-slate-900/20 rounded-md text-xs text-slate-400"
            >
              {insight.includes('✅') ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981] flex-shrink-0 mt-0.5" strokeWidth={2} />
              ) : insight.includes('⚠️') ? (
                <AlertTriangle className="w-3.5 h-3.5 text-[#f59e0b] flex-shrink-0 mt-0.5" strokeWidth={2} />
              ) : (
                <div className="w-1.5 h-1.5 rounded-full bg-slate-500 flex-shrink-0 mt-1.5" />
              )}
              <span>{insight.replace(/[✅⚠️]/g, '').trim()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

