'use client';

import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Toaster, toast } from 'react-hot-toast';
import { Market, Position, Tier } from '@/lib/types';
import { useDebounce } from '@/lib/use-debounce';
// Dynamic imports for code splitting - only load when needed
import dynamic from 'next/dynamic';

const DrawdownBar = dynamic(() => import('../components/DrawdownBar'), { 
  ssr: false,
  loading: () => <div className="h-32 bg-slate-900/50 rounded animate-pulse" />
});
const MarketCard = dynamic(() => import('../components/MarketCard'), { ssr: false });
const TradePanel = dynamic(() => import('../components/TradePanel'), { 
  ssr: false,
  loading: () => null // Don't show loading for modal
});
const EquityChart = dynamic(() => import('../components/EquityChart'), { 
  ssr: false,
  loading: () => <div className="h-96 bg-slate-900/50 rounded animate-pulse" />
});
const Leaderboard = dynamic(() => import('../components/Leaderboard'), { 
  ssr: false,
  loading: () => <div className="h-64 bg-slate-900/50 rounded animate-pulse" />
});
const NewsFeed = dynamic(() => import('../components/NewsFeed'), { ssr: false });
const OutcomeSimulator = dynamic(() => import('../components/OutcomeSimulator'), { ssr: false });
const PsychologyAnalysis = dynamic(() => import('../components/PsychologyAnalysis'), { 
  ssr: false,
  loading: () => <div className="h-64 bg-slate-900/50 rounded animate-pulse" />
});
const WhaleTracker = dynamic(() => import('../components/WhaleTracker'), { 
  ssr: false,
  loading: () => <div className="h-64 bg-slate-900/50 rounded animate-pulse" />
});
const ArbitrageAlerts = dynamic(() => import('../components/ArbitrageAlerts'), { 
  ssr: false,
  loading: () => <div className="h-64 bg-slate-900/50 rounded animate-pulse" />
});
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useAuth } from '../components/AuthProvider';
import { CheckCircle2, AlertTriangle, TrendingUp, ArrowRight, Loader2, Search, Filter, Brain, Zap, TrendingUp as TrendingUpIcon, Sparkles, ChevronLeft, ChevronRight, X, Vote, Trophy, Coins, TrendingDown, Globe, Briefcase, ExternalLink, Layers, ChevronDown, ChevronUp, Check } from 'lucide-react';
import Link from 'next/link';

const fallbackTiers: Tier[] = [
  { name: 'The Scout', accountSize: 5000, fee: 49, target: 'Entry-level traders' },
  { name: 'The Analyst', accountSize: 25000, fee: 199, target: 'Experienced traders' },
  { name: 'The Strategist', accountSize: 100000, fee: 549, target: 'Professional traders' },
  { name: 'The Whale', accountSize: 250000, fee: 1099, target: 'Institutional traders' },
];

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}

