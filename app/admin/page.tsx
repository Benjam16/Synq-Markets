"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../components/AuthProvider";
import { useRouter } from "next/navigation";
import { 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  XCircle, 
  Search,
  Filter,
  Download,
  RefreshCw
} from "lucide-react";
import { toast } from "react-hot-toast";

interface User {
  id: number;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
  challenge_count: number;
  trade_count: number;
  active_challenges: number;
}

interface Trade {
  id: number;
  user_id: number;
  user_email: string;
  user_name: string;
  challenge_subscription_id: number;
  challenge_status: string;
  provider: string;
  market_id: string;
  side: string;
  price: number;
  quantity: number;
  notional: number;
  executed_at: string;
}

interface Challenge {
  id: number;
  user_id: number;
  user_email: string;
  user_name: string;
  tier_name: string;
  tier_size: number;
  status: string;
  start_balance: number;
  current_balance: number;
  day_start_balance: number;
  total_return_pct: number;
  daily_drawdown_pct: number;
  trade_count: number;
  fail_reason: string | null;
  started_at: string;
  ended_at: string | null;
}

type Tab = "users" | "trades" | "challenges";

export default function AdminPanel() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("users");
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  
  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  
  // Trades state
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  
  // Challenges state
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [challengesLoading, setChallengesLoading] = useState(false);
  const [challengeStatusFilter, setChallengeStatusFilter] = useState<string>("");

  // Check admin status
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        // Include email in query for reliable check (case-insensitive)
        const email = user?.email || '';
        const url = email 
          ? `/api/admin/check?email=${encodeURIComponent(email)}`
          : '/api/admin/check';
        
        console.log('[Admin Panel] Checking admin status for:', email);
        const res = await fetch(url);
        const data = await res.json();
        
        console.log('[Admin Panel] Admin check result:', data);
        
        const isAdminUser = data.isAdmin === true;
        setIsAdmin(isAdminUser);
        
        if (!isAdminUser) {
          console.warn('[Admin Panel] Not an admin, redirecting to dashboard');
          router.push("/dashboard");
        } else {
          console.log('[Admin Panel] ✅ Admin access granted');
        }
      } catch (error) {
        console.error("[Admin Panel] Failed to check admin status:", error);
        setIsAdmin(false);
        // Don't redirect on error - let user see the error
      } finally {
        setCheckingAdmin(false);
      }
    };

    if (!loading && user) {
      checkAdmin();
    } else if (!loading && !user) {
      // Not logged in, redirect to login
      router.push("/login");
      setCheckingAdmin(false);
    }
  }, [loading, user, router]);

  // Load users
  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const params = new URLSearchParams();
      if (userSearch) params.append("search", userSearch);
      params.append("limit", "100");
      // Include email for fallback authentication
      if (user?.email) params.append("email", user.email);
      
      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users || []);
      } else {
        toast.error(data.error || "Failed to load users");
      }
    } catch (error) {
      toast.error("Failed to load users");
    } finally {
      setUsersLoading(false);
    }
  };

  // Load trades
  const loadTrades = async () => {
    setTradesLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedUserId) params.append("userId", selectedUserId);
      params.append("limit", "100");
      // Include email for fallback authentication
      if (user?.email) params.append("email", user.email);
      
      const res = await fetch(`/api/admin/trades?${params}`);
      const data = await res.json();
      if (res.ok) {
        setTrades(data.trades || []);
      } else {
        toast.error(data.error || "Failed to load trades");
      }
    } catch (error) {
      toast.error("Failed to load trades");
    } finally {
      setTradesLoading(false);
    }
  };

  // Load challenges
  const loadChallenges = async () => {
    setChallengesLoading(true);
    try {
      const params = new URLSearchParams();
      if (challengeStatusFilter) params.append("status", challengeStatusFilter);
      params.append("limit", "100");
      // Include email for fallback authentication
      if (user?.email) params.append("email", user.email);
      
      const res = await fetch(`/api/admin/challenges?${params}`);
      const data = await res.json();
      if (res.ok) {
        setChallenges(data.challenges || []);
      } else {
        toast.error(data.error || "Failed to load challenges");
      }
    } catch (error) {
      toast.error("Failed to load challenges");
    } finally {
      setChallengesLoading(false);
    }
  };

  // Load data when tab changes
  useEffect(() => {
    if (isAdmin && !checkingAdmin) {
      if (activeTab === "users") loadUsers();
      else if (activeTab === "trades") loadTrades();
      else if (activeTab === "challenges") loadChallenges();
    }
  }, [activeTab, isAdmin, checkingAdmin]);

  // Pass trader function
  const passTrader = async (challengeId: number, reason?: string) => {
    if (!confirm(`Are you sure you want to PASS this challenge?`)) {
      return;
    }

    const passReason = reason || prompt("Enter pass reason (optional):") || "Manually passed by admin";

    try {
      const res = await fetch("/api/admin/pass-trader", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          challengeId, 
          reason: passReason,
          email: user?.email // Include email for fallback auth
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("Trader challenge passed successfully");
        loadChallenges();
      } else {
        toast.error(data.error || "Failed to pass trader");
      }
    } catch (error) {
      toast.error("Failed to pass trader");
    }
  };

  // Fail trader function
  const failTrader = async (challengeId: number, reason?: string) => {
    if (!confirm(`Are you sure you want to FAIL this challenge?`)) {
      return;
    }

    const failReason = reason || prompt("Enter fail reason (optional):") || "Manually failed by admin";

    try {
      const res = await fetch("/api/admin/fail-trader", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          challengeId, 
          reason: failReason,
          email: user?.email // Include email for fallback auth
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("Trader challenge failed successfully");
        loadChallenges();
      } else {
        toast.error(data.error || "Failed to fail trader");
      }
    } catch (error) {
      toast.error("Failed to fail trader");
    }
  };

  if (checkingAdmin || loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="h-16 -mt-6 -ml-6 -mr-6 mb-6" />
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Admin Panel</h1>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-800">
          <button
            onClick={() => setActiveTab("users")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "users"
                ? "border-b-2 border-blue-500 text-blue-400"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Users
          </button>
          <button
            onClick={() => setActiveTab("trades")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "trades"
                ? "border-b-2 border-blue-500 text-blue-400"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <TrendingUp className="w-4 h-4 inline mr-2" />
            Trades
          </button>
          <button
            onClick={() => setActiveTab("challenges")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "challenges"
                ? "border-b-2 border-blue-500 text-blue-400"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <AlertTriangle className="w-4 h-4 inline mr-2" />
            Challenges
          </button>
        </div>

        {/* Users Tab */}
        {activeTab === "users" && (
          <div>
            <div className="flex gap-4 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search users by email or name..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && loadUsers()}
                  className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                />
              </div>
              <button
                onClick={loadUsers}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>

            <div className="bg-slate-900 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">Email</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Role</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Challenges</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Trades</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Active</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {usersLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        Loading...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        No users found
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className="border-t border-slate-800 hover:bg-slate-800/50">
                        <td className="px-4 py-3">{u.email}</td>
                        <td className="px-4 py-3">{u.full_name || "-"}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs ${
                            u.role === "admin" ? "bg-red-900/30 text-red-400" :
                            u.role === "risk" ? "bg-yellow-900/30 text-yellow-400" :
                            "bg-blue-900/30 text-blue-400"
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">{u.challenge_count}</td>
                        <td className="px-4 py-3">{u.trade_count}</td>
                        <td className="px-4 py-3">
                          <span className="text-green-400">{u.active_challenges}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-400">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Trades Tab */}
        {activeTab === "trades" && (
          <div>
            <div className="flex gap-4 mb-4">
              <input
                type="text"
                placeholder="Filter by User ID..."
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
              />
              <button
                onClick={loadTrades}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>

            <div className="bg-slate-900 rounded-lg overflow-x-auto">
              <table className="w-full min-w-[1000px]">
                <thead className="bg-slate-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">User</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Market</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Side</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Price</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Quantity</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Notional</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {tradesLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        Loading...
                      </td>
                    </tr>
                  ) : trades.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        No trades found
                      </td>
                    </tr>
                  ) : (
                    trades.map((t) => (
                      <tr key={t.id} className="border-t border-slate-800 hover:bg-slate-800/50">
                        <td className="px-4 py-3">
                          <div className="text-sm">{t.user_email}</div>
                          <div className="text-xs text-slate-400">ID: {t.user_id}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm">{t.market_id.substring(0, 30)}...</div>
                          <div className="text-xs text-slate-400">{t.provider}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs ${
                            t.side === "yes" ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"
                          }`}>
                            {t.side.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3">${Number(t.price || 0).toFixed(4)}</td>
                        <td className="px-4 py-3">{Number(t.quantity || 0).toFixed(2)}</td>
                        <td className="px-4 py-3">${Number(t.notional || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-slate-400">
                          {new Date(t.executed_at).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Challenges Tab */}
        {activeTab === "challenges" && (
          <div>
            <div className="flex gap-4 mb-4">
              <select
                value={challengeStatusFilter}
                onChange={(e) => setChallengeStatusFilter(e.target.value)}
                className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="failed">Failed</option>
                <option value="passed">Passed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <button
                onClick={loadChallenges}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>

            <div className="bg-slate-900 rounded-lg overflow-x-auto">
              <table className="w-full min-w-[1200px]">
                <thead className="bg-slate-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">User</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Tier</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Balance</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Return %</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Daily DD %</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Trades</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Started</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {challengesLoading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                        Loading...
                      </td>
                    </tr>
                  ) : challenges.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                        No challenges found
                      </td>
                    </tr>
                  ) : (
                    challenges.map((c) => (
                      <tr key={c.id} className="border-t border-slate-800 hover:bg-slate-800/50">
                        <td className="px-4 py-3">
                          <div className="text-sm">{c.user_email}</div>
                          <div className="text-xs text-slate-400">{c.user_name || "N/A"}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm">{c.tier_name}</div>
                          <div className="text-xs text-slate-400">${Number(c.tier_size || 0).toLocaleString()}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs ${
                            c.status === "active" ? "bg-green-900/30 text-green-400" :
                            c.status === "failed" ? "bg-red-900/30 text-red-400" :
                            c.status === "passed" ? "bg-blue-900/30 text-blue-400" :
                            "bg-slate-700 text-slate-400"
                          }`}>
                            {c.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm">${Number(c.current_balance || 0).toLocaleString()}</div>
                          <div className="text-xs text-slate-400">Start: ${Number(c.start_balance || 0).toLocaleString()}</div>
                        </td>
                        <td className={`px-4 py-3 font-medium ${
                          Number(c.total_return_pct) >= 0 ? "text-green-400" : "text-red-400"
                        }`}>
                          {Number(c.total_return_pct) >= 0 ? "+" : ""}{Number(c.total_return_pct || 0).toFixed(2)}%
                        </td>
                        <td className={`px-4 py-3 font-medium ${
                          Number(c.daily_drawdown_pct) >= 0 ? "text-green-400" : "text-red-400"
                        }`}>
                          {Number(c.daily_drawdown_pct) >= 0 ? "+" : ""}{Number(c.daily_drawdown_pct || 0).toFixed(2)}%
                        </td>
                        <td className="px-4 py-3">{c.trade_count}</td>
                        <td className="px-4 py-3 text-sm text-slate-400">
                          {new Date(c.started_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {c.status === "active" && (
                              <>
                                <button
                                  onClick={() => passTrader(c.id)}
                                  className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm flex items-center gap-1"
                                  title="Instant Pass"
                                >
                                  <TrendingUp className="w-4 h-4" />
                                  Pass
                                </button>
                                <button
                                  onClick={() => failTrader(c.id)}
                                  className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm flex items-center gap-1"
                                  title="Instant Fail"
                                >
                                  <XCircle className="w-4 h-4" />
                                  Fail
                                </button>
                              </>
                            )}
                            {c.status === "passed" && (
                              <span className="px-2 py-1 bg-green-900/30 text-green-400 rounded text-xs">
                                PASSED
                              </span>
                            )}
                            {c.status === "failed" && c.fail_reason && (
                              <div className="text-xs text-slate-400" title={c.fail_reason}>
                                {c.fail_reason.substring(0, 30)}...
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
