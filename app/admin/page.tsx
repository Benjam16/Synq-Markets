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

type Tab = "users" | "trades";

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
  
  // Check admin status by wallet
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const wallet = user?.address || '';
        const url = wallet ? `/api/admin/check?wallet=${encodeURIComponent(wallet)}` : '/api/admin/check';
        const res = await fetch(url);
        const data = await res.json();
        const isAdminUser = data.isAdmin === true;
        setIsAdmin(isAdminUser);
        if (!isAdminUser) router.push("/terminal");
      } catch {
        setIsAdmin(false);
      } finally {
        setCheckingAdmin(false);
      }
    };

    if (!loading && user) checkAdmin();
    else if (!loading && !user) {
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
      if (user?.address) params.append("wallet", user.address);
      
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
      if (user?.address) params.append("wallet", user.address);
      
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

  // Load data when tab changes
  useEffect(() => {
    if (isAdmin && !checkingAdmin) {
      if (activeTab === "users") loadUsers();
      else if (activeTab === "trades") loadTrades();
    }
  }, [activeTab, isAdmin, checkingAdmin]);

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
      </div>
    </div>
  );
}
