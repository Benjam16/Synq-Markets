"use client";

import { useEffect, useState } from "react";
import { DashboardData } from "@/lib/types";
import DrawdownBar from "../components/DrawdownBar";
import { useAuth } from "../components/AuthProvider";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { Shield, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

const PHASE_LABELS: Record<string, { label: string; target: string; color: string }> = {
  phase1: { label: 'Phase 1 — Challenge', target: '+10%', color: '#4FFFC8' },
  phase2: { label: 'Phase 2 — Verification', target: '+5%', color: '#f59e0b' },
  funded: { label: 'Funded Trader', target: 'No target', color: '#a78bfa' },
};

function RiskPageContent() {
  const { user } = useAuth();
  const [dbUserId, setDbUserId] = useState<number | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [startBalance, setStartBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Get or create user in database
  useEffect(() => {
    const setupUser = async () => {
      if (!user?.email) {
        setLoading(false);
        return;
      }

      try {
        const getUserRes = await fetch(`/api/user?email=${encodeURIComponent(user.email)}`);
        
        if (getUserRes.ok) {
          const { user: dbUser } = await getUserRes.json();
          setDbUserId(dbUser.id);
        } else {
          const createRes = await fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              supabaseUserId: user.id,
              email: user.email,
              fullName: user.user_metadata?.full_name || user.email.split('@')[0],
            }),
          });
          
          if (createRes.ok) {
            const { userId } = await createRes.json();
            setDbUserId(userId);
          }
        }
      } catch (error) {
        console.error('Failed to setup user:', error);
      } finally {
        setLoading(false);
      }
    };

    setupUser();
  }, [user]);

  useEffect(() => {
    if (!dbUserId) return;

    const load = async () => {
      try {
        const res = await fetch(`/api/dashboard?userId=${dbUserId}`);
        if (res.ok) {
          const data = await res.json();
          setDashboard(data);
          
          // Fetch initial balance from dashboard response
          if (!startBalance) {
            // Use initialBalance from dashboard API if available, otherwise use current equity as fallback
            const initialBal = (data as any).initialBalance || data.currentEquity;
            if (initialBal) {
              setStartBalance(initialBal);
            }
          }
        }
      } catch (error) {
        console.error("Failed to load dashboard:", error);
      }
    };
    
    load();
    // Poll every 10 seconds for real-time updates
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [dbUserId]); // Removed startBalance from dependencies to prevent infinite loop

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-slate-400">Loading risk data...</div>
      </div>
    );
  }

  // Show message if no active challenge
  if (!dashboard || dashboard.accountStatus !== 'active') {
    return (
      <div className="min-h-screen bg-[#050505]">
        <div className="h-16" />
        <div className="w-full px-6 py-10 flex flex-col gap-8">
          <div className="bg-slate-950/40 backdrop-blur-xl border border-white/5 rounded-2xl p-8 text-center">
            <p className="text-lg mb-4 text-white">No active challenge found.</p>
            <p className="text-sm text-slate-500 mb-6">
              Purchase a challenge to start trading and monitor your risk metrics.
            </p>
            <a
              href="/challenges"
              className="inline-block bg-[#4FFFC8] text-[#050505] px-6 py-3 rounded-lg font-semibold hover:bg-[#3debb8] transition-colors"
            >
              View Challenges
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Use current equity as fallback if startBalance is not available
  const effectiveStartBalance = startBalance || dashboard.currentEquity || dashboard.dayStartBalance || 5000;

  const phase = (dashboard as any).phase || 'phase1';
  const phaseInfo = PHASE_LABELS[phase] || PHASE_LABELS.phase1;
  const profitTarget = phase === 'phase1' ? 10 : phase === 'phase2' ? 5 : null;
  const totalReturnPct = effectiveStartBalance > 0
    ? ((dashboard.currentEquity - effectiveStartBalance) / effectiveStartBalance) * 100
    : 0;
  const profitProgress = profitTarget !== null
    ? Math.min(100, Math.max(0, (totalReturnPct / profitTarget) * 100))
    : 100;

  const dailyDrawdownPct = dashboard.dailyDrawdownPct || 0;
  const isAtRisk = dailyDrawdownPct <= -5;
  const totalDrawdownPct = effectiveStartBalance
    ? ((dashboard.currentEquity - effectiveStartBalance) / effectiveStartBalance) * 100
    : 0;

  // Calculate drawdown percentages relative to limits
  const dailyDrawdownLimit = -5;
  const totalDrawdownLimit = -10;
  const dailyDrawdownRatio = Math.abs(dailyDrawdownPct) / Math.abs(dailyDrawdownLimit);
  const totalDrawdownRatio = Math.abs(totalDrawdownPct) / Math.abs(totalDrawdownLimit);

  // Color logic: Cyber-Emerald at low, Warning Orange at 50%, Security Red at 90%
  const getGaugeColor = (ratio: number) => {
    if (ratio >= 0.9) return "#ef4444"; // Security Red
    if (ratio >= 0.5) return "#f59e0b"; // Warning Orange
    return "#10b981"; // Cyber-Emerald
  };

  const dailyGaugeColor = getGaugeColor(dailyDrawdownRatio);
  const totalGaugeColor = getGaugeColor(totalDrawdownRatio);

  // Calculate SVG circle progress (0-100%)
  const dailyProgress = Math.min(100, dailyDrawdownRatio * 100);
  const totalProgress = Math.min(100, totalDrawdownRatio * 100);

  // Circular gauge component
  const CircularGauge = ({ progress, color, value, triggerAt, label }: { progress: number; color: string; value: string; triggerAt: string; label: string }) => {
    const radius = 80;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;

    return (
      <div className="flex flex-col items-center">
        <div className="relative w-48 h-48">
          <svg className="transform -rotate-90 w-48 h-48">
            <circle
              cx="96"
              cy="96"
              r={radius}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="8"
              fill="none"
            />
            <circle
              cx="96"
              cy="96"
              r={radius}
              stroke={color}
              strokeWidth="8"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="transition-all duration-300"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-5xl font-mono font-black text-white mb-1">
              {value}
            </div>
            <div className="text-[9px] font-black text-slate-500 tracking-[0.2em] uppercase">
              {label}
            </div>
            <div className="text-[9px] font-black text-slate-500 tracking-[0.2em] uppercase mt-1">
              TRIGGER AT {triggerAt}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#050505]">
      <div className="h-16" />
      <div className="w-full px-6 py-10 flex flex-col gap-8">

        {/* Phase Badge + Profit Progress */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-950/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[9px] font-black tracking-[0.25em] text-slate-500 uppercase mb-1">Current Phase</div>
              <div className="text-base font-bold" style={{ color: phaseInfo.color }}>{phaseInfo.label}</div>
            </div>
            <div className="text-right">
              <div className="text-[9px] font-black tracking-[0.25em] text-slate-500 uppercase mb-1">Profit Target</div>
              <div className="text-base font-bold" style={{ color: phaseInfo.color }}>{phaseInfo.target}</div>
            </div>
          </div>
          {profitTarget !== null ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-slate-500">Progress to target</span>
                <span className="text-[10px] font-bold text-white">
                  {totalReturnPct >= 0 ? '+' : ''}{totalReturnPct.toFixed(2)}% / {phaseInfo.target}
                </span>
              </div>
              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${profitProgress}%`,
                    backgroundColor: profitProgress >= 100 ? '#4FFFC8' : phaseInfo.color,
                  }}
                />
              </div>
              {profitProgress >= 100 && (
                <div className="mt-2 text-[10px] font-black text-[#4FFFC8] tracking-widest">
                  TARGET REACHED — PHASE ADVANCE PENDING
                </div>
              )}
            </div>
          ) : (
            <div className="text-[10px] text-slate-500">
              You are funded. Keep 80% of all profits. Drawdown rules still apply.
            </div>
          )}
        </motion.div>

        {/* Vital Signs - Circular Gauges */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-950/40 backdrop-blur-xl border border-white/5 rounded-2xl p-8 hover:border-white/10 transition-colors flex justify-center"
          >
            <CircularGauge
              progress={dailyProgress}
              color={dailyGaugeColor}
              value={`${dailyDrawdownPct.toFixed(2)}%`}
              triggerAt="-5%"
              label="DAILY DRAWDOWN"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-slate-950/40 backdrop-blur-xl border border-white/5 rounded-2xl p-8 hover:border-white/10 transition-colors flex justify-center relative overflow-hidden"
          >
            {/* Subtle radial glow for Total Drawdown */}
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'radial-gradient(circle at center, rgba(239, 68, 68, 0.05) 0%, rgba(249, 115, 22, 0.05) 50%, transparent 70%)',
              }}
            />
            <CircularGauge
              progress={totalProgress}
              color={totalGaugeColor}
              value={`${totalDrawdownPct.toFixed(2)}%`}
              triggerAt="-10%"
              label="TOTAL DRAWDOWN"
            />
          </motion.div>
        </div>

        {/* High-Fidelity Health Bars */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-950/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors"
        >
          <DrawdownBar
            currentDrawdown={dailyDrawdownPct}
            maxDrawdown={10}
            dailyMaxDrawdown={5}
            startBalance={effectiveStartBalance}
            currentEquity={dashboard.currentEquity}
          />
        </motion.div>

        {/* Protocol Ledger - Risk Rules */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-slate-950/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors"
        >
          <div className="space-y-0">
            {/* Max Total Drawdown Rule */}
            <div className="flex items-center justify-between py-4 border-b border-white/5">
              <div className="flex-1">
                <div className="text-[10px] font-black text-white tracking-[0.2em] uppercase mb-1">MAX TOTAL DRAWDOWN</div>
                <div className="text-xs text-slate-500">Kill if equity &lt; 90% of initial balance</div>
              </div>
              <div className="ml-4">
                {totalDrawdownRatio >= 0.9 ? (
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  >
                    <Shield className="w-5 h-5 text-[#f59e0b]" strokeWidth={1.5} />
                  </motion.div>
                ) : (
                  <Shield className="w-5 h-5 text-[#4FFFC8]" strokeWidth={1.5} />
                )}
              </div>
            </div>

            {/* Max Daily Loss Rule */}
            <div className="flex items-center justify-between py-4 border-b border-white/5">
              <div className="flex-1">
                <div className="text-[10px] font-black text-white tracking-[0.2em] uppercase mb-1">MAX DAILY LOSS</div>
                <div className="text-xs text-slate-500">Kill if equity &lt; 95% of start-of-day balance</div>
              </div>
              <div className="ml-4">
                {dailyDrawdownRatio >= 0.9 ? (
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  >
                    <Shield className="w-5 h-5 text-[#f59e0b]" strokeWidth={1.5} />
                  </motion.div>
                ) : (
                  <Shield className="w-5 h-5 text-[#4FFFC8]" strokeWidth={1.5} />
                )}
              </div>
            </div>

            {/* Max Position Size Rule */}
            <div className="flex items-center justify-between py-4 border-b border-white/5">
              <div className="flex-1">
                <div className="text-[10px] font-black text-white tracking-[0.2em] uppercase mb-1">MAX POSITION SIZE</div>
                <div className="text-xs text-slate-500">Single event ≤ 20% of equity</div>
              </div>
              <div className="ml-4">
                <Shield className="w-5 h-5 text-[#4FFFC8]" strokeWidth={1.5} />
              </div>
            </div>

            {/* Profit Target */}
            <div className="flex items-center justify-between py-4 border-b border-white/5">
              <div className="flex-1">
                <div className="text-[10px] font-black text-white tracking-[0.2em] uppercase mb-1">PROFIT TARGET</div>
                <div className="text-xs text-slate-500">
                  {phase === 'funded'
                    ? 'Funded — no target, 80% profit split'
                    : `${phaseInfo.label}: reach ${phaseInfo.target} to advance`}
                </div>
              </div>
              <div className="ml-4">
                <Shield className="w-5 h-5" style={{ color: phaseInfo.color }} strokeWidth={1.5} />
              </div>
            </div>

            {/* Inactivity Rule */}
            <div className="flex items-center justify-between py-4">
              <div className="flex-1">
                <div className="text-[10px] font-black text-white tracking-[0.2em] uppercase mb-1">INACTIVITY</div>
                <div className="text-xs text-slate-500">Auto-close after 30 days idle</div>
              </div>
              <div className="ml-4">
                <Shield className="w-5 h-5 text-[#4FFFC8]" strokeWidth={1.5} />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function RiskPage() {
  return (
    <ProtectedRoute>
      <RiskPageContent />
    </ProtectedRoute>
  );
}