function DashboardContent() {
  const { user } = useAuth();
  const [positions, setPositions] = useState<Position[]>([]);
  const [tiers, setTiers] = useState<Tier[]>(fallbackTiers);
  const [marketCatalog, setMarketCatalog] = useState<Market[]>([]);
  const [currentEquity, setCurrentEquity] = useState(0);
  const [cashBalance, setCashBalance] = useState(0);
  const [dayStartBalance, setDayStartBalance] = useState(0);
  const [startBalance, setStartBalance] = useState(0);
  const [realizedPnl, setRealizedPnl] = useState(0);
  const [unrealizedPnl, setUnrealizedPnl] = useState(0);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const [equityHistory, setEquityHistory] = useState<Array<{ date: string; equity: number; balance: number }>>([]);
  const [leaders, setLeaders] = useState<any[]>([]);
  const [requireConfirmation, setRequireConfirmation] = useState(false);
  const [hasActiveChallenge, setHasActiveChallenge] = useState<boolean | null>(null); // null = unknown, true = active, false = inactive
  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  const [failReason, setFailReason] = useState<string | null>(null);
  const [dbUserId, setDbUserId] = useState<number | null>(null);
  const [phase, setPhase] = useState<string>('phase1');
  const [profitSplitPct, setProfitSplitPct] = useState<number>(0);
  const [parlays, setParlays] = useState<any[]>([]);
  const [parlaysExpanded, setParlaysExpanded] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const lastDrawdownAlert = useRef<number>(-Infinity);
  const [selectedCategory, setSelectedCategory] = useState<string>('Trending');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [activeTab, setActiveTab] = useState<'overview' | 'intelligence'>('overview');
  const previousPricesRef = useRef<Map<string, number>>(new Map());
  const [priceChanges, setPriceChanges] = useState<Map<string, 'up' | 'down' | null>>(new Map());
  const [selectedEvent, setSelectedEvent] = useState<{ key: string; eventTitle: string; markets: Market[] } | null>(null);
  const [isTradePanelOpen, setIsTradePanelOpen] = useState(false);
  const [closingPositions, setClosingPositions] = useState<Map<string | number, 'processing' | 'success' | 'error'>>(new Map()); // Track closing status by position ID

  // Get or create user in database
  useEffect(() => {
    const setupUser = async () => {
      if (!user?.email) {
        setLoading(false);
        return;
      }

      try {
        // First, try to get existing user
        const getUserRes = await fetch(`/api/user?email=${encodeURIComponent(user.email)}`);
        
        if (getUserRes.ok) {
          const { user: dbUser } = await getUserRes.json();
          setDbUserId(dbUser.id);
        } else {
          // Create new user
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

  // Live PnL updates - refresh dashboard every 5 seconds (optimized for real-time feel)
  useEffect(() => {
    if (!dbUserId) return;

    let isMounted = true;
    let lastFetch = 0;
    const MIN_FETCH_INTERVAL = 5000; // Minimum 5 seconds between fetches
    let currentAbortController: AbortController | null = null;

    const fetchDashboard = async () => {
      const now = Date.now();
      if (now - lastFetch < MIN_FETCH_INTERVAL) return;
      lastFetch = now;

      // Cancel previous request if still pending
      if (currentAbortController) {
        currentAbortController.abort();
      }
      currentAbortController = new AbortController();
      
      // Add timeout to prevent hanging requests
      const timeoutId = setTimeout(() => {
        if (currentAbortController) {
          currentAbortController.abort();
        }
      }, 15000); // 15s timeout

      try {
        const res = await fetch(`/api/dashboard?userId=${dbUserId}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
          signal: currentAbortController.signal, // Allow cancellation
        });
        
        clearTimeout(timeoutId);
        if (!isMounted) return;
        
        // Check if request was aborted before processing
        if (currentAbortController?.signal.aborted) {
          return;
        }
        
        if (res.ok) {
          const data = await res.json();
          
          // Check again after JSON parsing (in case abort happened during parse)
          if (currentAbortController?.signal.aborted) {
            return;
          }
          
          // Update account status
          if (data.accountStatus) {
            setAccountStatus(data.accountStatus);
          }
          if (data.failReason !== undefined) {
            setFailReason(data.failReason);
          }
          
          // Check if user has an active challenge
          // CRITICAL: Must check both accountStatus === 'active' AND subscriptionId exists
          // This ensures we only show dashboard when there's actually an active subscription
          // Normalize accountStatus to handle case/whitespace issues
          const normalizedStatus = data.accountStatus ? String(data.accountStatus).trim().toLowerCase() : 'inactive';
          const hasActive = normalizedStatus === 'active' && data.subscriptionId;
          
          // Always log for debugging (helps diagnose the issue)
          console.log('[Dashboard] Challenge check:', {
            accountStatus: data.accountStatus,
            normalizedStatus: normalizedStatus,
            subscriptionId: data.subscriptionId,
            hasActive,
            failReason: data.failReason,
            rawData: {
              accountStatus: data.accountStatus,
              subscriptionId: data.subscriptionId,
            },
          });
          
          // If no active challenge, try to diagnose the issue
          if (!hasActive && dbUserId) {
            fetch(`/api/diagnose-challenge?userId=${dbUserId}`)
              .then(res => res.json())
              .then(diagnosis => {
                console.log('[Dashboard] Challenge diagnosis:', diagnosis);
              })
              .catch(err => console.error('[Dashboard] Diagnosis failed:', err));
          }
          
          if (!hasActive) {
            setHasActiveChallenge(false);
            // Reset all values when no active challenge
            setCurrentEquity(0);
            setCashBalance(0);
            setDayStartBalance(0);
            setStartBalance(0);
            setPositions([]);
            setUnrealizedPnl(0);
            setRealizedPnl(0);
            
            // Show error toast if account was just closed
            if (data.accountStatus === 'failed' && data.failReason) {
              toast.error(`Account Closed: ${data.failReason}`, {
                duration: 10000,
                icon: '🚫',
              });
            }
            return; // Don't continue processing if no active challenge
          }
          
          setHasActiveChallenge(true);
          setPositions(data.positions || []);
          setCurrentEquity(data.currentEquity ?? 0);
          setCashBalance(data.cashBalance ?? 0);
          setDayStartBalance(data.dayStartBalance ?? 0);
          
          if (data.initialBalance) {
            setStartBalance(data.initialBalance);
          }
          if (data.accountStatus) setAccountStatus(data.accountStatus);
          if (data.phase) setPhase(data.phase);
          if (data.profitSplitPct !== undefined) setProfitSplitPct(data.profitSplitPct);

          // Use parlays from dashboard API (includes live leg prices)
          if (data.parlays) {
            setParlays(data.parlays);
            // Auto-expand the first parlay on initial load
            if (data.parlays.length > 0 && parlaysExpanded.size === 0) {
              setParlaysExpanded(new Set([data.parlays[0].id]));
            }
          } else if (dbUserId) {
            fetch(`/api/parlay?userId=${dbUserId}`)
              .then(r => r.ok ? r.json() : { parlays: [] })
              .then(d => {
                setParlays(d.parlays || []);
                if (d.parlays?.length > 0 && parlaysExpanded.size === 0) {
                  setParlaysExpanded(new Set([d.parlays[0].id]));
                }
              })
              .catch(() => {});
          }

          // Use unrealized P&L from API (which uses live prices) or calculate from positions
          // The API calculates it with live prices, so prefer that
          if (data.unrealizedPnl !== undefined) {
            setUnrealizedPnl(data.unrealizedPnl);
          } else {
            // Fallback: calculate from positions if API doesn't provide it
            const unrealized = (data.positions || []).reduce((sum: number, pos: Position) => {
              if (pos.side === 'YES') {
                return sum + (pos.currentPrice - pos.entryPrice) * pos.quantity;
              } else {
                return sum + (pos.entryPrice - pos.currentPrice) * pos.quantity;
              }
            }, 0);
            setUnrealizedPnl(unrealized);
          }
          
          // Removed debug logging for performance
          
          // Fetch realized P&L from trade history (only from active challenge)
          if (data.subscriptionId) {
            fetch(`/api/trade-history?userId=${dbUserId}&activeOnly=true`)
              .then(res => res.json())
              .then(historyData => {
                const closedTrades = (historyData.trades || []).filter((t: any) => t.status === 'closed' && t.pnl !== null);
                const totalRealized = closedTrades.reduce((sum: number, t: any) => sum + (t.pnl || 0), 0);
                setRealizedPnl(totalRealized);
              })
              .catch(() => {
                setRealizedPnl(0);
              });
          } else {
            setRealizedPnl(0);
          }
        } else {
          // Handle different error types
          const errorText = await res.text().catch(() => '');
          const isDatabaseError = res.status === 503 || errorText.includes('Database connection error');
          
          if (isDatabaseError) {
            // Database connection error - don't change state, just log
            // The UI will keep showing loading or previous data
            console.warn('[Dashboard] Database connection error, will retry on next interval');
            return; // Don't update state, keep existing data
          }
          
          // For other errors, only set to false if we're sure there's no challenge
          // Don't set to false on first load if we haven't successfully loaded data yet
          if (hasActiveChallenge !== null) {
            // Only update if we previously had a challenge state
            setHasActiveChallenge(false);
            setCurrentEquity(0);
            setCashBalance(0);
            setDayStartBalance(0);
            setStartBalance(0);
            setPositions([]);
            setUnrealizedPnl(0);
            setRealizedPnl(0);
          }
        }
      } catch (error: any) {
        // Ignore aborted requests (navigation cancelled them)
        if (error?.name === 'AbortError' || error?.message?.includes('aborted')) {
          return;
        }
        console.error('Error refreshing dashboard:', error);
      }
    };

    const runRiskCheck = async () => {
      try {
        await fetch('/api/risk-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: dbUserId }),
        });
      } catch (error) {
        // Silently fail - risk check runs periodically
      }
    };

    // Initial fetch
    fetchDashboard();
    runRiskCheck();
    
    // Update every 10 seconds for live PnL tracking (optimized for performance)
    const interval = setInterval(() => {
      fetchDashboard();
    }, 10000);
    
    // Run risk check every 5 seconds (optimized from 2 seconds)
    const riskCheckInterval = setInterval(() => {
      runRiskCheck();
    }, 5000);
    
    return () => {
      isMounted = false;
      clearInterval(interval);
      clearInterval(riskCheckInterval);
      // Cancel any pending requests
      if (currentAbortController) {
        currentAbortController.abort();
      }
    };
  }, [dbUserId]);

  // Load markets independently - they don't depend on dbUserId or loading state
  useEffect(() => {
    let abortController: AbortController | null = null;
    let isMounted = true;
    
    const loadMarkets = async () => {
      // Cancel previous request
      if (abortController) {
        abortController.abort();
      }
      abortController = new AbortController();
      
      try {
        // Fetch markets with aggressive caching
        const res = await fetch('/api/markets?limit=5000', {
          cache: 'force-cache', // Use browser cache aggressively
          headers: { 'Cache-Control': 'max-age=60' }, // 60s cache
          signal: abortController.signal,
        });
        
        // Check if request was aborted before processing
        if (abortController?.signal.aborted) {
          return;
        }
        
        if (res.ok) {
          const payload = await res.json();
          
          // Check again after JSON parsing (in case abort happened during parse)
          if (abortController?.signal.aborted) {
            return;
          }
          
          if (payload?.markets) {
            // Map all fields properly like markets page
            const newMarkets = payload.markets.map((m: any) => {
              const isKalshi = m.provider?.toLowerCase() === 'kalshi';
              return {
                id: m.id,
                conditionId: m.conditionId || m.id,
                provider: (isKalshi ? 'Kalshi' : 'Polymarket') as 'Kalshi' | 'Polymarket',
                name: m.name ?? m.id,
                description: m.description || '',
                price: Number(m.price ?? 0),
                yesPrice: m.yesPrice ?? Number(m.price ?? 0),
                noPrice: m.noPrice ?? (1 - Number(m.price ?? 0)),
                outcomes: m.outcomes || [],
                marketType: m.marketType,
                eventTitle: m.eventTitle || m.name,
                change: m.change ?? 0,
                asOf: m.asOf,
                resolutionDate: m.resolutionDate,
                imageUrl: m.imageUrl || (isKalshi
                  ? ((m.conditionId || m.id || '').replace(/^kalshi-/i, '').split('-')[0]
                    ? `https://kalshi-public-docs.s3.amazonaws.com/series-images-webp/${(m.conditionId || m.id || '').replace(/^kalshi-/i, '').split('-')[0].toUpperCase()}.webp`
                    : '')
                  : 'https://polymarket.com/favicon.ico'),
                polymarketUrl: isKalshi ? '' : (m.polymarketUrl || `https://polymarket.com/event/${m.slug || m.id}`),
                kalshiUrl: m.kalshiUrl || '',
                slug: m.slug || m.id,
                volume: m.volume || 0,
                volumeFormatted: m.volumeFormatted || '$0',
                category: m.category || 'General',
                last_updated: m.last_updated || new Date().toISOString(),
              };
            });

            // Track price changes for animations using ref to avoid infinite loops
            const newPriceChanges = new Map<string, 'up' | 'down' | null>();
            const prevPrices = previousPricesRef.current;
            
            newMarkets.forEach((market: Market) => {
              const prevPrice = prevPrices.get(market.id);
              if (prevPrice !== undefined && prevPrice !== market.price) {
                newPriceChanges.set(market.id, market.price > prevPrice ? 'up' : 'down');
                // Clear animation after 2 seconds
                setTimeout(() => {
                  setPriceChanges(prevChanges => {
                    const updated = new Map(prevChanges);
                    updated.delete(market.id);
                    return updated;
                  });
                }, 2000);
              }
              // Update ref with current price
              prevPrices.set(market.id, market.price);
            });
            
            // Update price changes state
            if (newPriceChanges.size > 0) {
              setPriceChanges(prev => {
                const updated = new Map(prev);
                newPriceChanges.forEach((value, key) => updated.set(key, value));
                return updated;
              });
            }

            console.log('[Dashboard] Loaded', newMarkets.length, 'markets');
            setMarketCatalog(newMarkets);
          } else {
            console.warn('[Dashboard] No markets in API response');
          }
        } else {
          console.error('[Dashboard] Failed to fetch markets:', res.status);
        }
      } catch (error: any) {
        // Ignore AbortError - it's expected when canceling previous requests
        if (error?.name === 'AbortError' || error?.message?.includes('aborted')) {
          // Silently ignore - this is expected behavior
          return;
        }
        console.error('[Dashboard] Failed to load markets:', error);
      }
    };

    // Load markets immediately on mount
    loadMarkets();

    // Update markets every 60 seconds (markets don't change that frequently)
    const interval = setInterval(loadMarkets, 60000);
    
    return () => {
      clearInterval(interval);
    };
  }, []); // Empty deps - load once on mount

  useEffect(() => {
    if (!dbUserId || loading) return;

    const loadDashboard = async (retryCount = 0) => {
      const maxRetries = 3;
      const retryDelay = 2000; // 2 seconds
      
      try {
        // Add timeout to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
        
        // Try to load from cache first for instant display
        const cacheKey = `dashboard_${dbUserId}`;
        if (typeof window !== 'undefined') {
          const cachedData = localStorage.getItem(cacheKey);
          if (cachedData) {
            try {
              const parsed = JSON.parse(cachedData);
              const cacheAge = Date.now() - (parsed.timestamp || 0);
              // Use cache if less than 5 seconds old
              if (cacheAge < 5000 && parsed.data) {
                // Update state immediately with cached data for instant display
                setCashBalance(parsed.data.cashBalance || 0);
                setCurrentEquity(parsed.data.currentEquity || 0);
                setDayStartBalance(parsed.data.dayStartBalance || 0);
                setPositions(parsed.data.positions || []);
                // Continue with fresh fetch in background
              }
            } catch (e) {
              // Invalid cache, ignore
            }
          }
        }
        
        const res = await fetch(`/api/dashboard?userId=${dbUserId}`, {
          signal: controller.signal,
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        
        clearTimeout(timeoutId);
        
        // Check if response is ok and has content
        if (!res.ok) {
          const errorText = await res.text();
          console.error('Dashboard API error:', res.status, errorText);
          
          // Handle database connection errors gracefully with retry
          const isDatabaseError = res.status === 503 || errorText.includes('Database connection error');
          if (isDatabaseError && retryCount < maxRetries) {
            console.warn(`[Dashboard] Database connection error, retrying (${retryCount + 1}/${maxRetries})...`);
            // Retry after delay
            setTimeout(() => {
              loadDashboard(retryCount + 1);
            }, retryDelay * (retryCount + 1)); // Exponential backoff
            return;
          }
          
          if (isDatabaseError) {
            // Max retries reached, show error but don't crash
            console.error('[Dashboard] Database connection error after max retries');
            toast.error('Database connection issue. Please refresh the page in a moment.');
            setLoading(false);
            return;
          }
          
          // For other errors, only set to false if we've successfully loaded before
          // On first load, keep hasActiveChallenge as null (unknown state)
          if (hasActiveChallenge !== null) {
            setHasActiveChallenge(false);
          } else {
            setLoading(false);
          }
          return;
        }
        
        // Check if response has content before parsing JSON
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.error('Dashboard API returned non-JSON response');
          // Don't set hasActiveChallenge to false on first load
          if (hasActiveChallenge !== null) {
            setHasActiveChallenge(false);
          }
          setLoading(false);
          return;
        }
        
        const text = await res.text();
        if (!text || text.trim() === '') {
          console.error('Dashboard API returned empty response');
          // Don't set hasActiveChallenge to false on first load
          if (hasActiveChallenge !== null) {
            setHasActiveChallenge(false);
          }
          setLoading(false);
          return;
        }
        
        let data: any;
        try {
          data = JSON.parse(text);
          
          // Cache successful response for instant loading next time
          if (typeof window !== 'undefined' && data && !data.error) {
            try {
              localStorage.setItem(cacheKey, JSON.stringify({
                data: {
                  cashBalance: data.cashBalance,
                  currentEquity: data.currentEquity,
                  dayStartBalance: data.dayStartBalance,
                  positions: data.positions,
                },
                timestamp: Date.now(),
              }));
            } catch (e) {
              // Cache full, ignore
            }
          }
        } catch (parseError: any) {
          console.error('Failed to parse dashboard JSON:', parseError, 'Response:', text);
          // Don't set hasActiveChallenge to false on first load
          if (hasActiveChallenge !== null) {
            setHasActiveChallenge(false);
          }
          setLoading(false);
          return;
        }
        
        // Check for database error in response
        if (data.error && (data.error.includes('Database connection error') || data.error.includes('connection'))) {
          if (retryCount < maxRetries) {
            console.warn(`[Dashboard] Database connection error in response, retrying (${retryCount + 1}/${maxRetries})...`);
            setTimeout(() => {
              loadDashboard(retryCount + 1);
            }, retryDelay * (retryCount + 1));
            return;
          } else {
            console.error('[Dashboard] Database connection error after max retries');
            toast.error('Database connection issue. Please refresh the page in a moment.');
            setLoading(false);
            return;
          }
        }
        
        // Normalize accountStatus to handle case/whitespace
        const normalizedPollStatus = data.accountStatus
          ? String(data.accountStatus).trim().toLowerCase()
          : 'inactive';
        const hasActive = normalizedPollStatus === 'active' && data.subscriptionId;
        
        if (!hasActive) {
          setHasActiveChallenge(false);
          setLoading(false);
          setCurrentEquity(0);
          setCashBalance(0);
          setDayStartBalance(0);
          setStartBalance(0);
          setPositions([]);
          setUnrealizedPnl(0);
          setRealizedPnl(0);
          return;
        }
        
        setHasActiveChallenge(true);
        setLoading(false);
        
        setPositions(data.positions || []);
        setTiers(data.tiers || []);
        setCurrentEquity(data.currentEquity ?? 0);
        setCashBalance(data.cashBalance ?? 0);
        setDayStartBalance(data.dayStartBalance ?? 0);
        
        if (data.initialBalance) {
          setStartBalance(data.initialBalance);
        }
        if (data.phase) setPhase(data.phase);
        if (data.profitSplitPct !== undefined) setProfitSplitPct(data.profitSplitPct);
        if (data.accountStatus) setAccountStatus(data.accountStatus);
        
        // Use unrealized P&L from API (which uses live prices) or calculate from positions
        if (data.unrealizedPnl !== undefined) {
          setUnrealizedPnl(data.unrealizedPnl);
        } else {
          // Fallback: calculate from positions if API doesn't provide it
          const unrealized = (data.positions || []).reduce((sum: number, pos: Position) => {
            if (pos.side === 'YES') {
              return sum + (pos.currentPrice - pos.entryPrice) * pos.quantity;
            } else {
              return sum + (pos.entryPrice - pos.currentPrice) * pos.quantity;
            }
          }, 0);
          setUnrealizedPnl(unrealized);
        }
        
        // Fetch realized P&L from trade history (only from active challenge)
        if (data.subscriptionId) {
          fetch(`/api/trade-history?userId=${dbUserId}&activeOnly=true`)
            .then(res => res.json())
            .then(historyData => {
              const closedTrades = (historyData.trades || []).filter((t: any) => t.status === 'closed' && t.pnl !== null);
              const totalRealized = closedTrades.reduce((sum: number, t: any) => sum + (t.pnl || 0), 0);
              setRealizedPnl(totalRealized);
            })
            .catch(() => {
              setRealizedPnl(0);
            });
        } else {
          setRealizedPnl(0);
        }
      } catch (error: any) {
        // Ignore aborted requests
        if (error?.name === 'AbortError') {
          return;
        }
        
        console.error('Failed to load dashboard:', error);
        
        // Retry on network errors or connection issues
        if (retryCount < maxRetries && (
          error?.message?.includes('fetch') || 
          error?.message?.includes('network') ||
          error?.message?.includes('connection') ||
          error?.name === 'TypeError'
        )) {
          console.warn(`[Dashboard] Network error, retrying (${retryCount + 1}/${maxRetries})...`);
          setTimeout(() => {
            loadDashboard(retryCount + 1);
          }, retryDelay * (retryCount + 1));
          return;
        }
        
        // Max retries reached or non-retryable error
        if (retryCount >= maxRetries) {
          toast.error('Failed to load dashboard. Please refresh the page.');
        }
        setHasActiveChallenge(false);
        setLoading(false);
      }
    };

    const loadMarkets = async () => {
      try {
        // Fetch ALL markets (no limit or very high limit)
        const res = await fetch('/api/markets?limit=10000&_t=' + Date.now(), {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (res.ok) {
          const payload = await res.json();
          if (payload?.markets) {
            // Map all fields properly like markets page
            const newMarkets = payload.markets.map((m: any) => {
              const isKalshi = m.provider?.toLowerCase() === 'kalshi';
              return {
                id: m.id,
                conditionId: m.conditionId || m.id,
                provider: (isKalshi ? 'Kalshi' : 'Polymarket') as 'Kalshi' | 'Polymarket',
                name: m.name ?? m.id,
                description: m.description || '',
                price: Number(m.price ?? 0),
                yesPrice: m.yesPrice ?? Number(m.price ?? 0),
                noPrice: m.noPrice ?? (1 - Number(m.price ?? 0)),
                outcomes: m.outcomes || [],
                marketType: m.marketType,
                eventTitle: m.eventTitle || m.name,
                change: m.change ?? 0,
                asOf: m.asOf,
                resolutionDate: m.resolutionDate,
                imageUrl: m.imageUrl || (isKalshi
                  ? ((m.conditionId || m.id || '').replace(/^kalshi-/i, '').split('-')[0]
                    ? `https://kalshi-public-docs.s3.amazonaws.com/series-images-webp/${(m.conditionId || m.id || '').replace(/^kalshi-/i, '').split('-')[0].toUpperCase()}.webp`
                    : '')
                  : 'https://polymarket.com/favicon.ico'),
                polymarketUrl: isKalshi ? '' : (m.polymarketUrl || `https://polymarket.com/event/${m.slug || m.id}`),
                kalshiUrl: m.kalshiUrl || '',
                slug: m.slug || m.id,
                volume: m.volume || 0,
                volumeFormatted: m.volumeFormatted || '$0',
                category: m.category || 'General',
                last_updated: m.last_updated || new Date().toISOString(),
              };
            });

            // Track price changes for animations using ref to avoid infinite loops
            const newPriceChanges = new Map<string, 'up' | 'down' | null>();
            const prevPrices = previousPricesRef.current;
            
            newMarkets.forEach((market: Market) => {
              const prevPrice = prevPrices.get(market.id);
              if (prevPrice !== undefined && prevPrice !== market.price) {
                newPriceChanges.set(market.id, market.price > prevPrice ? 'up' : 'down');
                // Clear animation after 2 seconds
                setTimeout(() => {
                  setPriceChanges(prevChanges => {
                    const updated = new Map(prevChanges);
                    updated.delete(market.id);
                    return updated;
                  });
                }, 2000);
              }
              // Update ref with current price
              prevPrices.set(market.id, market.price);
            });
            
            // Update price changes state
            if (newPriceChanges.size > 0) {
              setPriceChanges(prev => {
                const updated = new Map(prev);
                newPriceChanges.forEach((value, key) => updated.set(key, value));
                return updated;
              });
            }

            setMarketCatalog(newMarkets);
          }
        }
      } catch (error: any) {
        // Ignore AbortError - it's expected when canceling previous requests
        if (error?.name === 'AbortError' || error?.message?.includes('aborted')) {
          // Silently ignore - this is expected behavior
          return;
        }
        console.error('Failed to load markets:', error);
      }
    };

    const loadLeaderboard = async () => {
      try {
        const res = await fetch('/api/leaderboard', {
          cache: 'no-store',
        });
        if (res.ok) {
          const data = await res.json();
          setLeaders(data.leaders || []);
        } else {
          // Silently fail - leaderboard is not critical
          console.warn('Leaderboard fetch failed:', res.status);
        }
      } catch (error) {
        // Silently fail - leaderboard is not critical for dashboard functionality
        console.warn('Failed to load leaderboard:', error);
      }
    };

    // Initial load - only call once
    loadDashboard();
    loadLeaderboard();

    // Load real equity history from daily snapshots
    const loadEquityHistory = async () => {
      try {
        const res = await fetch(`/api/equity-history?userId=${dbUserId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.history && data.history.length > 0) {
            setEquityHistory(data.history);
          } else {
            // If no history exists, create a basic history from current equity
            // This ensures the chart always has data to display
            const now = new Date();
            const history = [];
            // Create 30 days of history, using startBalance for past days and currentEquity for today
            for (let i = 30; i >= 0; i--) {
              const date = new Date(now);
              date.setDate(date.getDate() - i);
              // Use current equity for today, interpolate for past days
              const equity = i === 0 
                ? (currentEquity || startBalance || 0)
                : (startBalance || 0);
              history.push({
                date: date.toISOString(),
                equity: equity,
                balance: i === 0 ? (cashBalance || 0) : (startBalance || 0),
              });
            }
            setEquityHistory(history);
          }
        } else {
          // Fallback: create history from current equity
          const now = new Date();
          const history = [];
          for (let i = 30; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            history.push({
              date: date.toISOString(),
              equity: currentEquity || startBalance || 0,
              balance: cashBalance || 0,
            });
          }
          setEquityHistory(history);
        }
      } catch (error) {
        console.error('Failed to load equity history:', error);
        // Even on error, create basic history so chart shows something
        const now = new Date();
        const history = [];
        for (let i = 30; i >= 0; i--) {
          const date = new Date(now);
          date.setDate(date.getDate() - i);
          history.push({
            date: date.toISOString(),
            equity: currentEquity || startBalance || 0,
            balance: cashBalance || 0,
          });
        }
        setEquityHistory(history);
      }
    };
    
    // Load equity history initially
    loadEquityHistory();

    // Listen for trade execution events to refresh immediately (non-blocking)
    const handleTradeExecuted = (event: any) => {
      const tradeData = event.detail;
      
      // Optimistically update balance if cost/proceeds available
      if (tradeData.cost) {
        setCashBalance(prev => Math.max(0, (prev || 0) - tradeData.cost));
      } else if (tradeData.proceeds) {
        setCashBalance(prev => (prev || 0) + tradeData.proceeds);
      }
      
      // Refresh dashboard in background (non-blocking)
      // Use setTimeout to debounce rapid trades
      setTimeout(() => {
        loadDashboard();
      }, 100);
    };
    window.addEventListener('trade-executed', handleTradeExecuted);

    // Update leaderboard every 60 seconds (reduced frequency)
    const interval = setInterval(() => {
      loadLeaderboard();
    }, 60000);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('trade-executed', handleTradeExecuted);
    };
  }, [dbUserId, loading]); // Removed startBalance and previousPrices to prevent infinite loops

  // Update equity history when equity changes (real-time tracking)
  // This must be at the top level of the component, not inside another function
  useEffect(() => {
    if (currentEquity !== undefined && cashBalance !== undefined && startBalance !== undefined) {
      setEquityHistory(prev => {
        const now = new Date().toISOString();
        const newPoint = {
          date: now,
          equity: currentEquity || 0,
          balance: cashBalance || 0,
        };
        
        // If we have no history, create initial history from startBalance
        if (!prev || prev.length === 0) {
          const history = [];
          const today = new Date();
          for (let i = 30; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            history.push({
              date: date.toISOString(),
              equity: i === 0 ? (currentEquity || startBalance || 0) : (startBalance || 0),
              balance: i === 0 ? (cashBalance || 0) : (startBalance || 0),
            });
          }
          return history;
        }
        
        // Update the last point if it's from today, otherwise add a new point
        const lastPoint = prev[prev.length - 1];
        const lastDate = new Date(lastPoint.date);
        const today = new Date();
        const isSameDay = lastDate.getDate() === today.getDate() && 
                         lastDate.getMonth() === today.getMonth() && 
                         lastDate.getFullYear() === today.getFullYear();
        
        if (isSameDay) {
          // Update today's point
          const updated = [...prev];
          updated[updated.length - 1] = newPoint;
          return updated;
        } else {
          // Add new point for today, keep last 31 days
          const updated = [...prev, newPoint].slice(-31);
          return updated;
        }
      });
    }
  }, [currentEquity, cashBalance, startBalance]);

  useEffect(() => {
    if (!selectedMarket) return;
    const loadHistory = async () => {
      try {
        const res = await fetch(`/api/market-history?marketId=${selectedMarket.id}&provider=${selectedMarket.provider}`);
        if (res.ok) {
          const data = await res.json();
          setPriceHistory(data.history || []);
        }
      } catch (error) {
        console.error('Failed to load price history:', error);
      }
    };
    loadHistory();
    // Only update every 30 seconds when market is selected (optimized)
    const interval = setInterval(loadHistory, 30000);
    return () => clearInterval(interval);
  }, [selectedMarket]);

  const dailyDrawdownPct = useMemo(() => {
    const delta = currentEquity - dayStartBalance;
    return dayStartBalance ? (delta / dayStartBalance) * 100 : 0;
  }, [currentEquity, dayStartBalance]);

  // Real-time drawdown alerts
  useEffect(() => {
    const now = Date.now();
    if (now - lastDrawdownAlert.current < 60000) return;

    if (dailyDrawdownPct <= -5) {
        toast.error('Daily drawdown limit exceeded! Challenge may be terminated.', {
          duration: 10000,
          style: {
            background: '#ffffff',
            color: '#ef4444',
            border: '1px solid #ef4444',
          },
        });
        lastDrawdownAlert.current = now;
      } else if (dailyDrawdownPct <= -4) {
        toast.error('Warning: Within 1% of daily drawdown limit!', {
          duration: 8000,
          style: {
            background: '#ffffff',
            color: '#f59e0b',
            border: '1px solid #f59e0b',
          },
        });
      lastDrawdownAlert.current = now;
    }
  }, [dailyDrawdownPct]);

  // Search is now debounced via useDebounce hook

  // Memoize expensive market grouping computation
  const groupedMarkets = useMemo(() => {
    // Early return if no markets
    if (marketCatalog.length === 0) {
      return [];
    }
    
    let filtered = marketCatalog.filter(m => {
      const matchesSearch = !debouncedSearch || 
        (m.eventTitle || m.name).toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (m.description || '').toLowerCase().includes(debouncedSearch.toLowerCase());
      
      // Handle special categories (same logic as markets page)
      let matchesCat = false;
      if (selectedCategory === 'Trending') {
        matchesCat = true;
      } else if (selectedCategory === 'Breaking') {
        // Breaking: Show ALL sports and crypto markets (not just same-day), plus high volume markets
        const marketName = (m.name || '').toLowerCase();
        const marketDesc = (m.description || '').toLowerCase();
        const combined = `${marketName} ${marketDesc}`;
        
        // Check category (case-insensitive, with fallback keyword detection)
        const categoryLower = (m.category || '').toLowerCase();
        const isSports = categoryLower === 'sports' || 
                        marketName.includes('nba') || marketName.includes('nfl') || 
                        marketName.includes('nhl') || marketName.includes('mlb') ||
                        marketName.includes('soccer') || marketName.includes('football') ||
                        marketName.includes('basketball') || marketName.includes('hockey') ||
                        marketName.includes('baseball') || combined.includes(' vs ') ||
                        combined.includes('game') || combined.includes('match') ||
                        combined.includes('playoff') || combined.includes('championship');
        
        const isCrypto = categoryLower === 'crypto' || 
                         marketName.includes('bitcoin') || marketName.includes('btc') ||
                         marketName.includes('ethereum') || marketName.includes('eth') ||
                         marketName.includes('crypto') || marketName.includes('blockchain') ||
                         marketName.includes('defi') || marketName.includes('nft') ||
                         marketName.includes('solana') || marketName.includes('cardano') ||
                         marketName.includes('polygon') || marketName.includes('avalanche');
        
        const isHighVolume = (m.volume || 0) > 1000000;
        
        // Check if market resolves today (same day) - handle timezone properly
        let isSameDayByDate = false;
        if (m.resolutionDate) {
          try {
            const resolutionDate = new Date(m.resolutionDate);
            const today = new Date();
            // Compare dates (year, month, day) ignoring time
            const resYear = resolutionDate.getFullYear();
            const resMonth = resolutionDate.getMonth();
            const resDay = resolutionDate.getDate();
            const todayYear = today.getFullYear();
            const todayMonth = today.getMonth();
            const todayDay = today.getDate();
            isSameDayByDate = resYear === todayYear && resMonth === todayMonth && resDay === todayDay;
          } catch (e) {
            isSameDayByDate = false;
          }
        }
        
        // Check if market was created/updated recently (indicates active market)
        let isRecentMarket = false;
        if (m.last_updated) {
          try {
            const updatedDate = new Date(m.last_updated);
            const today = new Date();
            const hoursSinceUpdate = (today.getTime() - updatedDate.getTime()) / (1000 * 60 * 60);
            // Market updated in last 72 hours (very lenient)
            isRecentMarket = hoursSinceUpdate < 72;
          } catch (e) {
            isRecentMarket = false;
          }
        }
        
        // For CRYPTO: Detect short-term markets (15 min, hourly, daily price movements)
        // More lenient - check for ANY crypto-related keywords indicating short-term
        const isShortTermCrypto = isCrypto && (
          combined.includes('15 min') || 
          combined.includes('15-minute') ||
          combined.includes('15m') ||
          combined.includes('15 minute') ||
          combined.includes('hourly') ||
          combined.includes('hour') ||
          combined.includes('today') ||
          combined.includes('daily') ||
          combined.includes('price by end of day') ||
          combined.includes('by end of today') ||
          combined.includes('by midnight') ||
          combined.includes('intraday') ||
          combined.includes('minute') ||
          combined.includes('hour') ||
          // Check for price targets that resolve today
          (combined.includes('price') && (combined.includes('today') || combined.includes('tonight'))) ||
          // If it's crypto and recent, include it
          isRecentMarket ||
          // If it's crypto and resolves today, include it
          isSameDayByDate
        );
        
        // For SPORTS: Detect same-day game markets (over/under, spreads, game outcomes)
        // EXCLUDE long-term championship markets (2026, 2027, 2028, etc.)
        const isLongTermChampionship = combined.includes('2026') || 
                                       combined.includes('2027') || 
                                       combined.includes('2028') ||
                                       combined.includes('2029') ||
                                       combined.includes('2030') ||
                                       combined.includes('champion 202') ||
                                       combined.includes('winner 202') ||
                                       combined.includes('mvp 202');
        
        const isSameDaySports = isSports && !isLongTermChampionship && (
          isSameDayByDate ||
          (combined.includes('over') && combined.includes('under')) ||
          combined.includes('o/u') ||
          combined.includes('spread') ||
          combined.includes('total') ||
          combined.includes('points') ||
          combined.includes('tonight') ||
          combined.includes('today') ||
          (combined.includes('game') && (combined.includes('today') || combined.includes('tonight'))) ||
          // Team vs team format often indicates live games
          (combined.includes(' vs ') && (isRecentMarket || isSameDayByDate)) ||
          // Check for common game-related keywords
          (combined.includes('win') && (combined.includes('today') || combined.includes('tonight'))) ||
          (combined.includes('score') && (combined.includes('today') || combined.includes('tonight'))) ||
          // If it's sports and recent, include it (more lenient)
          isRecentMarket
        );
        
        // Include: 
        // 1. ALL crypto markets (not just short-term) - prioritize short-term
        // 2. ALL sports markets (not just same-day) - prioritize same-day
        // 3. High volume markets (but exclude long-term championships)
        // This ensures we show ALL crypto and sports, not just same-day ones
        matchesCat = isCrypto || isSports || (isHighVolume && !isLongTermChampionship);
      } else if (selectedCategory === 'New') {
        const marketDate = m.last_updated ? new Date(m.last_updated) : new Date();
        const daysSince = (Date.now() - marketDate.getTime()) / (1000 * 60 * 60 * 24);
        const isRecent = daysSince < 3;
        const isNewlyListed = (m.volume || 0) < 10000;
        matchesCat = isRecent || isNewlyListed;
      } else {
        // Simple category matching - exact or partial match
        const marketCat = (m.category || '').toLowerCase();
        const selectedCat = selectedCategory.toLowerCase();
        matchesCat = marketCat === selectedCat || 
                     marketCat.includes(selectedCat) || 
                     selectedCat.includes(marketCat) ||
                     (selectedCat === 'finance' && marketCat === 'economics') ||
                     (selectedCat === 'economy' && marketCat === 'economics');
      }
      
      return matchesSearch && matchesCat;
    });
    
    const grouped = new Map<string, Market[]>();
    filtered.forEach(market => {
      const key = market.slug || market.eventTitle || market.id;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(market);
    });

    // Convert to array and sort by total volume (sum of all markets in event)
    return Array.from(grouped.entries())
      .map(([key, eventMarkets]) => {
        const totalVolume = eventMarkets.reduce((sum, m) => sum + (m.volume || 0), 0);
        const mainMarket = eventMarkets[0]; // Use first market for display
        
        // Check if this event has same-day sports/crypto markets (enhanced detection)
        const hasSameDaySportsCrypto = eventMarkets.some(m => {
          const isSports = (m.category || '').toLowerCase() === 'sports';
          const isCrypto = (m.category || '').toLowerCase() === 'crypto';
          if (!isSports && !isCrypto) return false;
          
          const marketName = (m.name || '').toLowerCase();
          const marketDesc = (m.description || '').toLowerCase();
          const combined = `${marketName} ${marketDesc}`;
          
          // Check resolution date
          let isSameDayByDate = false;
          if (m.resolutionDate) {
            try {
              const resolutionDate = new Date(m.resolutionDate);
              const today = new Date();
              const resYear = resolutionDate.getFullYear();
              const resMonth = resolutionDate.getMonth();
              const resDay = resolutionDate.getDate();
              const todayYear = today.getFullYear();
              const todayMonth = today.getMonth();
              const todayDay = today.getDate();
              isSameDayByDate = resYear === todayYear && resMonth === todayMonth && resDay === todayDay;
            } catch (e) {
              isSameDayByDate = false;
            }
          }
          
          // Check if recently updated (active today)
          let isRecentMarket = false;
          if (m.last_updated) {
            try {
              const updatedDate = new Date(m.last_updated);
              const today = new Date();
              const hoursSinceUpdate = (today.getTime() - updatedDate.getTime()) / (1000 * 60 * 60);
              isRecentMarket = hoursSinceUpdate < 24;
            } catch (e) {
              isRecentMarket = false;
            }
          }
          
          // Crypto: Short-term markets
          if (isCrypto) {
            return isSameDayByDate || 
                   combined.includes('15 min') || 
                   combined.includes('15-minute') ||
                   combined.includes('15m') ||
                   combined.includes('hourly') ||
                   combined.includes('today') ||
                   combined.includes('daily') ||
                   (combined.includes('price') && (combined.includes('today') || combined.includes('tonight')));
          }
          
          // Sports: Same-day game markets
          if (isSports) {
            return isSameDayByDate ||
                   (combined.includes('over') && combined.includes('under')) ||
                   combined.includes('o/u') ||
                   combined.includes('spread') ||
                   combined.includes('total') ||
                   combined.includes('tonight') ||
                   combined.includes('today') ||
                   (combined.includes('game') && (combined.includes('today') || combined.includes('tonight'))) ||
                   (combined.includes(' vs ') && isRecentMarket);
          }
          
          return false;
        });
        
        return {
          key,
          eventTitle: mainMarket.eventTitle || mainMarket.name,
          imageUrl: mainMarket.imageUrl,
          totalVolume,
          hasSameDaySportsCrypto, // Flag for prioritization
          markets: eventMarkets.sort((a, b) => {
            // Sort markets within event: Main first, then by type
            if (a.marketType === 'Main') return -1;
            if (b.marketType === 'Main') return 1;
            return (a.marketType || '').localeCompare(b.marketType || '');
          }),
          mainMarket, // For card display
        };
      })
      .sort((a, b) => {
        // Prioritize same-day sports/crypto markets first
        if (a.hasSameDaySportsCrypto && !b.hasSameDaySportsCrypto) return -1;
        if (!a.hasSameDaySportsCrypto && b.hasSameDaySportsCrypto) return 1;
        // Sort by volume (most important)
        return b.totalVolume - a.totalVolume;
      })
      // Show all events (no limit) - user wants to see all markets
  }, [marketCatalog, debouncedSearch, selectedCategory]);

  // Create optimized lookup map for O(1) market access - memoized for performance
  const marketMap = useMemo(() => {
    const map = new Map<string, Market>();
    marketCatalog.forEach(m => {
      if (m.id) map.set(m.id, m);
      if (m.conditionId) map.set(m.conditionId, m);
      if (m.slug) map.set(m.slug, m);
    });
    return map;
  }, [marketCatalog]);

  // Polymarket-style categories - Match markets page exactly
  const mainCategories = [
    { id: 'Trending', label: 'Trending', icon: TrendingUp },
    { id: 'Breaking', label: 'Breaking', icon: Zap },
    { id: 'New', label: 'New', icon: Sparkles },
    { id: 'Politics', label: 'Politics', icon: Vote },
    { id: 'Sports', label: 'Sports', icon: Trophy },
    { id: 'Crypto', label: 'Crypto', icon: Coins },
    { id: 'Finance', label: 'Finance', icon: TrendingDown },
    { id: 'Geopolitics', label: 'Geopolitics', icon: Globe },
    { id: 'Earnings', label: 'Earnings', icon: Briefcase },
    { id: 'Tech', label: 'Tech' },
    { id: 'Culture', label: 'Culture' },
    { id: 'World', label: 'World' },
    { id: 'Economy', label: 'Economy' },
    { id: 'Climate & Science', label: 'Climate & Science' },
    { id: 'Elections', label: 'Elections' },
  ];

  const scrollCategories = useCallback((direction: 'left' | 'right') => {
    const container = document.getElementById('dashboard-category-scroll');
    if (container) {
      const scrollAmount = 400;
      const currentScroll = container.scrollLeft;
      const maxScroll = container.scrollWidth - container.clientWidth;
      
      if (direction === 'left') {
        container.scrollTo({
          left: Math.max(0, currentScroll - scrollAmount),
          behavior: 'smooth',
        });
      } else {
        container.scrollTo({
          left: Math.min(maxScroll, currentScroll + scrollAmount),
          behavior: 'smooth',
        });
      }
    }
  }, []);

  const handleTrade = useCallback(async (market: Market, side: 'yes' | 'no', quantity: number) => {
    // Trade executed - refresh dashboard
    window.location.reload();
  }, []);

  const handleBuy = useCallback(async (market: Market, side: 'yes' | 'no') => {
    // Find the event this market belongs to
    const eventKey = market.slug || market.eventTitle || market.id;
    const eventMarkets = groupedMarkets.find(g => g.key === eventKey)?.markets || [market];
    setSelectedEvent({
      key: eventKey,
      eventTitle: market.eventTitle || market.name,
      markets: eventMarkets,
    });
    setIsTradePanelOpen(true);
  }, [groupedMarkets]);

  const oldHandleBuy = async (market: Market, side: 'yes' | 'no') => {
    if (requireConfirmation) {
      const confirmed = window.confirm(`Buy ${side.toUpperCase()} on ${market.name} at $${market.price.toFixed(2)}?`);
      if (!confirmed) return;
    }

    const quantity = 1000;
    const cost = market.price * quantity;

    try {
      const res = await fetch('/api/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: dbUserId,
          marketId: market.id,
          provider: market.provider,
          side,
          price: market.price,
          quantity,
        }),
      });

      if (res.ok) {
        const tradeData = await res.json();
        
        // Optimistically update balance (don't wait for full dashboard refresh)
        if (tradeData.cost) {
          setCashBalance(prev => Math.max(0, (prev || 0) - tradeData.cost));
        }
        
        // Reload dashboard data in background (non-blocking)
        fetch(`/api/dashboard?userId=${dbUserId}`)
          .then(dashboardRes => dashboardRes.ok ? dashboardRes.json() : null)
          .then(dashboardData => {
            if (dashboardData) {
              setPositions(dashboardData.positions || []);
              setCurrentEquity(dashboardData.currentEquity || 0);
              setCashBalance(dashboardData.cashBalance || 0);
            }
          })
          .catch(() => {}); // Silently fail - optimistic update already applied
        
        toast.success(`Bought ${side.toUpperCase()} on ${market.name}`, {
          style: {
            background: '#ffffff',
            color: '#10b981',
            border: '1px solid #10b981',
          },
        });
      }
    } catch (error) {
      console.error('Buy failed:', error);
      toast.error('Failed to execute trade', {
        style: {
          background: '#ffffff',
          color: '#ef4444',
          border: '1px solid #ef4444',
        },
      });
    }
  };

  const handleClosePosition = async (position: Position) => {
    const positionId = position.id.startsWith('trade-')
      ? Number(position.id.replace('trade-', ''))
      : Number(position.id);
    const closePrice = position.currentPrice;

    // OPTIMISTIC UPDATE: Show processing state immediately
    setClosingPositions(prev => new Map(prev).set(positionId, 'processing'));

    try {
      const res = await fetch('/api/close-position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: dbUserId,
          positionId,
          closePrice,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        
        // Check if there's an error in the response
        if (data.error) {
          setClosingPositions(prev => new Map(prev).set(positionId, 'error'));
          toast.error(data.error, {
            style: {
              background: '#ef4444',
              color: '#ffffff',
              border: '1px solid #dc2626',
            },
          });
          // Reset to idle after error
          setTimeout(() => {
            setClosingPositions(prev => {
              const newMap = new Map(prev);
              newMap.delete(positionId);
              return newMap;
            });
          }, 2000);
          return;
        }

        // OPTIMISTIC UPDATE: Show success state immediately
        setClosingPositions(prev => new Map(prev).set(positionId, 'success'));

        // Optimistically update balance (don't wait for full dashboard refresh)
        if (data.pnl !== undefined && closePrice) {
          const proceeds = closePrice * Number(position.quantity || 0);
          setCashBalance(prev => (prev || 0) + proceeds);
          // Remove position optimistically
          setPositions(prev => prev.filter(p => p.id !== position.id));
        }

        // Reload dashboard data in background (non-blocking)
        fetch(`/api/dashboard?userId=${dbUserId}`)
          .then(dashboardRes => dashboardRes.ok ? dashboardRes.json() : null)
          .then(dashboardData => {
            if (dashboardData) {
              setPositions(dashboardData.positions || []);
              setCurrentEquity(dashboardData.currentEquity || 0);
              setCashBalance(dashboardData.cashBalance || 0);
            }
          })
          .catch(() => {}); // Silently fail - optimistic update already applied
        
        const pnlInfo = data.pnl !== undefined ? ` (PnL: ${data.pnl >= 0 ? '+' : ''}$${data.pnl.toFixed(2)})` : '';
        toast.success(`Position closed${pnlInfo}`, {
          style: {
            background: '#ffffff',
            color: '#10b981',
            border: '1px solid #10b981',
          },
        });

        // Keep success state visible for 1 second before removing
        setTimeout(() => {
          setClosingPositions(prev => {
            const newMap = new Map(prev);
            newMap.delete(positionId);
            return newMap;
          });
        }, 1000);
      } else {
        setClosingPositions(prev => new Map(prev).set(positionId, 'error'));
        let errorMessage = 'Failed to close position';
        try {
          const text = await res.text();
          if (text) {
            try {
              const error = JSON.parse(text);
              errorMessage = error.error || error.message || errorMessage;
            } catch {
              errorMessage = text.length > 100 ? 'Failed to close position' : text;
            }
          }
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
        }
        toast.error(errorMessage, {
          style: {
            background: '#ef4444',
            color: '#ffffff',
            border: '1px solid #dc2626',
          },
        });
        // Reset to idle after error
        setTimeout(() => {
          setClosingPositions(prev => {
            const newMap = new Map(prev);
            newMap.delete(positionId);
            return newMap;
          });
        }, 2000);
      }
    } catch (error) {
      setClosingPositions(prev => new Map(prev).set(positionId, 'error'));
      console.error('Close position failed:', error);
      toast.error('Failed to close position. Please try again.', {
        style: {
          background: '#ef4444',
          color: '#ffffff',
          border: '1px solid #dc2626',
        },
      });
      // Reset to idle after error
      setTimeout(() => {
        setClosingPositions(prev => {
          const newMap = new Map(prev);
          newMap.delete(positionId);
          return newMap;
        });
      }, 2000);
    }
  };

  const getResolutionDate = (marketId: string): string => {
    const dates: Record<string, string> = {
      'kalshi.election_2024': new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      'polymarket.superbowl_mvp': new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      'kalshi.cpi_print': new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    };
    return dates[marketId] || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  };

  // Welcome state for users with no active challenge
  // Only show "No Active Challenge" if we've confirmed there's no active challenge (hasActiveChallenge === false)
  // Don't show it if we're still loading (hasActiveChallenge === null) or if we have an active challenge (hasActiveChallenge === true)
  if (hasActiveChallenge === false && !loading) {
    return (
      <div className="min-h-screen bg-grid-trading flex items-center justify-center px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl w-full text-center"
        >
          <div className="glass-dark rounded-xl p-12">
            <AlertTriangle className="w-16 h-16 text-slate-600 mx-auto mb-6" />
            <h2 className="text-2xl font-semibold text-white mb-4">No Active Challenge</h2>
            <p className="text-slate-400 mb-6">
              {accountStatus === 'failed' && failReason
                ? `Your previous challenge was closed: ${failReason}`
                : "You don't have an active challenge. Purchase a new challenge to start trading."}
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link
                href="/challenges"
                className="px-6 py-3 bg-[#4FFFC8] text-black font-bold rounded-full shadow-[0_0_20px_rgba(79,255,200,0.3)] hover:bg-[#3debb8] transition-colors"
              >
                Purchase Challenge
              </Link>
              <Link
                href="/archive"
                className="px-6 py-3 bg-transparent border border-[#1A1A1A] text-white font-semibold rounded-full hover:border-[#4FFFC8]/30 transition-colors"
              >
                View Archive
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Show loading state - consistent between server and client
  if (loading) {
    return (
      <div className="min-h-screen bg-grid-trading flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#4FFFC8] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-grid-trading" suppressHydrationWarning>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#0F172A',
            color: '#e2e8f0',
            border: '1px solid #1e293b',
          },
        }}
      />

      {/* Main Content - Bento Grid Layout */}
      <main className="pt-3">
        <div className="w-full px-6 pb-12">
          {/* Command Header - Single Horizontal Bar */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 glass-dark rounded-xl p-4"
          >
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2">
                <span className="text-[9px] font-black text-slate-500 uppercase">EQUITY:</span>
                <span className="font-mono text-white text-sm sm:text-base">${currentEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse ml-1 hidden sm:block"></div>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2">
                <span className="text-[9px] font-black text-slate-500 uppercase">CASH:</span>
                <span className="font-mono text-white text-sm sm:text-base">${cashBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2">
                <span className="text-[9px] font-black text-slate-500 uppercase">REALIZED P&L:</span>
                <span className={`font-mono text-sm sm:text-base ${realizedPnl >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                  {realizedPnl >= 0 ? '+' : ''}${Math.abs(realizedPnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2">
                <span className="text-[9px] font-black text-slate-500 uppercase">UNREALIZED P&L:</span>
                <span className={`font-mono text-sm sm:text-base ${unrealizedPnl >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                  {unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2">
                <span className="text-[9px] font-black text-slate-500 uppercase">DAILY LOSS:</span>
                <span className={`font-mono text-sm sm:text-base ${dailyDrawdownPct <= -5 ? 'text-[#ef4444]' : dailyDrawdownPct <= -4 ? 'text-[#f59e0b]' : 'text-white'}`}>
                  {dailyDrawdownPct.toFixed(2)}%
                </span>
              </div>
            </div>
          </motion.div>

          {/* Bento Grid Layout */}
          <div className="grid grid-cols-12 gap-6">
            {/* Main Stage - Center (Equity Curve + Open Positions) */}
            <div className="col-span-12 lg:col-span-8 space-y-6">
              {/* Equity Curve */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-dark rounded-xl p-6"
              >
                <h2 className="text-xl font-semibold text-white mb-4 tracking-tight">Equity Curve</h2>
                <EquityChart data={equityHistory} />
              </motion.div>

              {/* Open Positions - Terminal Ledger Style */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-dark rounded-xl p-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-white tracking-tight">Open Positions</h2>
                  <span className="text-[9px] font-black text-slate-500 uppercase bg-white/5 px-3 py-1 rounded">
                    {positions.length} ACTIVE
                  </span>
                </div>

                {positions.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <div className="text-4xl mb-4">
                      <TrendingUp className="w-16 h-16 mx-auto text-slate-700" />
                    </div>
                    <div>No open positions. Start trading to see positions here.</div>
                  </div>
                ) : (
                  <div className="space-y-0">
                    {/* Header Row - Hidden on mobile */}
                    <div className="hidden md:grid grid-cols-12 gap-4 pb-3 border-b border-white/5 mb-3">
                      <div className="col-span-4 text-[9px] font-black text-slate-500 uppercase">MARKET</div>
                      <div className="col-span-1 text-[9px] font-black text-slate-500 uppercase text-center">SIDE</div>
                      <div className="col-span-1 text-[9px] font-black text-slate-500 uppercase text-right">ENTRY</div>
                      <div className="col-span-1 text-[9px] font-black text-slate-500 uppercase text-right">CURRENT</div>
                      <div className="col-span-1 text-[9px] font-black text-slate-500 uppercase text-right">QTY</div>
                      <div className="col-span-2 text-[9px] font-black text-slate-500 uppercase text-right">P&L</div>
                      <div className="col-span-2 text-[9px] font-black text-slate-500 uppercase text-center">ACTIONS</div>
                    </div>
                    {/* Position Rows */}
                    {positions.map((pos, idx) => {
                      const pnl = pos.side === 'YES'
                        ? (pos.currentPrice - pos.entryPrice) * pos.quantity
                        : (pos.entryPrice - pos.currentPrice) * pos.quantity;
                      
                      // Fast O(1) lookup using Map
                      let market: Market | undefined = marketMap.get(pos.marketId) || marketMap.get(pos.marketId.replace(/^trade-/, ''));
                      // Fallback to find if not in map (for partial matches)
                      if (!market && marketCatalog.length > 0) {
                        market = marketCatalog.find(m => 
                          m.id === pos.marketId || 
                          m.conditionId === pos.marketId ||
                          m.id.includes(pos.marketId) ||
                          pos.marketId.includes(m.id)
                        );
                      }
                      // Resolve display name: prefer market catalog name, then pos.marketName, then format raw ID
                      const isRawId = /^\d+$/.test(pos.marketName) || pos.marketName.startsWith('Market ');
                      const resolvedName = market
                        ? (market.eventTitle || market.name || pos.marketName)
                        : (isRawId ? pos.marketName : pos.marketName);
                    
                      const eventMarkets = groupedMarkets.find(g => 
                        g.markets.some(m => 
                          m.id === pos.marketId || 
                          m.conditionId === pos.marketId ||
                          m.id.includes(pos.marketId) ||
                          pos.marketId.includes(m.id)
                        )
                      );
                      
                      const handleViewMarket = () => {
                        if (market) {
                          const marketsToShow = eventMarkets?.markets || [market];
                          setSelectedEvent({
                            key: eventMarkets?.key || market.slug || market.id,
                            eventTitle: market.eventTitle || market.name,
                            markets: marketsToShow,
                          });
                          setIsTradePanelOpen(true);
                        } else {
                          // Fallback: try to open with position data
                          toast.error('Market data not loaded yet. Please wait a moment and try again.');
                        }
                      };
                      
                      // Build external URL — prefer API-stored URL, then market data, then safe fallback
                      const getExternalUrl = () => {
                        // 1. Stored URL from market_metadata (most reliable)
                        if ((pos as any).externalUrl) return (pos as any).externalUrl;

                        if (pos.provider === 'Kalshi' || market?.provider === 'Kalshi') {
                          if ((market as any)?.kalshiUrl) return (market as any).kalshiUrl;
                          // Use series_ticker prefix for Kalshi (e.g. /markets/kxeth)
                          const raw = market?.slug || market?.conditionId || pos.marketId.replace(/^kalshi-/i, '');
                          const seriesPart = raw.split('-')[0].toLowerCase();
                          if (seriesPart && seriesPart.length > 2) {
                            return `https://kalshi.com/markets/${seriesPart}`;
                          }
                          return 'https://kalshi.com/markets';
                        }

                        // Polymarket: only use slug-based URLs (condition IDs cause 404)
                        if (market?.polymarketUrl) return market.polymarketUrl;
                        if (market?.slug && !market.slug.startsWith('0x') && market.slug.length > 5) {
                          return `https://polymarket.com/event/${market.slug}`;
                        }
                        return 'https://polymarket.com';
                      };
                      
                      const polymarketUrl = getExternalUrl();
                      
                      return (
                        <motion.div
                          key={pos.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 + idx * 0.05 }}
                          className="grid grid-cols-12 gap-2 md:gap-4 py-3 border-b border-white/5 last:border-0"
                        >
                          {/* Mobile Layout */}
                          <div className="md:hidden col-span-12 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="font-bold text-white text-sm truncate flex-1 mr-2 flex items-center gap-2">
                                {/* Provider badge — mobile */}
                                {pos.provider === 'Kalshi' ? (
                                  <span className="flex-shrink-0 text-[8px] px-1.5 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                    <span className="w-1 h-1 rounded-full bg-emerald-400" />K
                                  </span>
                                ) : (
                                  <span className="flex-shrink-0 text-[8px] px-1.5 py-0.5 rounded-full font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center gap-1">
                                    <span className="w-1 h-1 rounded-full bg-blue-400" />P
                                  </span>
                                )}
                                <span className="truncate">{resolvedName}</span>
                              </div>
                              <span className={`text-xs font-medium px-2 py-1 rounded ${
                                pos.side === 'YES' ? 'text-[#10b981] bg-[#10b981]/10' : 'text-[#ef4444] bg-[#ef4444]/10'
                              }`}>
                                {pos.side}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div>
                                <div className="text-slate-500 text-[9px] uppercase mb-1">ENTRY</div>
                                <div className="font-mono text-white">${pos.entryPrice.toFixed(2)}</div>
                              </div>
                              <div>
                                <div className="text-slate-500 text-[9px] uppercase mb-1">CURRENT</div>
                                <div className="font-mono text-white">${pos.currentPrice.toFixed(2)}</div>
                              </div>
                              <div>
                                <div className="text-slate-500 text-[9px] uppercase mb-1">QTY</div>
                                <div className="font-mono text-white">{pos.quantity}</div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-white/5">
                              <div>
                                <div className="text-slate-500 text-[9px] uppercase mb-1">P&L</div>
                                <div className={`font-mono ${pnl >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                                  {pnl >= 0 ? '+' : ''}${Math.abs(pnl).toFixed(2)}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                {polymarketUrl && (
                                  <a
                                    href={polymarketUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1.5 bg-slate-900/50 hover:bg-slate-900 text-white text-xs rounded-lg transition-colors"
                                  >
                                    View
                                  </a>
                                )}
                                <button
                                  onClick={handleViewMarket}
                                  className="px-3 py-1.5 bg-[#4FFFC8] hover:bg-[#3debb8] text-black text-xs font-bold rounded-full shadow-[0_0_15px_rgba(79,255,200,0.25)] transition-colors"
                                >
                                  Trade
                                </button>
                              </div>
                            </div>
                          </div>
                          
                          {/* Desktop Layout */}
                          <div className="hidden md:col-span-4 md:flex items-center gap-2 font-bold text-white text-sm">
                            {/* Provider badge — desktop */}
                            {pos.provider === 'Kalshi' ? (
                              <span className="flex-shrink-0 text-[8px] px-1.5 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-emerald-400" />KALSHI
                              </span>
                            ) : (
                              <span className="flex-shrink-0 text-[8px] px-1.5 py-0.5 rounded-full font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-blue-400" />POLY
                              </span>
                            )}
                            <span className="truncate">{resolvedName}</span>
                          </div>
                          <div className="hidden md:col-span-1 md:block text-center">
                            <span className={`text-xs font-medium ${
                              pos.side === 'YES' ? 'text-[#10b981]' : 'text-[#ef4444]'
                            }`}>
                              {pos.side}
                            </span>
                          </div>
                          <div className="hidden md:col-span-1 md:block text-right font-mono text-white text-sm">${pos.entryPrice.toFixed(2)}</div>
                          <div className="hidden md:col-span-1 md:block text-right font-mono text-white text-sm">${pos.currentPrice.toFixed(2)}</div>
                          <div className="hidden md:col-span-1 md:block text-right font-mono text-white text-sm">{pos.quantity.toLocaleString()}</div>
                          <div className={`hidden md:col-span-2 md:block text-right font-mono font-bold text-sm ${
                            pnl >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'
                          }`}>
                            {pnl >= 0 ? '+' : ''}${pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </div>
                          <div className="hidden md:col-span-2 md:flex items-center justify-center gap-2">
                            {/* Polymarket Link */}
                            {polymarketUrl && (
                              <a
                                href={polymarketUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-1.5 text-slate-500 hover:text-[#3b82f6] hover:bg-white/5 rounded transition-all"
                                title="View on Polymarket"
                              >
                                <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
                              </a>
                            )}
                            {/* Chart Button - Always show, but disable if market not loaded */}
                            <button
                              onClick={handleViewMarket}
                              disabled={!market}
                              className="p-1.5 text-slate-500 hover:text-white hover:bg-white/5 rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                              title={market ? "View market chart" : "Loading market data..."}
                            >
                              <TrendingUp className="w-3.5 h-3.5" strokeWidth={1.5} />
                            </button>
                            {/* Close Button */}
                            <button
                              onClick={() => handleClosePosition(pos)}
                              disabled={closingPositions.has(pos.id.startsWith('trade-') ? Number(pos.id.replace('trade-', '')) : Number(pos.id))}
                              className="p-1.5 text-slate-500 hover:text-[#ef4444] hover:bg-white/5 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Close position"
                            >
                              {(() => {
                                const posId = pos.id.startsWith('trade-') ? Number(pos.id.replace('trade-', '')) : Number(pos.id);
                                const status = closingPositions.get(posId);
                                if (status === 'processing') {
                                  return <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />;
                                } else if (status === 'success') {
                                  return <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981]" strokeWidth={1.5} />;
                                } else if (status === 'error') {
                                  return <AlertTriangle className="w-3.5 h-3.5 text-[#ef4444]" strokeWidth={1.5} />;
                                } else {
                                  return <X className="w-3.5 h-3.5" strokeWidth={1.5} />;
                                }
                              })()}
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            </div>

            {/* Side Panels - Right (Phase Badge + Multi-Bets + Top Traders + Risk Rules) */}
            <div className="col-span-12 lg:col-span-4 space-y-6">

              {/* Phase Status Card */}
              {(() => {
                const PHASE_INFO: Record<string, { label: string; target: string; color: string }> = {
                  phase1: { label: 'Phase 1 — Challenge', target: '+10% profit', color: '#4FFFC8' },
                  phase2: { label: 'Phase 2 — Verification', target: '+5% profit', color: '#f59e0b' },
                  funded: { label: 'Funded Trader', target: '80% profit split', color: '#a78bfa' },
                };
                const info = PHASE_INFO[phase] || PHASE_INFO.phase1;
                const profitTarget = phase === 'phase1' ? 10 : phase === 'phase2' ? 5 : null;
                const totalReturnPct = startBalance > 0
                  ? ((currentEquity - startBalance) / startBalance) * 100 : 0;
                const profitProgress = profitTarget !== null
                  ? Math.min(100, Math.max(0, (totalReturnPct / profitTarget) * 100)) : 100;
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-dark rounded-xl p-5"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-[9px] font-black tracking-[0.2em] text-slate-500 uppercase mb-0.5">Current Phase</div>
                        <div className="text-sm font-bold" style={{ color: info.color }}>{info.label}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] font-black tracking-[0.2em] text-slate-500 uppercase mb-0.5">Target</div>
                        <div className="text-sm font-bold" style={{ color: info.color }}>{info.target}</div>
                      </div>
                    </div>
                    {profitTarget !== null ? (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] text-slate-500">Progress</span>
                          <span className="text-[10px] font-bold text-white">
                            {totalReturnPct >= 0 ? '+' : ''}{totalReturnPct.toFixed(2)}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${profitProgress}%`, backgroundColor: profitProgress >= 100 ? '#4FFFC8' : info.color }} />
                        </div>
                        {profitProgress >= 100 && (
                          <div className="mt-2 text-[9px] font-black text-[#4FFFC8] tracking-widest">
                            TARGET REACHED — ADVANCING
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-500">You earn {profitSplitPct}% of all profits generated.</div>
                    )}
                  </motion.div>
                );
              })()}

              {/* Multi-Bets / Parlays */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-dark rounded-xl p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-violet-400" />
                    <h2 className="text-base font-semibold text-white tracking-tight">Multi-Bets</h2>
                  </div>
                  <span className="text-[9px] font-black text-slate-500 uppercase bg-white/5 px-2 py-1 rounded">
                    {parlays.length} PLACED
                  </span>
                </div>

                {parlays.length === 0 ? (
                  <div className="text-center py-6">
                    <Layers className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                    <p className="text-slate-500 text-sm">No parlays yet</p>
                    <p className="text-slate-600 text-[11px] mt-1">Use Multi-Bet mode in the Markets tab</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                    {parlays.map((parlay: any) => {
                      const isExpanded = parlaysExpanded.has(parlay.id);
                      const statusColors: Record<string, string> = {
                        pending: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
                        won: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
                        lost: 'text-red-400 bg-red-500/10 border-red-500/20',
                        cancelled: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
                      };
                      const legs: any[] = parlay.legs || [];

                      // Win probability = product of each leg's current implied probability
                      const winProbability = legs.reduce((acc: number, leg: any) => {
                        const cp = leg.currentPrice ?? leg.price ?? 0.5;
                        const legProb = leg.outcome === 'yes' ? cp : 1 - cp;
                        return acc * Math.max(0.01, Math.min(0.99, legProb));
                      }, 1);
                      const winPct = (winProbability * 100);
                      const legsWon = legs.filter((l: any) => l.status === 'won').length;
                      const legsLost = legs.filter((l: any) => l.status === 'lost').length;

                      return (
                        <div key={parlay.id} className="rounded-xl border border-white/5 overflow-hidden">
                          <button
                            onClick={() => setParlaysExpanded(prev => {
                              const next = new Set(prev);
                              if (next.has(parlay.id)) next.delete(parlay.id);
                              else next.add(parlay.id);
                              return next;
                            })}
                            className="w-full p-3 hover:bg-white/[0.02] transition-colors text-left space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${statusColors[parlay.status] || statusColors.pending}`}>
                                  {(parlay.status || 'PENDING').toUpperCase()}
                                </span>
                                <span className="text-[11px] text-slate-300 font-medium">
                                  {legs.length} legs · {Number(parlay.combined_multiplier).toFixed(2)}x
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <div className="text-[10px] text-slate-500">stake</div>
                                  <div className="text-[11px] font-bold text-white">${Number(parlay.stake).toFixed(2)}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-[10px] text-slate-500">payout</div>
                                  <div className={`text-[11px] font-bold ${parlay.status === 'won' ? 'text-emerald-400' : 'text-violet-300'}`}>
                                    ${Number(parlay.potential_payout).toFixed(2)}
                                  </div>
                                </div>
                                <div
                                  title={isExpanded ? 'Collapse legs' : 'Expand legs & odds'}
                                  className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                                    isExpanded ? 'bg-violet-500/20 text-violet-400' : 'bg-slate-500/20 text-slate-400'
                                  } hover:bg-violet-500/30`}
                                >
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </div>
                              </div>
                            </div>
                            {/* Win probability bar — always visible */}
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${Math.min(100, Math.max(1, winPct))}%`,
                                    backgroundColor: winPct >= 50 ? '#4FFFC8' : winPct >= 20 ? '#f59e0b' : '#ef4444',
                                  }}
                                />
                              </div>
                              <span className={`text-[10px] font-black font-mono flex-shrink-0 ${winPct >= 50 ? 'text-emerald-400' : winPct >= 20 ? 'text-amber-400' : 'text-red-400'}`}>
                                {winPct < 0.1 ? '<0.1' : winPct.toFixed(1)}%
                              </span>
                            </div>
                          </button>
                          {isExpanded && (
                            <div className="border-t border-white/5 px-3 pb-3 pt-2 space-y-2">
                              {/* Odds Tracker */}
                              <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Win Probability</span>
                                  <span className={`text-[11px] font-black font-mono ${winPct >= 50 ? 'text-emerald-400' : winPct >= 20 ? 'text-amber-400' : 'text-red-400'}`}>
                                    {winPct < 0.1 ? '<0.1' : winPct.toFixed(1)}%
                                  </span>
                                </div>
                                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                      width: `${Math.min(100, Math.max(1, winPct))}%`,
                                      backgroundColor: winPct >= 50 ? '#4FFFC8' : winPct >= 20 ? '#f59e0b' : '#ef4444',
                                    }}
                                  />
                                </div>
                                {(legsWon > 0 || legsLost > 0) && (
                                  <div className="flex gap-3 mt-1.5">
                                    {legsWon > 0 && <span className="text-[9px] text-emerald-400">{legsWon} won</span>}
                                    {legsLost > 0 && <span className="text-[9px] text-red-400">{legsLost} lost</span>}
                                    <span className="text-[9px] text-slate-500">{legs.length - legsWon - legsLost} pending</span>
                                  </div>
                                )}
                              </div>

                              {/* Individual Legs */}
                              <div className="space-y-1">
                                {legs.map((leg: any, i: number) => {
                                  const legCurrentPrice = leg.currentPrice ?? leg.price;
                                  const priceChange = legCurrentPrice - leg.price;
                                  const legProb = leg.outcome === 'yes' ? legCurrentPrice : 1 - legCurrentPrice;
                                  const legProbPct = (legProb * 100);
                                  return (
                                    <div key={i} className="p-1.5 rounded-lg hover:bg-white/[0.02] transition-colors">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className="text-[9px] text-slate-600 flex-shrink-0">#{i + 1}</span>
                                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase flex-shrink-0 ${
                                            leg.outcome === 'yes' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                                          }`}>{leg.outcome}</span>
                                          <span className="text-[10px] text-slate-400 truncate">{leg.marketName}</span>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                          {leg.status && leg.status !== 'pending' ? (
                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                                              leg.status === 'won' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                                            }`}>
                                              {leg.status.toUpperCase()}
                                            </span>
                                          ) : (
                                            <span className={`text-[9px] font-mono font-bold ${legProbPct >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                              {legProbPct.toFixed(0)}%
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      {/* Leg price tracker */}
                                      <div className="flex items-center gap-3 mt-1 ml-6">
                                        <span className="text-[9px] text-slate-600">Entry {(leg.price * 100).toFixed(1)}¢</span>
                                        <span className="text-[9px] text-slate-500">→</span>
                                        <span className="text-[9px] text-white font-mono">{(legCurrentPrice * 100).toFixed(1)}¢</span>
                                        {priceChange !== 0 && (
                                          <span className={`text-[9px] font-bold ${priceChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {priceChange >= 0 ? '+' : ''}{(priceChange * 100).toFixed(1)}¢
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              <div className="pt-1 text-[9px] text-slate-600">
                                Placed {new Date(parlay.placed_at).toLocaleDateString()}
                                {parlay.settled_at && ` · Settled ${new Date(parlay.settled_at).toLocaleDateString()}`}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>

              {/* Top Traders */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="glass-dark rounded-xl p-6"
              >
                <Leaderboard leaders={leaders} />
              </motion.div>

              {/* Risk Rules */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-dark rounded-xl p-6"
              >
                <h2 className="text-xl font-semibold text-white mb-6 tracking-tight">Risk Rules</h2>
                <div className="space-y-3">
                  <div className="p-3 bg-[#ef4444]/10 rounded-lg border border-[#ef4444]/30">
                    <div className="font-semibold text-[#ef4444] text-sm mb-1">Max Total Drawdown</div>
                    <div className="text-xs text-[#fca5a5]">Kill if equity &lt; 90% of initial</div>
                  </div>
                  <div className="p-3 bg-[#f59e0b]/10 rounded-lg border border-[#f59e0b]/30">
                    <div className="font-semibold text-[#f59e0b] text-sm mb-1">Max Daily Loss</div>
                    <div className="text-xs text-[#fbbf24]">Kill if equity &lt; 95% of start-of-day</div>
                  </div>
                  <div className="p-3 bg-[#3b82f6]/10 rounded-lg border border-[#3b82f6]/30">
                    <div className="font-semibold text-[#3b82f6] text-sm mb-1">Max Position Size</div>
                    <div className="text-xs text-[#60a5fa]">Single event ≤ 20% of equity</div>
                  </div>
                  <div className="p-3 bg-slate-900/50 rounded-lg border border-white/5">
                    <div className="font-semibold text-slate-400 text-sm mb-1">Inactivity</div>
                    <div className="text-xs text-slate-500">Auto-close after 30 days idle</div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Active Markets Section - Full Market Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mt-6 glass-dark rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white tracking-tight">Active Markets</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" strokeWidth={1.5} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search markets..."
                  className="pl-10 pr-4 py-2 bg-[#0f0f0f]/80 border border-[#1A1A1A] rounded-full text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#4FFFC8] focus:border-transparent transition-colors w-48"
                />
              </div>
            </div>

            {/* Category Filters - Match Markets Page Exactly */}
            <div className="w-full mb-6">
              <div
                id="dashboard-category-scroll"
                className="flex gap-x-8 py-2.5 items-center overflow-x-auto scroll-smooth px-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                style={{ 
                  WebkitOverflowScrolling: 'touch',
                  scrollPaddingLeft: '24px',
                  scrollPaddingRight: '24px'
                }}
              >
                {mainCategories.map((category) => {
                  const Icon = category.icon;
                  const isSelected = selectedCategory === category.id;
                  return (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={`relative flex items-center gap-2 px-4 py-2 whitespace-nowrap transition-all flex-shrink-0 rounded-full ${
                        isSelected
                          ? 'tab-capsule-active'
                          : 'text-slate-500 hover:text-white'
                      }`}
                    >
                      {Icon && <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />}
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em]">{category.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Filtered Markets - Full MarketCard Components */}
            {groupedMarkets.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <p className="text-lg mb-2">No markets found</p>
                <p className="text-sm">Try adjusting your filters or search</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {groupedMarkets.map((group) => (
                  <MarketCard
                    key={group.key}
                    market={group.markets[0]}
                    onBuy={handleBuy}
                    onSelect={(market) => {
                      const eventMarkets = groupedMarkets.find(g => g.key === group.key)?.markets || [market];
                      setSelectedEvent({
                        key: group.key,
                        eventTitle: group.eventTitle,
                        markets: eventMarkets,
                      });
                      setIsTradePanelOpen(true);
                    }}
                    isSelected={selectedEvent?.key === group.key}
                    marketCount={group.markets.length}
                  />
                ))}
              </div>
            )}
          </motion.div>

          {/* TradePanel - Rendered as overlay */}
          {selectedEvent && (
            <TradePanel
              market={selectedEvent.markets[0]}
              eventMarkets={selectedEvent.markets}
              eventTitle={selectedEvent.eventTitle}
              isOpen={isTradePanelOpen}
              onClose={() => {
                setIsTradePanelOpen(false);
                setSelectedEvent(null);
              }}
              onTrade={handleTrade}
            />
          )}

      
      {/* TradePanel - Rendered as overlay */}
      {selectedEvent && (
        <TradePanel
          market={selectedEvent.markets[0]}
          eventMarkets={selectedEvent.markets}
          eventTitle={selectedEvent.eventTitle}
          isOpen={isTradePanelOpen}
          onClose={() => {
            setIsTradePanelOpen(false);
            setSelectedEvent(null);
          }}
          onTrade={handleTrade}
        />
      )}
        </div>
      </main>
    </div>
  );
}

