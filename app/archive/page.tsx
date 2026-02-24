'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../components/AuthProvider';
import { Archive, AlertTriangle, CheckCircle2, Clock, X, TrendingUp, TrendingDown, DollarSign, Calendar } from 'lucide-react';
import Link from 'next/link';

interface Challenge {
  id: number;
  status: string;
  startBalance: number;
  currentBalance: number;
  dayStartBalance: number;
  startedAt: string;
  endedAt: string | null;
  failReason: string | null;
  tradeCount: number;
  tierName?: string;
}

export default function ArchivePage() {
  const { user } = useAuth();
  const [dbUserId, setDbUserId] = useState<number | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
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

  // Fetch all challenges (including failed ones)
  useEffect(() => {
    if (!dbUserId) return;

    const fetchChallenges = async () => {
      try {
        const res = await fetch(`/api/cleanup-challenges?userId=${dbUserId}`);
        if (res.ok) {
          const data = await res.json();
          setChallenges(data.challenges || []);
        }
      } catch (error) {
        console.error('Failed to fetch challenges:', error);
      }
    };

    fetchChallenges();
  }, [dbUserId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Clock className="w-5 h-5 text-blue-500" />;
      case 'failed':
        return <X className="w-5 h-5 text-red-500" />;
      case 'passed':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      default:
        return <Archive className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/30';
      case 'failed':
        return 'bg-red-500/10 text-red-500 border-red-500/30';
      case 'passed':
        return 'bg-green-500/10 text-green-500 border-green-500/30';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    }
  };

  const calculateROI = (start: number, current: number) => {
    if (start === 0) return 0;
    return ((current - start) / start) * 100;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505]">
      <div className="h-16" />
      <div className="w-full px-6 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-4">
            <Archive className="w-8 h-8 text-[#4FFFC8]" />
            <h1 className="text-4xl font-semibold text-white tracking-tight">Challenge Archive</h1>
          </div>
          <p className="text-slate-400">View your complete trading history and past challenges</p>
        </motion.div>

        {/* Stats Summary */}
        {challenges.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8"
          >
            <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-6">
              <div className="text-sm text-slate-400 mb-2">Total Challenges</div>
              <div className="text-3xl font-semibold text-white">{challenges.length}</div>
            </div>
            <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-6">
              <div className="text-sm text-slate-400 mb-2">Active</div>
              <div className="text-3xl font-semibold text-blue-500">
                {challenges.filter(c => c.status === 'active').length}
              </div>
            </div>
            <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-6">
              <div className="text-sm text-slate-400 mb-2">Failed</div>
              <div className="text-3xl font-semibold text-red-500">
                {challenges.filter(c => c.status === 'failed').length}
              </div>
            </div>
            <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-6">
              <div className="text-sm text-slate-400 mb-2">Passed</div>
              <div className="text-3xl font-semibold text-green-500">
                {challenges.filter(c => c.status === 'passed').length}
              </div>
            </div>
          </motion.div>
        )}

        {/* Challenges List */}
        {challenges.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#0F172A] border border-slate-800 rounded-xl p-12 text-center"
          >
            <Archive className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Challenges Yet</h3>
            <p className="text-slate-400 mb-6">You haven't started any challenges yet.</p>
            <Link
              href="/challenges"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#4FFFC8] text-[#050505] font-semibold rounded-lg hover:bg-[#4FFFC8]/90 transition-colors"
            >
              Purchase Challenge
            </Link>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {challenges.map((challenge, idx) => {
              const roi = calculateROI(challenge.startBalance, challenge.currentBalance);
              const isPositive = roi >= 0;

              return (
                <motion.div
                  key={challenge.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-[#0F172A] border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      {getStatusIcon(challenge.status)}
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-white">
                            Challenge #{challenge.id}
                          </h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(challenge.status)}`}>
                            {challenge.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-400">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            Started: {new Date(challenge.startedAt).toLocaleDateString()}
                          </div>
                          {challenge.endedAt && (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              Ended: {new Date(challenge.endedAt).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {challenge.status === 'active' && (
                      <Link
                        href="/dashboard"
                        className="px-4 py-2 bg-[#4FFFC8] text-[#050505] font-semibold rounded-lg hover:bg-[#4FFFC8]/90 transition-colors text-sm"
                      >
                        View Dashboard
                      </Link>
                    )}
                  </div>

                  {challenge.failReason && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium text-red-500 mb-1">Fail Reason</div>
                        <div className="text-sm text-slate-300">{challenge.failReason}</div>
                      </div>
                    </div>
                  </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-xs text-slate-400 mb-1">Start Balance</div>
                      <div className="text-lg font-semibold font-mono text-white">
                        ${challenge.startBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 mb-1">End Balance</div>
                      <div className="text-lg font-semibold font-mono text-white">
                        ${challenge.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 mb-1">ROI</div>
                      <div className={`text-lg font-semibold font-mono flex items-center gap-1 ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                        {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        {isPositive ? '+' : ''}{roi.toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 mb-1">Total Trades</div>
                      <div className="text-lg font-semibold font-mono text-white">
                        {challenge.tradeCount}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
