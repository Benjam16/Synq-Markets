"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Target, 
  Calendar,
  BarChart3,
  PieChart,
  Activity,
  Award,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { DashboardData, Position } from "@/lib/types";
import { useAuth } from "../components/AuthProvider";
import EquityChart from "../components/EquityChart";
import { LineChart, Line, BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Area, AreaChart } from "recharts";
import Link from "next/link";

interface AccountStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalRealizedPnl: number;
  largestWin: number;
  largestLoss: number;
  avgTradeSize: number;
  totalVolume: number;
}

export default function AccountsPage() {
  const { user } = useAuth();
  const [dbUserId, setDbUserId] = useState<number | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasActiveChallenge, setHasActiveChallenge] = useState<boolean | null>(null); // null = unknown, true = active, false = inactive
  const [accountStats, setAccountStats] = useState<AccountStats | null>(null);
  const [equityHistory, setEquityHistory] = useState<Array<{ date: string; equity: number; balance: number }>>([]);
  const [tradeHistory, setTradeHistory] = useState<any[]>([]);

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

    const loadData = async () => {
      try {
        // OPTIMIZED: Load critical data first, then load secondary data in parallel
        const dashboardRes = await fetch(`/api/dashboard?userId=${dbUserId}`);
        if (dashboardRes.ok) {
          const dashboardData = await dashboardRes.json();
          
          // Normalize accountStatus to handle case/whitespace issues
          const normalizedStatus = dashboardData.accountStatus 
            ? String(dashboardData.accountStatus).trim().toLowerCase() 
            : 'inactive';
          const hasActive = normalizedStatus === 'active' && dashboardData.subscriptionId;
          
          // Always log for debugging (helps diagnose the issue)
          console.log('[Accounts] Challenge check:', {
            accountStatus: dashboardData.accountStatus,
            normalizedStatus: normalizedStatus,
            subscriptionId: dashboardData.subscriptionId,
            hasActive,
            failReason: dashboardData.failReason,
            rawData: {
              accountStatus: dashboardData.accountStatus,
              subscriptionId: dashboardData.subscriptionId,
            },
          });
          
          // If no active challenge, try to diagnose the issue
          if (!hasActive && dbUserId) {
            fetch(`/api/diagnose-challenge?userId=${dbUserId}`)
              .then(res => res.json())
              .then(diagnosis => {
                console.log('[Accounts] Challenge diagnosis:', diagnosis);
              })
              .catch(err => console.error('[Accounts] Diagnosis failed:', err));
          }
          
          // Check account status FIRST before setting dashboard
          // CRITICAL: Must check both accountStatus === 'active' AND subscriptionId exists
          // This ensures we only show dashboard when there's actually an active subscription
          if (hasActive) {
            setHasActiveChallenge(true);
            setDashboard(dashboardData);
            setLoading(false); // Show UI immediately with dashboard data
            
            // OPTIMIZED: Load secondary data in parallel (non-blocking)
            Promise.all([
              // Load equity history
              fetch(`/api/equity-history?userId=${dbUserId}`)
                .then(res => res.ok ? res.json() : null)
                .then(equityData => {
                  if (equityData?.history && equityData.history.length > 0) {
                    setEquityHistory(equityData.history);
                  } else {
                    // Fallback: create history from current equity
                    const now = new Date();
                    const history = [];
                    const startBalance = dashboardData.initialBalance || dashboardData.currentEquity || 0;
                    const currentEquity = dashboardData.currentEquity || dashboardData.cashBalance || 0;
                    
                    for (let i = 30; i >= 0; i--) {
                      const date = new Date(now);
                      date.setDate(date.getDate() - i);
                      history.push({
                        date: date.toISOString(),
                        equity: i === 0 ? currentEquity : startBalance,
                        balance: i === 0 ? (dashboardData.cashBalance || 0) : startBalance,
                      });
                    }
                    setEquityHistory(history);
                  }
                })
                .catch(() => {
                  // Fallback on error
                  const now = new Date();
                  const history = [];
                  const startBalance = dashboardData.initialBalance || dashboardData.currentEquity || 0;
                  const currentEquity = dashboardData.currentEquity || dashboardData.cashBalance || 0;
                  
                  for (let i = 30; i >= 0; i--) {
                    const date = new Date(now);
                    date.setDate(date.getDate() - i);
                    history.push({
                      date: date.toISOString(),
                      equity: i === 0 ? currentEquity : startBalance,
                      balance: i === 0 ? (dashboardData.cashBalance || 0) : startBalance,
                    });
                  }
                  setEquityHistory(history);
                }),
              
              // Load trade history in parallel
              fetch(`/api/trade-history?userId=${dbUserId}&activeOnly=true`)
                .then(res => res.ok ? res.json() : null)
                .then(historyData => {
                  if (historyData) {
                    // Set stats from API
                    if (historyData.stats) {
                      setAccountStats({
                        totalTrades: historyData.stats.totalTrades,
                        winningTrades: historyData.stats.winningTrades,
                        losingTrades: historyData.stats.losingTrades,
                        winRate: historyData.stats.winRate,
                        totalRealizedPnl: historyData.stats.totalRealizedPnl,
                        largestWin: historyData.stats.largestWin,
                        largestLoss: historyData.stats.largestLoss,
                        avgTradeSize: historyData.stats.avgTradeSize,
                        totalVolume: historyData.stats.totalVolume,
                      });
                    }

                    // Set trade history
                    setTradeHistory(historyData.trades.map((trade: any) => ({
                      id: trade.id,
                      market: trade.marketName,
                      side: trade.side,
                      entryPrice: trade.entryPrice,
                      currentPrice: trade.closePrice || trade.entryPrice,
                      closePrice: trade.closePrice,
                      quantity: trade.quantity,
                      pnl: trade.pnl,
                      date: trade.closedAt || trade.executedAt,
                      status: trade.status,
                    })));
                  }
                })
                .catch(err => console.error('[Accounts] Failed to load trade history:', err)),
            ]).catch(err => console.error('[Accounts] Error loading secondary data:', err));
          } else {
            // No active challenge - set dashboard to null and stop loading
            setHasActiveChallenge(false);
            setDashboard(null);
            setLoading(false);
            return;
          }
        } else {
          // API returned error - no active challenge
          setHasActiveChallenge(false);
          setDashboard(null);
          setLoading(false);
        }
      } catch (error) {
        console.error("Failed to load account data:", error);
        setHasActiveChallenge(false);
        setDashboard(null);
        setLoading(false);
      }
    };
    
    loadData();
    // Poll every 15 seconds for updates
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [dbUserId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-slate-400">Loading account data...</div>
      </div>
    );
  }

  // Only show "No Active Challenge" if we've confirmed there's no active challenge (hasActiveChallenge === false)
  // Don't show it if we're still loading (hasActiveChallenge === null) or if we have an active challenge (hasActiveChallenge === true)
  if (hasActiveChallenge === false || (!loading && !dashboard)) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl w-full text-center"
        >
          <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-12">
            <AlertTriangle className="w-16 h-16 text-slate-600 mx-auto mb-6" />
            <h2 className="text-2xl font-semibold text-white mb-4">No Active Challenge</h2>
            <p className="text-slate-400 mb-6">
              You don't have an active challenge. Purchase a new challenge to view account details. Historical trades and data are available in the Archive.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link
                href="/challenges"
                className="px-6 py-3 bg-[#4FFFC8] text-[#050505] font-semibold rounded-lg hover:bg-[#4FFFC8]/90 transition-colors"
              >
                Purchase Challenge
              </Link>
              <Link
                href="/archive"
                className="px-6 py-3 bg-[#0F172A] border border-slate-700 text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors"
              >
                View Archive
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Safety check: if dashboard is null, show loading or error state
  if (!dashboard) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-slate-400">Loading account data...</div>
      </div>
    );
  }

  const dailyChange = dashboard.currentEquity - dashboard.dayStartBalance;
  const dailyChangePct = dashboard.dayStartBalance > 0 
    ? (dailyChange / dashboard.dayStartBalance) * 100 
    : 0;

  // Chart data for P&L over time - calculate from actual equity changes
  // P&L is the difference from the starting balance (initial balance when challenge started)
  const startBalance = dashboard.initialBalance || (equityHistory.length > 0 ? Math.min(...equityHistory.map(p => p.equity)) : dashboard.currentEquity || 0);
  
  // Sort equity history by date (oldest to newest) for proper chart display
  const sortedHistory = [...equityHistory].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  const pnlChartData = sortedHistory.map((point) => ({
    date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    pnl: point.equity - startBalance, // P&L is equity minus starting balance
    equity: point.equity,
  }));

  // Win/Loss pie chart data
  const winLossData = accountStats ? [
    { name: 'Wins', value: accountStats.winningTrades, color: '#10b981' },
    { name: 'Losses', value: accountStats.losingTrades, color: '#ef4444' },
  ] : [];

  // Trading activity chart data - calculate from real trade history
  const activityData = (() => {
    // Create a map to aggregate trades by date
    const dailyActivity = new Map<string, { trades: number; volume: number; dateKey: string }>();
    
    // Initialize last 30 days with zero values
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD format
      dailyActivity.set(dateKey, { trades: 0, volume: 0, dateKey });
    }
    
    // Aggregate real trades by date
    tradeHistory.forEach((trade) => {
      const tradeDate = new Date(trade.date);
      const dateKey = tradeDate.toISOString().split('T')[0];
      
      if (dailyActivity.has(dateKey)) {
        const activity = dailyActivity.get(dateKey)!;
        activity.trades += 1;
        // Volume = entry price * quantity
        activity.volume += trade.entryPrice * trade.quantity;
      }
    });
    
    // Convert to array format for the chart, sorted by dateKey (which is already in chronological order)
    return Array.from(dailyActivity.entries())
      .map(([dateKey, activity]) => {
        const date = new Date(dateKey);
        return {
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          trades: activity.trades,
          volume: activity.volume,
          dateKey, // Keep for sorting
        };
      })
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey)); // Sort by YYYY-MM-DD string
  })();

  return (
    <div className="min-h-screen bg-[#050505]">
      <div className="w-full px-6 pt-24 pb-10 flex flex-col gap-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-black text-white tracking-tighter uppercase">Account Overview</h1>
        </motion.div>

        {/* Top Stats - Horizontal Data Tiles */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-950/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors"
        >
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <div>
              <div className="text-[9px] font-black text-slate-500 tracking-[0.2em] uppercase mb-2">CURRENT EQUITY</div>
              <div className="text-xl md:text-2xl lg:text-3xl font-mono text-white">
                ${dashboard.currentEquity.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-black text-slate-500 tracking-[0.2em] uppercase mb-2">CASH BALANCE</div>
              <div className="text-xl md:text-2xl lg:text-3xl font-mono text-white">
                ${dashboard.cashBalance.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-black text-slate-500 tracking-[0.2em] uppercase mb-2">WIN RATE</div>
              <div className="text-xl md:text-2xl lg:text-3xl font-mono text-white">
                {accountStats ? accountStats.winRate.toFixed(1) : '0.0'}%
              </div>
            </div>
            <div>
              <div className="text-[9px] font-black text-slate-500 tracking-[0.2em] uppercase mb-2">TOTAL TRADES</div>
              <div className="text-xl md:text-2xl lg:text-3xl font-mono text-white">
                {accountStats ? accountStats.totalTrades : 0}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Equity Curve */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-slate-950/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors"
          >
            <EquityChart data={sortedHistory.length > 0 ? sortedHistory : equityHistory} />
          </motion.div>

          {/* P&L Over Time */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-slate-950/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors"
          >
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={pnlChartData}>
                  <defs>
                    <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4FFFC8" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#4FFFC8" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" opacity={0.05} />
                  <XAxis 
                    dataKey="date" 
                    stroke="transparent" 
                    fontSize={9} 
                    tick={{ fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="transparent" 
                    fontSize={9} 
                    tick={{ fill: "#64748b" }}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#000000",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "4px",
                      color: "#ffffff",
                      fontFamily: "monospace",
                      fontSize: "11px",
                      padding: "8px 12px",
                    }}
                    formatter={(value: any) => [`$${Number(value).toLocaleString()}`, "P&L"]}
                    labelStyle={{ color: "#94a3b8", fontFamily: "monospace", fontSize: "10px" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="pnl"
                    stroke="#4FFFC8"
                    strokeWidth={1.5}
                    fill="url(#pnlGradient)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        {/* Performance Metrics Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Win/Loss Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-slate-950/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors"
          >
            <div className="h-64 relative">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#000000",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "4px",
                      color: "#ffffff",
                      fontFamily: "monospace",
                      fontSize: "11px",
                      padding: "8px 12px",
                    }}
                  />
                  <Pie
                    data={winLossData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={false}
                    outerRadius={80}
                    innerRadius={50}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {winLossData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.name === 'Wins' ? '#10b981' : '#ef4444'} opacity={0.6} />
                    ))}
                  </Pie>
                </RechartsPieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <div className="text-2xl font-mono font-black text-white">
                    {accountStats ? accountStats.winRate.toFixed(1) : '0.0'}%
                  </div>
                  <div className="text-[9px] font-black text-slate-500 tracking-[0.2em] uppercase mt-1">WIN RATE</div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Trading Activity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-slate-950/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors"
          >
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" opacity={0.05} />
                  <XAxis 
                    dataKey="date" 
                    stroke="transparent" 
                    fontSize={9} 
                    tick={{ fill: "#64748b" }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis stroke="transparent" fontSize={9} tick={{ fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#000000",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "4px",
                      color: "#ffffff",
                      fontFamily: "monospace",
                      fontSize: "11px",
                      padding: "8px 12px",
                    }}
                    formatter={(value: any) => [value, "Trades"]}
                  />
                  <Bar dataKey="trades" fill="#4FFFC8" radius={[2, 2, 0, 0]} barSize={8} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Performance Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-slate-950/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors"
          >
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-center justify-between">
                <div className="text-[9px] font-black text-slate-500 tracking-[0.2em] uppercase">LARGEST WIN</div>
                <div className="text-xl font-mono font-black text-white">
                  ${accountStats ? accountStats.largestWin.toLocaleString() : '0'}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-[9px] font-black text-slate-500 tracking-[0.2em] uppercase">LARGEST LOSS</div>
                <div className="text-xl font-mono font-black text-white">
                  ${accountStats ? Math.abs(accountStats.largestLoss).toLocaleString() : '0'}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-[9px] font-black text-slate-500 tracking-[0.2em] uppercase">TOTAL REALIZED P&L</div>
                <div className={`text-xl font-mono font-black ${accountStats && accountStats.totalRealizedPnl >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                  {accountStats && accountStats.totalRealizedPnl >= 0 ? '+' : ''}${accountStats ? accountStats.totalRealizedPnl.toLocaleString() : '0'}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-[9px] font-black text-slate-500 tracking-[0.2em] uppercase">AVG TRADE SIZE</div>
                <div className="text-xl font-mono font-black text-white">
                  ${accountStats ? accountStats.avgTradeSize.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'}
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Trading History Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-slate-950/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-900/50 border-b border-white/5">
                  <th className="text-left py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">MARKET</th>
                  <th className="text-left py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">SIDE</th>
                  <th className="text-right py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">ENTRY</th>
                  <th className="text-right py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">CLOSE</th>
                  <th className="text-right py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">QUANTITY</th>
                  <th className="text-right py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">P&L</th>
                  <th className="text-right py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">DATE</th>
                </tr>
              </thead>
              <tbody>
                {tradeHistory.length > 0 ? (
                  tradeHistory.map((trade) => (
                    <tr key={trade.id} className="border-b border-white/5">
                      <td className="py-4 px-4 text-white font-mono text-sm">{trade.market}</td>
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${
                          trade.side === 'YES'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {trade.side === 'YES' ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                          {trade.side}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-white text-sm">${trade.entryPrice.toFixed(2)}</td>
                      <td className="py-4 px-4 text-right font-mono text-white text-sm">
                        {trade.closePrice !== null && trade.closePrice !== undefined 
                          ? `$${trade.closePrice.toFixed(2)}` 
                          : <span className="text-slate-500">—</span>}
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-white text-sm">{trade.quantity.toLocaleString()}</td>
                      <td className={`py-4 px-4 text-right font-mono text-sm ${
                        trade.pnl !== null && trade.pnl !== undefined
                          ? (trade.pnl >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]')
                          : 'text-slate-500'
                      }`}>
                        {trade.pnl !== null && trade.pnl !== undefined
                          ? `${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                          : '—'}
                      </td>
                      <td className="py-4 px-4 text-right text-slate-400 text-sm font-mono">
                        {new Date(trade.date).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No trading history available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
