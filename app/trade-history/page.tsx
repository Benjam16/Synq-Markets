'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../components/AuthProvider';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { motion } from 'framer-motion';
import { 
  Download, 
  Filter, 
  Search, 
  Calendar,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
  FileText
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';

interface Trade {
  id: number;
  marketName: string;
  marketId: string;
  provider: string;
  side: 'yes' | 'no';
  entryPrice: number;
  closePrice?: number;
  quantity: number;
  pnl?: number;
  executedAt: string;
  closedAt?: string;
  status: 'open' | 'closed' | 'settled';
}

interface TradeStats {
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

function TradeHistoryContent() {
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [stats, setStats] = useState<TradeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbUserId, setDbUserId] = useState<number | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed' | 'settled'>('all');
  const [sideFilter, setSideFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month' | 'year'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'pnl' | 'size'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Get user ID
  useEffect(() => {
    const fetchUserId = async () => {
      if (!user?.email) {
        setLoading(false);
        return;
      }
      
      try {
        const res = await fetch(`/api/user?email=${encodeURIComponent(user.email)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.user?.id) {
            setDbUserId(data.user.id);
          } else {
            // User not found - try to create them
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
              const createData = await createRes.json();
              if (createData.userId) {
                setDbUserId(createData.userId);
              } else {
                setLoading(false);
                toast.error('Failed to create user account');
              }
            } else {
              setLoading(false);
              toast.error('User account not found');
            }
          }
        } else if (res.status === 404) {
          // User not found - try to create them
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
            const createData = await createRes.json();
            if (createData.userId) {
              setDbUserId(createData.userId);
            } else {
              setLoading(false);
              toast.error('Failed to create user account');
            }
          } else {
            setLoading(false);
            toast.error('User account not found');
          }
        } else {
          setLoading(false);
          toast.error('Failed to load user data');
        }
      } catch (error) {
        console.error('Failed to fetch user ID:', error);
        setLoading(false);
        toast.error('Failed to load user data');
      }
    };
    
    fetchUserId();
  }, [user]);

  // Load trade history
  useEffect(() => {
    if (!dbUserId) return;

    const loadTradeHistory = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/trade-history?userId=${dbUserId}`);
        if (res.ok) {
          const data = await res.json();
          setTrades(data.trades || []);
          setStats(data.stats || null);
        } else {
          const errorData = await res.json().catch(() => ({}));
          console.error('Failed to load trade history:', errorData);
          toast.error(errorData.error || 'Failed to load trade history');
          setTrades([]);
          setStats(null);
        }
      } catch (error) {
        console.error('Error loading trade history:', error);
        toast.error('Failed to load trade history');
        setTrades([]);
        setStats(null);
      } finally {
        setLoading(false);
      }
    };

    loadTradeHistory();
  }, [dbUserId]);

  // Filter and sort trades
  const filteredTrades = useMemo(() => {
    let filtered = [...trades];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(trade => 
        trade.marketName.toLowerCase().includes(query) ||
        trade.marketId.toLowerCase().includes(query) ||
        trade.provider.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(trade => trade.status === statusFilter);
    }

    // Side filter
    if (sideFilter !== 'all') {
      filtered = filtered.filter(trade => trade.side === sideFilter);
    }

    // Date range filter
    if (dateRange !== 'all') {
      const now = new Date();
      const cutoff = new Date();
      
      switch (dateRange) {
        case 'today':
          cutoff.setHours(0, 0, 0, 0);
          break;
        case 'week':
          cutoff.setDate(now.getDate() - 7);
          break;
        case 'month':
          cutoff.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          cutoff.setFullYear(now.getFullYear() - 1);
          break;
      }
      
      filtered = filtered.filter(trade => {
        const tradeDate = new Date(trade.executedAt);
        return tradeDate >= cutoff;
      });
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime();
          break;
        case 'pnl':
          comparison = (a.pnl || 0) - (b.pnl || 0);
          break;
        case 'size':
          comparison = a.quantity - b.quantity;
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [trades, searchQuery, statusFilter, sideFilter, dateRange, sortBy, sortOrder]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Date', 'Market', 'Provider', 'Side', 'Entry Price', 'Close Price', 'Quantity', 'P&L', 'Status'];
    const rows = filteredTrades.map(trade => [
      new Date(trade.executedAt).toLocaleString(),
      trade.marketName,
      trade.provider,
      trade.side.toUpperCase(),
      trade.entryPrice.toFixed(4),
      trade.closePrice?.toFixed(4) || 'N/A',
      trade.quantity.toString(),
      trade.pnl?.toFixed(2) || '0.00',
      trade.status,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trade-history-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    toast.success('Trade history exported to CSV');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#4FFFC8] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505]">
      <div className="h-16" />
      
      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href="/dashboard"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Dashboard</span>
          </Link>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black text-white mb-2 tracking-tight">TRADE HISTORY</h1>
              <p className="text-slate-400 text-sm">Complete trading activity and performance metrics</p>
            </div>
            
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-6 py-3 bg-[#4FFFC8]/10 border border-[#4FFFC8]/20 text-[#4FFFC8] rounded-xl hover:bg-[#4FFFC8] hover:text-black transition-all font-semibold"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#050505]/40 backdrop-blur-3xl border border-white/5 rounded-2xl p-4"
            >
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">TOTAL TRADES</div>
              <div className="text-2xl font-mono text-white">{stats.totalTrades}</div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-[#050505]/40 backdrop-blur-3xl border border-white/5 rounded-2xl p-4"
            >
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">WIN RATE</div>
              <div className="text-2xl font-mono text-white">{stats.winRate.toFixed(1)}%</div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-[#050505]/40 backdrop-blur-3xl border border-white/5 rounded-2xl p-4"
            >
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">TOTAL P&L</div>
              <div className={`text-2xl font-mono ${stats.totalRealizedPnl >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                {stats.totalRealizedPnl >= 0 ? '+' : ''}${stats.totalRealizedPnl.toFixed(2)}
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-[#050505]/40 backdrop-blur-3xl border border-white/5 rounded-2xl p-4"
            >
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">LARGEST WIN</div>
              <div className="text-2xl font-mono text-[#10b981]">${stats.largestWin.toFixed(2)}</div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-[#050505]/40 backdrop-blur-3xl border border-white/5 rounded-2xl p-4"
            >
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">LARGEST LOSS</div>
              <div className="text-2xl font-mono text-[#ef4444]">${Math.abs(stats.largestLoss).toFixed(2)}</div>
            </motion.div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-[#050505]/40 backdrop-blur-3xl border border-white/5 rounded-2xl p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search markets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white/[0.03] border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[#4FFFC8]/50"
                />
              </div>
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-4 py-2 bg-white/[0.03] border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#4FFFC8]/50"
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="settled">Settled</option>
            </select>

            {/* Side Filter */}
            <select
              value={sideFilter}
              onChange={(e) => setSideFilter(e.target.value as any)}
              className="px-4 py-2 bg-white/[0.03] border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#4FFFC8]/50"
            >
              <option value="all">All Sides</option>
              <option value="yes">YES</option>
              <option value="no">NO</option>
            </select>

            {/* Date Range */}
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="px-4 py-2 bg-white/[0.03] border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#4FFFC8]/50"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="year">Last Year</option>
            </select>
          </div>

          {/* Sort Controls */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/5">
            <span className="text-sm text-slate-400">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 bg-white/[0.03] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#4FFFC8]/50"
            >
              <option value="date">Date</option>
              <option value="pnl">P&L</option>
              <option value="size">Size</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-4 py-2 bg-white/[0.03] border border-white/10 rounded-xl text-white text-sm hover:bg-white/5 transition-colors"
            >
              {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
            </button>
            <span className="text-sm text-slate-500 ml-auto">
              Showing {filteredTrades.length} of {trades.length} trades
            </span>
          </div>
        </div>

        {/* Trade Table */}
        <div className="bg-[#050505]/40 backdrop-blur-3xl border border-white/5 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/50 border-b border-white/5">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Date</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Market</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Side</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">Entry</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">Close</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">Quantity</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">P&L</th>
                  <th className="px-6 py-4 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrades.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                      <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No trades found matching your filters</p>
                    </td>
                  </tr>
                ) : (
                  filteredTrades.map((trade, index) => (
                    <motion.tr
                      key={trade.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-slate-300 font-mono">
                        {new Date(trade.executedAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-white font-medium">{trade.marketName}</div>
                        <div className="text-xs text-slate-500">{trade.provider}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${
                          trade.side === 'yes' 
                            ? 'bg-emerald-500/20 text-emerald-400' 
                            : 'bg-rose-500/20 text-rose-400'
                        }`}>
                          {trade.side.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-mono text-white">
                        ${trade.entryPrice.toFixed(4)}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-mono text-slate-400">
                        {trade.closePrice ? `$${trade.closePrice.toFixed(4)}` : '—'}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-mono text-white">
                        {trade.quantity}
                      </td>
                      <td className={`px-6 py-4 text-right text-sm font-mono font-semibold ${
                        (trade.pnl || 0) >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'
                      }`}>
                        {trade.pnl !== undefined 
                          ? `${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)}`
                          : '—'
                        }
                      </td>
                      <td className="px-6 py-4 text-center">
                        {trade.status === 'open' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-400">
                            <Clock className="w-3 h-3" />
                            Open
                          </span>
                        ) : trade.status === 'closed' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-300">
                            <CheckCircle2 className="w-3 h-3" />
                            Closed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-500">
                            <XCircle className="w-3 h-3" />
                            Settled
                          </span>
                        )}
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function TradeHistoryPage() {
  return (
    <ProtectedRoute>
      <TradeHistoryContent />
    </ProtectedRoute>
  );
}
