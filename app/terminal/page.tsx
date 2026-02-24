'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Zap,
  Search,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Radio,
  ArrowRight,
  Volume2,
  VolumeX,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  BarChart3,
  Target,
  Wifi,
  WifiOff,
  Users,
  DollarSign,
  Eye,
  Layers,
  Globe,
  Shield,
  Copy,
  Check,
  Maximize2,
  X,
  Settings,
  Info,
} from 'lucide-react';
import Link from 'next/link';
import { Market } from '@/lib/types';
import TradePanel from '../components/TradePanel';
import { useAuth } from '../components/AuthProvider';
import { toast } from 'react-hot-toast';

// ============================================================================
// TYPES (mirrored from terminal-engine)
// ============================================================================

interface TerminalTrade {
  id: string;
  provider: 'Polymarket' | 'Kalshi';
  type: 'BUY' | 'SELL' | 'FILL' | 'ORDER' | 'FEE_REFUND';
  marketId: string;
  marketName: string;
  side: 'Yes' | 'No' | 'Up' | 'Down';
  price: number;
  priceCents: string;
  shares: number;
  notional: number;
  fee: number;
  timestamp: string;
  walletAddress?: string;
  isWhale: boolean;
  externalUrl?: string;
  slug?: string;
  category?: string;
}

interface WhaleAlert {
  id: string;
  provider: 'Polymarket' | 'Kalshi';
  marketId: string;
  marketName: string;
  side: 'Yes' | 'No';
  notional: number;
  price: number;
  shares: number;
  walletAddress?: string;
  timestamp: string;
  externalUrl?: string;
}

interface ArbitrageSignal {
  id: string;
  marketName: string;
  polymarketPrice: number;
  kalshiPrice: number;
  spread: number;
  spreadPct: number;
  direction: 'buy-kalshi' | 'buy-polymarket';
  profitPer1000: number;
  timestamp: string;
}

interface MarketTick {
  id: string;
  provider: 'Polymarket' | 'Kalshi';
  name: string;
  price: number;
  prevPrice: number;
  change: number;
  volume: number;
  category: string;
  timestamp: string;
}

interface WalletProfile {
  address: string;
  totalPnl: number;
  realizedPnl: number;
  volume: number;
  trades: number;
  winRate: number;
  roi: number;
  profitFactor: number;
  avgTradeSize: number;
  positions: number;
  activePositions: number;
  walletAge: string;
  bestTrade: number;
  worstTrade: number;
  winStreak: { wins: number; losses: number };
  tradingSince: string;
  cohort: string;
}

interface TerminalStats {
  totalTrades: number;
  totalVolume: number;
  avgTradeSize: number;
  whaleCount: number;
  arbCount: number;
  uptime: number;
  rate: string;
  polymarketConnected: boolean;
  kalshiConnected: boolean;
  lastUpdate: string;
}

// ============================================================================
// TUTORIAL SLIDES
// ============================================================================

const TUTORIAL_SLIDES = [
  {
    title: 'Live Ticker',
    icon: '📡',
    description: 'Watch every trade across Polymarket and Kalshi in real-time. Trades flow in as they happen — BUYs, SELLs, FILLs, and ORDERs from both platforms are merged into a single unified stream.',
    color: '#4FFFC8',
  },
  {
    title: 'Instant Trade ⚡',
    icon: '⚡',
    description: 'Hit the lightning bolt on any trade to instantly copy it with your preset share amount. Configure your default shares in the settings gear. One click = trade executed. No confirmation needed.',
    color: '#FBBF24',
  },
  {
    title: 'Whale Alerts 🐋',
    icon: '🐋',
    description: 'Large trades over $5,000 are automatically flagged and appear in the Whale Alerts tab. Follow the smart money — whale movements often signal major market shifts before they happen.',
    color: '#F59E0B',
  },
  {
    title: 'Arbitrage Scanner',
    icon: '🔀',
    description: 'The engine continuously scans both Polymarket and Kalshi for price discrepancies on the same events. When the spread exceeds 3%, an opportunity is flagged with the exact profit potential per $1,000.',
    color: '#7B61FF',
  },
  {
    title: 'Market Scanner',
    icon: '🔍',
    description: 'Browse all live markets across both platforms in a sortable table. Filter by provider, category, or search by name. See real-time price changes and volume at a glance.',
    color: '#3B82F6',
  },
  {
    title: 'Activity Heatmap',
    icon: '🟩',
    description: 'The 60-second heatmap at the top shows trade intensity over the last minute. Brighter bars = more trades. Use it to gauge market activity levels and identify bursts of trading.',
    color: '#4FFFC8',
  },
];

// ============================================================================
// MAIN TERMINAL PAGE
// ============================================================================

type TabId = 'live' | 'whales' | 'arbitrage' | 'scanner' | 'wallet';

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: 'live', label: 'Live Ticker', icon: Radio },
  { id: 'whales', label: 'Whale Alerts', icon: Eye },
  { id: 'arbitrage', label: 'Arbitrage', icon: Zap },
  { id: 'scanner', label: 'Scanner', icon: Search },
  { id: 'wallet', label: 'Wallet', icon: Users },
];

export default function TerminalPage() {
  // ── State ──
  const [activeTab, setActiveTab] = useState<TabId>('live');
  const [trades, setTrades] = useState<TerminalTrade[]>([]);
  const [whaleAlerts, setWhaleAlerts] = useState<WhaleAlert[]>([]);
  const [arbSignals, setArbSignals] = useState<ArbitrageSignal[]>([]);
  const [marketTicks, setMarketTicks] = useState<MarketTick[]>([]);
  const [stats, setStats] = useState<TerminalStats | null>(null);
  const [walletAddress, setWalletAddress] = useState('');
  const [walletProfile, setWalletProfile] = useState<WalletProfile | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [connected, setConnected] = useState(false);
  const [scannerFilter, setScannerFilter] = useState<'all' | 'Polymarket' | 'Kalshi'>('all');
  const [scannerCategory, setScannerCategory] = useState('All');
  const [scannerSearch, setScannerSearch] = useState('');
  const [liveSubTab, setLiveSubTab] = useState<'all' | 'orders' | 'fills'>('all');
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [quickTradeMarket, setQuickTradeMarket] = useState<Market | null>(null);
  const [isQuickTradeOpen, setIsQuickTradeOpen] = useState(false);
  const [copiedTrade, setCopiedTrade] = useState<string | null>(null);

  // ── Instant Trade State ──
  const [instantTradeShares, setInstantTradeShares] = useState<number>(10);
  const [showInstantSettings, setShowInstantSettings] = useState(false);
  const [instantTradeProcessing, setInstantTradeProcessing] = useState<string | null>(null);
  const [instantTradeSuccess, setInstantTradeSuccess] = useState<string | null>(null);

  // ── Tutorial State ──
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialSlide, setTutorialSlide] = useState(0);

  const tradeListRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const userIdCacheRef = useRef<number | null>(null);
  const seenWhaleIdsRef = useRef<Set<string>>(new Set());

  const { user } = useAuth();

  // ── Load instant trade settings from localStorage ──
  useEffect(() => {
    try {
      const saved = localStorage.getItem('terminal-instant-shares');
      if (saved) setInstantTradeShares(Number(saved) || 10);
      const tutorialSeen = localStorage.getItem('terminal-tutorial-seen');
      if (!tutorialSeen) setShowTutorial(true);
    } catch {}
  }, []);

  // ── Save instant trade shares ──
  const updateInstantShares = useCallback((val: number) => {
    const clamped = Math.max(1, Math.min(10000, val));
    setInstantTradeShares(clamped);
    try { localStorage.setItem('terminal-instant-shares', String(clamped)); } catch {}
  }, []);

  // ── Dismiss tutorial ──
  const dismissTutorial = useCallback(() => {
    setShowTutorial(false);
    try { localStorage.setItem('terminal-tutorial-seen', '1'); } catch {}
  }, []);

  // ── Sound Effect ──
  useEffect(() => {
    audioRef.current = new Audio('/trade-click.mp3');
    audioRef.current.volume = 0.15;
  }, []);

  const playClick = useCallback(() => {
    if (soundEnabled && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  }, [soundEnabled]);

  // ── Get or create userId (cached) ──
  const getUserId = useCallback(async (): Promise<number | null> => {
    if (userIdCacheRef.current) return userIdCacheRef.current;
    if (!user?.email) return null;

    try {
      const res = await fetch(`/api/user?email=${encodeURIComponent(user.email)}`);
      if (res.ok) {
        const { user: dbUser } = await res.json();
        if (dbUser?.id) {
          userIdCacheRef.current = dbUser.id;
          return dbUser.id;
        }
      }
      // Create user if not found
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
        const data = await createRes.json();
        const id = data.userId ?? data.user?.id ?? null;
        if (id) userIdCacheRef.current = id;
        return id;
      }
    } catch (err) {
      console.warn('[Terminal] getUserId error:', err);
    }
    return null;
  }, [user]);

  // ── Copy Trade to Clipboard ──
  const copyTrade = useCallback((trade: TerminalTrade | WhaleAlert) => {
    const typePart = 'type' in trade ? (trade as TerminalTrade).type : 'BUY';
    const pricePart = 'priceCents' in trade ? (trade as TerminalTrade).priceCents : `${(trade.price * 100).toFixed(1)}¢`;
    const tradeText = `${trade.provider} ${typePart} ${trade.side} ${trade.shares} shares @ ${pricePart} - ${trade.marketName}`;
    navigator.clipboard.writeText(tradeText).then(() => {
      setCopiedTrade(trade.id);
      setTimeout(() => setCopiedTrade(null), 2000);
    });
  }, []);

  // ── Helpers ──
  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 } as any);
    } catch { return '--:--:--'; }
  };

  const formatUSD = (n: number) => {
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
  };

  const formatPnl = (n: number) => {
    const sign = n >= 0 ? '+' : '';
    return `${sign}${formatUSD(n)}`;
  };

  // ── Build Market object from trade data ──
  const buildMarketFromTrade = useCallback((trade: TerminalTrade | WhaleAlert, tradeProvider?: string): Market => {
    const provider = (trade.provider || tradeProvider || 'Polymarket') as 'Polymarket' | 'Kalshi';
    const price = trade.price;
    return {
      id: trade.marketId || 'unknown',
      conditionId: trade.marketId || '',
      provider,
      name: trade.marketName,
      eventTitle: trade.marketName,
      price,
      yesPrice: price,
      noPrice: 1 - price,
      imageUrl: '',
      polymarketUrl: provider === 'Polymarket' ? ('externalUrl' in trade ? (trade as TerminalTrade).externalUrl || '' : '') : '',
      kalshiUrl: provider === 'Kalshi' ? (trade.externalUrl || '') : '',
      slug: ('slug' in trade ? (trade as TerminalTrade).slug : '') || '',
      volume: trade.notional || 0,
      volumeFormatted: formatUSD(trade.notional || 0),
      category: ('category' in trade ? (trade as TerminalTrade).category : '') || 'General',
      last_updated: trade.timestamp || new Date().toISOString(),
    };
  }, []);

  // ══════════════════════════════════════════════════════════════════════════
  // INSTANT TRADE — executes immediately, no confirmation
  // ══════════════════════════════════════════════════════════════════════════
  const executeInstantTrade = useCallback(async (trade: TerminalTrade | WhaleAlert) => {
    if (!user) {
      toast.error('Please sign in to trade');
      return;
    }

    const tradeId = trade.id;
    setInstantTradeProcessing(tradeId);

    try {
      const userId = await getUserId();
      if (!userId) {
        toast.error('Could not resolve account — please refresh');
        setInstantTradeProcessing(null);
        return;
      }

      const side = (trade.side === 'Yes' || trade.side === 'Up') ? 'yes' : 'no';
      const market = buildMarketFromTrade(trade);

      const res = await fetch('/api/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          marketId: market.id || market.conditionId,
          provider: (market.provider || 'polymarket').toLowerCase(),
          side,
          outcome: trade.side,
          price: trade.price,
          quantity: instantTradeShares,
        }),
      });

      const data = await res.json();

      if (res.ok && !data.error) {
        setInstantTradeSuccess(tradeId);
        playClick();
        toast.success(
          `⚡ Instant: ${instantTradeShares} ${trade.side} @ ${(trade.price * 100).toFixed(1)}¢`,
          { style: { background: '#0a0a0a', color: '#4FFFC8', border: '1px solid #4FFFC8' }, duration: 2000 }
        );
        setTimeout(() => setInstantTradeSuccess(null), 2000);
      } else {
        const errMsg = data.error || 'Trade failed';
        if (errMsg.includes('No active challenge')) {
          toast.error('No active challenge — purchase one first');
        } else if (errMsg.includes('Insufficient')) {
          toast.error('Insufficient balance for this trade');
        } else {
          toast.error(`Trade failed: ${errMsg}`);
        }
      }
    } catch (err: any) {
      console.error('[InstantTrade] Error:', err);
      toast.error('Network error — try again');
    } finally {
      setInstantTradeProcessing(null);
    }
  }, [user, getUserId, instantTradeShares, buildMarketFromTrade, playClick]);

  // ── Open Trade Panel (expand button — full trade UI) ──
  const openTradePanel = useCallback((trade: TerminalTrade | WhaleAlert) => {
    const market = buildMarketFromTrade(trade);
    setQuickTradeMarket(market);
    setIsQuickTradeOpen(true);
  }, [buildMarketFromTrade]);

  // ── Open Market Modal (view full market card) ──
  const openMarketModal = useCallback((trade: TerminalTrade | WhaleAlert) => {
    const market = buildMarketFromTrade(trade);
    setSelectedMarket(market);
  }, [buildMarketFromTrade]);

  // ── Data Polling (optimized: immediate fetch + 2s interval) ──
  const tradesRef = useRef<TerminalTrade[]>([]);
  tradesRef.current = trades;

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const poll = async () => {
      try {
        const res = await fetch('/api/terminal/feed', { signal: controller.signal });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();

        if (!mounted) return;

        // Check for new trades (for sound)
        if (data.trades?.length > 0 && tradesRef.current.length > 0) {
          const prevIds = new Set(tradesRef.current.map((t: TerminalTrade) => t.id));
          const newCount = data.trades.filter((t: TerminalTrade) => !prevIds.has(t.id)).length;
          if (newCount > 0) playClick();
        }

        setTrades(data.trades || []);

        // ── Deduplicate whale alerts ──
        const incomingWhales: WhaleAlert[] = data.whaleAlerts || [];
        const uniqueWhales: WhaleAlert[] = [];
        for (const w of incomingWhales) {
          // Create a stable key from provider + marketId + side + notional + timestamp
          const key = `${w.provider}-${w.marketId}-${w.side}-${w.notional}-${w.timestamp}`;
          if (!seenWhaleIdsRef.current.has(key)) {
            seenWhaleIdsRef.current.add(key);
            uniqueWhales.push(w);
          }
        }
        // Merge with existing (keep most recent first, cap at 50)
        setWhaleAlerts(prev => {
          const prevIds = new Set(prev.map(w => w.id));
          const brandNew = uniqueWhales.filter(w => !prevIds.has(w.id));
          return [...brandNew, ...prev].slice(0, 50);
        });

        setArbSignals(data.arbSignals || []);
        setMarketTicks(data.marketTicks || []);
        setStats(data.stats || null);
        setConnected(true);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        console.warn('[Terminal] Poll error:', err);
        setConnected(false);
      }
    };

    poll(); // Immediate fetch on mount
    const interval = setInterval(poll, 2000);

    return () => {
      mounted = false;
      controller.abort();
      clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playClick]);

  // ── Auto-scroll trade list ──
  useEffect(() => {
    if (tradeListRef.current && activeTab === 'live') {
      tradeListRef.current.scrollTop = 0;
    }
  }, [trades, activeTab]);

  // ── Wallet Lookup ──
  const handleWalletLookup = async () => {
    if (!walletAddress.trim()) return;
    setWalletLoading(true);
    try {
      const res = await fetch(`/api/terminal/wallet?address=${encodeURIComponent(walletAddress.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setWalletProfile(data);
      } else {
        setWalletProfile(null);
      }
    } catch (err) {
      console.warn('[Terminal] Wallet lookup error:', err);
      setWalletProfile(null);
    } finally {
      setWalletLoading(false);
    }
  };

  // ── Filtered scanner ticks ──
  const filteredTicks = useMemo(() => marketTicks.filter(t => {
    if (scannerFilter !== 'all' && t.provider !== scannerFilter) return false;
    if (scannerCategory !== 'All' && t.category !== scannerCategory) return false;
    if (scannerSearch && !t.name.toLowerCase().includes(scannerSearch.toLowerCase())) return false;
    return true;
  }), [marketTicks, scannerFilter, scannerCategory, scannerSearch]);

  const categories = useMemo(() => ['All', ...Array.from(new Set(marketTicks.map(t => t.category)))], [marketTicks]);

  // ── Filtered live trades ──
  const filteredTrades = useMemo(() => trades.filter(t => {
    if (liveSubTab === 'orders' && t.type !== 'ORDER') return false;
    if (liveSubTab === 'fills' && t.type !== 'FILL' && t.type !== 'BUY' && t.type !== 'SELL') return false;
    return true;
  }), [trades, liveSubTab]);

  // ── Activity Heatmap (last 60 seconds) ──
  const heatmapDots = useMemo(() => Array.from({ length: 60 }, (_, i) => {
    const secondAgo = 59 - i;
    const cutoff = Date.now() - secondAgo * 1000;
    const cutoffEnd = cutoff + 1000;
    const count = trades.filter(t => {
      const ts = new Date(t.timestamp).getTime();
      return ts >= cutoff && ts < cutoffEnd;
    }).length;
    return count;
  }), [trades]);

  // ── Action Buttons Component (reused in Live Ticker + Whale Alerts) ──
  const ActionButtons = ({ trade, isWhaleContext }: { trade: TerminalTrade | WhaleAlert; isWhaleContext?: boolean }) => (
    <div className="flex items-center gap-1 flex-shrink-0">
      {/* ⚡ INSTANT TRADE — executes immediately */}
      <button
        onClick={() => executeInstantTrade(trade)}
        disabled={instantTradeProcessing === trade.id}
        className={`p-1.5 rounded-md transition-colors group relative ${
          instantTradeSuccess === trade.id
            ? 'bg-[#4FFFC8]/30'
            : instantTradeProcessing === trade.id
              ? 'bg-amber-500/20 animate-pulse'
              : 'hover:bg-[#4FFFC8]/20'
        }`}
        title={`Instant trade: ${instantTradeShares} shares ${trade.side}`}
      >
        {instantTradeSuccess === trade.id ? (
          <Check className="w-3.5 h-3.5 text-[#4FFFC8]" />
        ) : instantTradeProcessing === trade.id ? (
          <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
        ) : (
          <Zap className="w-3.5 h-3.5 text-[#4FFFC8]/70 group-hover:text-[#4FFFC8]" />
        )}
      </button>

      {/* 📋 COPY TRADE — clipboard */}
      <button
        onClick={() => copyTrade(trade)}
        className="p-1.5 rounded-md hover:bg-white/10 transition-colors group"
        title="Copy trade details"
      >
        {copiedTrade === trade.id ? (
          <Check className="w-3.5 h-3.5 text-[#4FFFC8]" />
        ) : (
          <Copy className="w-3.5 h-3.5 text-slate-500 group-hover:text-white" />
        )}
      </button>

      {/* 🔲 EXPAND — opens full trade panel */}
      <button
        onClick={() => openTradePanel(trade)}
        className="p-1.5 rounded-md hover:bg-white/10 transition-colors group"
        title="Open trade panel"
      >
        <Maximize2 className="w-3.5 h-3.5 text-slate-500 group-hover:text-white" />
      </button>

      {/* 🔗 EXTERNAL LINK */}
      <a
        href={trade.externalUrl || (trade.provider === 'Kalshi' ? `https://kalshi.com/markets` : `https://polymarket.com`)}
        target="_blank"
        rel="noopener noreferrer"
        className="p-1.5 rounded-md hover:bg-white/10 transition-colors group"
        title={`Open on ${trade.provider}`}
      >
        <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-[#4FFFC8]" />
      </a>
    </div>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-[#050505] bg-grid-trading text-white font-[family-name:var(--font-inter)] overflow-hidden">

      {/* ══════════════════════════════════════════════════════════════════════
          TUTORIAL SLIDESHOW OVERLAY
          ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showTutorial && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
            onClick={dismissTutorial}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-lg bg-[#0a0a0a] border border-[#1A1A1A] rounded-2xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Slide content */}
              <div className="p-8 text-center">
                <div className="text-5xl mb-4">{TUTORIAL_SLIDES[tutorialSlide].icon}</div>
                <h2 className="text-2xl font-bold text-white mb-3">
                  {TUTORIAL_SLIDES[tutorialSlide].title}
                </h2>
                <p className="text-sm text-slate-400 leading-relaxed max-w-md mx-auto">
                  {TUTORIAL_SLIDES[tutorialSlide].description}
                </p>
              </div>

              {/* Dots + Navigation */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-[#1A1A1A]">
                <button
                  onClick={() => setTutorialSlide(s => Math.max(0, s - 1))}
                  disabled={tutorialSlide === 0}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5 text-slate-400" />
                </button>

                <div className="flex items-center gap-2">
                  {TUTORIAL_SLIDES.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setTutorialSlide(i)}
                      className={`w-2 h-2 rounded-full transition-all ${
                        i === tutorialSlide ? 'bg-[#4FFFC8] w-6' : 'bg-slate-600 hover:bg-slate-400'
                      }`}
                    />
                  ))}
                </div>

                {tutorialSlide < TUTORIAL_SLIDES.length - 1 ? (
                  <button
                    onClick={() => setTutorialSlide(s => s + 1)}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </button>
                ) : (
                  <button
                    onClick={dismissTutorial}
                    className="px-4 py-1.5 rounded-full bg-[#4FFFC8] text-black font-bold text-xs hover:bg-[#3de6b3] transition-colors"
                  >
                    Start Trading
                  </button>
                )}
              </div>

              {/* Skip button */}
              <div className="px-6 pb-4 text-center">
                <button
                  onClick={dismissTutorial}
                  className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
                >
                  Skip tutorial
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top Banner ── */}
      <div className="border-b border-[#1A1A1A] bg-[#0a0a0a]">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span className="text-[#4FFFC8] font-bold border border-[#4FFFC8]/30 rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-wider bg-[#4FFFC8]/10">
              Live
            </span>
            <span className="text-slate-400">
              Powered by <span className="text-white font-semibold">Prop Market Terminal</span> — real-time prediction market analytics
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Tutorial help button */}
            <button
              onClick={() => { setTutorialSlide(0); setShowTutorial(true); }}
              className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
              title="Terminal guide"
            >
              <Info className="w-3.5 h-3.5 text-slate-500 hover:text-white" />
            </button>
            <Link href="/markets" className="text-[#4FFFC8] hover:text-white transition-colors font-medium flex items-center gap-1">
              Browse Markets <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Status Bar ── */}
      <div className="border-b border-[#1A1A1A] bg-[#0a0a0a]/50">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            {/* Connection Status */}
            <div className="flex items-center gap-2">
              {connected ? (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#4FFFC8] animate-pulse" />
                  <span className="text-[#4FFFC8] font-bold text-sm">LIVE</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-red-400 font-bold text-sm">OFFLINE</span>
                </div>
              )}
            </div>

            {/* Uptime */}
            <div className="flex items-center gap-4 text-xs">
              <div className="text-center">
                <span className="text-white font-mono font-bold text-lg">{stats?.uptime || 0}s</span>
                <span className="block text-slate-500 uppercase tracking-wider text-[9px]">Uptime</span>
              </div>
              <div className="text-center">
                <span className="text-[#4FFFC8] font-mono font-bold text-lg">{stats?.rate || '0/s'}</span>
                <span className="block text-slate-500 uppercase tracking-wider text-[9px]">Rate</span>
              </div>
            </div>

            {/* Provider Status */}
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                {stats?.polymarketConnected ? (
                  <Wifi className="w-3 h-3 text-blue-400" />
                ) : (
                  <WifiOff className="w-3 h-3 text-red-400" />
                )}
                <span className={stats?.polymarketConnected ? 'text-blue-400' : 'text-red-400'}>Poly</span>
              </div>
              <div className="flex items-center gap-1.5">
                {stats?.kalshiConnected ? (
                  <Wifi className="w-3 h-3 text-emerald-400" />
                ) : (
                  <WifiOff className="w-3 h-3 text-red-400" />
                )}
                <span className={stats?.kalshiConnected ? 'text-emerald-400' : 'text-red-400'}>Kalshi</span>
              </div>
            </div>
          </div>

          {/* Right: Instant Trade Settings + Sound + Stats */}
          <div className="flex items-center gap-4">
            {/* Instant Trade Settings */}
            <div className="relative">
              <button
                onClick={() => setShowInstantSettings(!showInstantSettings)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                  showInstantSettings
                    ? 'border-[#4FFFC8]/50 bg-[#4FFFC8]/10 text-[#4FFFC8]'
                    : 'border-[#1A1A1A] text-slate-400 hover:text-white hover:border-slate-600'
                }`}
              >
                <Zap className="w-3 h-3" />
                <span>{instantTradeShares} shares</span>
                <Settings className="w-3 h-3" />
              </button>

              {/* Settings Dropdown */}
              <AnimatePresence>
                {showInstantSettings && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="absolute top-full right-0 mt-2 w-64 bg-[#0a0a0a] border border-[#1A1A1A] rounded-xl p-4 z-50 shadow-2xl"
                  >
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">
                      ⚡ Instant Trade Settings
                    </h4>
                    <p className="text-[11px] text-slate-500 mb-3">
                      How many shares to auto-buy when you press the ⚡ button. Trade executes instantly — no confirmation.
                    </p>
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        type="number"
                        min={1}
                        max={10000}
                        value={instantTradeShares}
                        onChange={(e) => updateInstantShares(Number(e.target.value))}
                        className="flex-1 bg-white/[0.03] border border-[#1A1A1A] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#4FFFC8]/40"
                      />
                      <span className="text-xs text-slate-500">shares</span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {[5, 10, 25, 50, 100, 250].map(v => (
                        <button
                          key={v}
                          onClick={() => updateInstantShares(v)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                            instantTradeShares === v
                              ? 'bg-[#4FFFC8]/20 text-[#4FFFC8] border border-[#4FFFC8]/30'
                              : 'bg-white/5 text-slate-400 hover:text-white border border-transparent'
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span>Trades: <span className="text-white font-mono">{stats?.totalTrades || 0}</span></span>
              <span>Vol: <span className="text-white font-mono">{formatUSD(stats?.totalVolume || 0)}</span></span>
              <span>🐋 <span className="text-white font-mono">{stats?.whaleCount || 0}</span></span>
              <span>⚡ <span className="text-white font-mono">{stats?.arbCount || 0}</span></span>
            </div>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
              title={soundEnabled ? 'Mute' : 'Unmute'}
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-[#4FFFC8]" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-500" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Activity Heatmap ── */}
      <div className="border-b border-[#1A1A1A] bg-[#080808]">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-2">
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-slate-500 uppercase tracking-wider font-bold w-16 flex-shrink-0">60s Map</span>
            <div className="flex gap-[2px] flex-1">
              {heatmapDots.map((count, i) => (
                <div
                  key={i}
                  className="h-3 flex-1 rounded-[1px] transition-colors"
                  style={{
                    backgroundColor: count === 0
                      ? 'rgba(255,255,255,0.03)'
                      : count <= 2
                        ? 'rgba(79,255,200,0.2)'
                        : count <= 5
                          ? 'rgba(79,255,200,0.5)'
                          : 'rgba(79,255,200,0.9)',
                  }}
                  title={`${count} trades`}
                />
              ))}
            </div>
            <span className="text-[9px] text-slate-500 uppercase tracking-wider font-bold w-8 text-right flex-shrink-0">Now</span>
          </div>
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <div className="border-b border-[#1A1A1A]">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-1 py-2 overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-gradient-to-r from-[#4FFFC8]/20 to-[#7B61FF]/20 text-white border border-[#4FFFC8]/30'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {tab.id === 'whales' && (whaleAlerts.length > 0) && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  )}
                  {tab.id === 'arbitrage' && (arbSignals.length > 0) && (
                    <span className="w-2 h-2 rounded-full bg-[#4FFFC8] animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div className="flex-1 overflow-y-auto max-w-[1800px] w-full mx-auto px-4 sm:px-6 py-4">
        <AnimatePresence mode="wait">
          {/* ════════════════════════════════════════════════════════════════════
              LIVE TICKER TAB (THE FIREPLACE)
              ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'live' && (
            <motion.div
              key="live"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {/* Sub-tabs */}
              <div className="flex items-center gap-2 mb-6">
                {(['all', 'orders', 'fills'] as const).map((sub) => (
                  <button
                    key={sub}
                    onClick={() => setLiveSubTab(sub)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                      liveSubTab === sub
                        ? 'bg-[#4FFFC8]/15 text-[#4FFFC8] border border-[#4FFFC8]/30'
                        : 'text-slate-500 hover:text-white'
                    }`}
                  >
                    {sub === 'all' ? 'All' : sub === 'orders' ? 'Orders' : 'Activity'}
                  </button>
                ))}
                <div className="flex-1" />
                <span className="text-xs text-slate-500">
                  Server-side stream · <span className="text-white">{filteredTrades.length}</span> trades
                </span>
              </div>

              {/* Trade Feed */}
              <div
                ref={tradeListRef}
                className="space-y-1 overflow-y-auto scrollbar-thin pr-2"
              >
                {filteredTrades.length === 0 ? (
                  <div className="text-center py-20 text-slate-500">
                    <Radio className="w-8 h-8 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">Waiting for trades...</p>
                    <p className="text-xs mt-1 text-slate-600">The stream will populate as markets are active</p>
                  </div>
                ) : (
                  filteredTrades.map((trade, idx) => (
                    <motion.div
                      key={trade.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.15, delay: idx < 5 ? idx * 0.03 : 0 }}
                      className={`flex items-center gap-4 px-4 py-3 rounded-lg border transition-colors ${
                        trade.isWhale
                          ? 'bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10'
                          : 'bg-white/[0.02] border-[#1A1A1A] hover:bg-white/[0.04]'
                      }`}
                    >
                      {/* Provider badge */}
                      <div className="flex items-center gap-2 flex-shrink-0 w-36">
                        {trade.provider === 'Kalshi' ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-emerald-400" />KALSHI
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-blue-400" />POLY
                          </span>
                        )}
                      </div>

                      {/* Type + Side badges */}
                      <div className="flex items-center gap-1.5 flex-shrink-0 w-28">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                          trade.type === 'ORDER' || trade.type === 'BUY'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : trade.type === 'SELL'
                              ? 'bg-red-500/20 text-red-400'
                              : trade.type === 'FEE_REFUND'
                                ? 'bg-purple-500/20 text-purple-400'
                                : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {trade.type === 'FEE_REFUND' ? 'REFUND' : trade.type}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                          trade.side === 'Yes' || trade.side === 'Up'
                            ? 'bg-[#4FFFC8]/15 text-[#4FFFC8]'
                            : 'bg-red-500/15 text-red-400'
                        }`}>
                          {trade.side}
                        </span>
                      </div>

                      {/* Timestamp */}
                      <span className="text-[10px] font-mono text-slate-500 flex-shrink-0 w-28">
                        {formatTime(trade.timestamp)}
                      </span>

                      {/* Market name */}
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-white truncate block">
                          {trade.marketName}
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          {trade.side} @ {trade.priceCents} · {trade.shares} shares · fee ${trade.fee.toFixed(2)}
                          {trade.walletAddress && (
                            <span className="ml-2 text-slate-600">{trade.walletAddress}</span>
                          )}
                        </span>
                      </div>

                      {/* Notional */}
                      <span className={`text-sm font-mono font-bold flex-shrink-0 w-24 text-right ${
                        trade.isWhale ? 'text-amber-400' : 'text-white'
                      }`}>
                        {trade.isWhale && '🐋 '}
                        {formatUSD(trade.notional)}
                      </span>

                      {/* Action Buttons */}
                      <ActionButtons trade={trade} />
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              WHALE ALERTS TAB
              ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'whales' && (
            <motion.div
              key="whales"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    🐋 Whale Sightings
                    <span className="text-xs font-normal text-slate-500">Trades &gt; ${WHALE_THRESHOLD_DISPLAY}</span>
                  </h2>
                </div>
                <span className="text-xs text-slate-500">
                  {whaleAlerts.length} unique sightings
                </span>
              </div>

              {whaleAlerts.length === 0 ? (
                <div className="text-center py-20 border border-[#1A1A1A] rounded-xl bg-white/[0.02]">
                  <Eye className="w-8 h-8 mx-auto mb-3 text-slate-600" />
                  <p className="text-slate-400 text-sm">No whale activity detected yet</p>
                  <p className="text-xs text-slate-600 mt-1">Monitoring for trades exceeding ${WHALE_THRESHOLD_DISPLAY}...</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {whaleAlerts.map((whale) => (
                    <div
                      key={whale.id}
                      className="flex items-center gap-4 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-colors"
                    >
                      <div className="text-3xl">🐋</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white truncate">{whale.marketName}</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {whale.provider} · {whale.side} @ {(whale.price * 100).toFixed(1)}¢ · {whale.shares} shares
                          {whale.walletAddress && (
                            <span className="ml-2 text-amber-400/60">{whale.walletAddress}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 flex flex-col items-end gap-2">
                        <div>
                          <div className="text-lg font-mono font-bold text-amber-400">{formatUSD(whale.notional)}</div>
                          <div className="text-[10px] text-slate-500">{formatTime(whale.timestamp)}</div>
                        </div>
                        {/* Action Buttons */}
                        <ActionButtons trade={whale} isWhaleContext />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              ARBITRAGE TAB
              ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'arbitrage' && (
            <motion.div
              key="arbitrage"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Zap className="w-5 h-5 text-[#4FFFC8]" />
                    Cross-Market Arbitrage
                    <span className="text-xs font-normal text-slate-500">Polymarket ↔ Kalshi spreads &gt; 3%</span>
                  </h2>
                </div>
                <span className="text-xs text-slate-500">
                  {arbSignals.length} opportunities
                </span>
              </div>

              {/* How it works */}
              <div className="border border-[#1A1A1A] rounded-xl p-4 mb-6 bg-white/[0.02]">
                <p className="text-xs text-slate-500 leading-relaxed">
                  <span className="text-white font-bold">How it works:</span> We compare YES prices on the same event across Polymarket and Kalshi.
                  If <code className="text-[#4FFFC8] bg-[#4FFFC8]/10 px-1 rounded">Poly_Yes + Kalshi_No &lt; 0.98</code> (after fees), there&apos;s an arbitrage window.
                  The engine scans every 5 seconds across all matched markets.
                </p>
              </div>

              {arbSignals.length === 0 ? (
                <div className="text-center py-20 border border-[#1A1A1A] rounded-xl bg-white/[0.02]">
                  <Zap className="w-8 h-8 mx-auto mb-3 text-slate-600" />
                  <p className="text-slate-400 text-sm">No arbitrage opportunities right now</p>
                  <p className="text-xs text-slate-600 mt-1">Scanning cross-platform spreads...</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {arbSignals.map((arb) => (
                    <div
                      key={arb.id}
                      className="p-4 rounded-xl border border-[#4FFFC8]/20 bg-[#4FFFC8]/5 hover:bg-[#4FFFC8]/10 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-white truncate flex-1 mr-4">
                          {arb.marketName}
                        </span>
                        <span className="text-lg font-mono font-bold text-[#4FFFC8]">
                          {arb.spreadPct.toFixed(1)}% spread
                        </span>
                      </div>

                      <div className="flex items-center gap-8 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">POLY</span>
                          <span className="text-white font-mono">{(arb.polymarketPrice * 100).toFixed(1)}¢</span>
                        </div>
                        <div className="text-slate-500">vs</div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">KALSHI</span>
                          <span className="text-white font-mono">{(arb.kalshiPrice * 100).toFixed(1)}¢</span>
                        </div>
                        <div className="flex-1" />
                        <div className="text-right">
                          <span className="text-[#4FFFC8] font-bold">~${arb.profitPer1000}/1K</span>
                          <span className="text-slate-500 ml-2">{arb.direction === 'buy-kalshi' ? 'Buy Kalshi' : 'Buy Poly'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              SCANNER TAB
              ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'scanner' && (
            <motion.div
              key="scanner"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3 mb-6">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={scannerSearch}
                    onChange={(e) => setScannerSearch(e.target.value)}
                    placeholder="Search markets..."
                    className="w-full bg-white/[0.03] border border-[#1A1A1A] rounded-full pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-[#4FFFC8]/40"
                  />
                </div>

                {/* Provider filter */}
                <div className="flex items-center gap-1 bg-white/[0.03] rounded-full p-1">
                  {(['all', 'Polymarket', 'Kalshi'] as const).map((src) => (
                    <button
                      key={src}
                      onClick={() => setScannerFilter(src)}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                        scannerFilter === src
                          ? src === 'Kalshi' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
                          : 'text-slate-500 hover:text-white'
                      }`}
                    >
                      {src === 'all' ? 'All' : src}
                    </button>
                  ))}
                </div>

                {/* Category filter */}
                <select
                  value={scannerCategory}
                  onChange={(e) => setScannerCategory(e.target.value)}
                  className="bg-white/[0.03] border border-[#1A1A1A] rounded-full px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#4FFFC8]/40 appearance-none cursor-pointer"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat} className="bg-[#0a0a0a]">{cat}</option>
                  ))}
                </select>
              </div>

              {/* Market Table */}
              <div className="border border-[#1A1A1A] rounded-xl overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-white/[0.02] text-[9px] font-bold text-slate-500 uppercase tracking-wider border-b border-[#1A1A1A]">
                  <div className="col-span-1">Source</div>
                  <div className="col-span-4">Market</div>
                  <div className="col-span-2 text-right">Price</div>
                  <div className="col-span-2 text-right">Change</div>
                  <div className="col-span-2 text-right">Volume</div>
                  <div className="col-span-1 text-right">Category</div>
                </div>

                {/* Rows */}
                <div className="max-h-[60vh] overflow-y-auto">
                  {filteredTicks.length === 0 ? (
                    <div className="text-center py-16 text-slate-500 text-sm">
                      No markets match your filters
                    </div>
                  ) : (
                    filteredTicks.map((tick) => (
                      <div
                        key={tick.id}
                        className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-[#1A1A1A]/50 hover:bg-white/[0.02] transition-colors text-sm"
                      >
                        <div className="col-span-1">
                          {tick.provider === 'Kalshi' ? (
                            <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">K</span>
                          ) : (
                            <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">P</span>
                          )}
                        </div>
                        <div className="col-span-4 text-white truncate">{tick.name}</div>
                        <div className="col-span-2 text-right font-mono text-white">
                          {(tick.price * 100).toFixed(1)}¢
                        </div>
                        <div className={`col-span-2 text-right font-mono ${
                          tick.change > 0 ? 'text-[#4FFFC8]' : tick.change < 0 ? 'text-red-400' : 'text-slate-500'
                        }`}>
                          {tick.change > 0 ? '+' : ''}{(tick.change * 100).toFixed(2)}¢
                        </div>
                        <div className="col-span-2 text-right font-mono text-slate-300">
                          {formatUSD(tick.volume)}
                        </div>
                        <div className="col-span-1 text-right">
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-slate-400">
                            {tick.category}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="text-xs text-slate-600 mt-3 text-right">
                Showing {filteredTicks.length} of {marketTicks.length} markets · Updates every 5s
              </div>
            </motion.div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              WALLET LOOKUP TAB
              ════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'wallet' && (
            <motion.div
              key="wallet"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {/* Lookup Input */}
              <div className="border border-[#1A1A1A] rounded-xl p-6 mb-6 bg-white/[0.02]">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Wallet Address</h3>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleWalletLookup()}
                    placeholder="0x57cd939930fd119067ca9dc42b22b3e15708a0fb"
                    className="flex-1 bg-[#0a0a0a] border border-[#1A1A1A] rounded-xl px-4 py-3 text-white font-mono text-sm placeholder:text-slate-700 focus:outline-none focus:border-[#4FFFC8]/40"
                  />
                  <button
                    onClick={handleWalletLookup}
                    disabled={walletLoading}
                    className="px-6 py-3 rounded-full bg-[#4FFFC8] text-black font-bold text-sm hover:bg-[#3de6b3] transition-colors disabled:opacity-50"
                  >
                    {walletLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Lookup'}
                  </button>
                </div>
              </div>

              {/* Wallet Profile */}
              {walletProfile && (
                <div className="border border-[#1A1A1A] rounded-xl p-6 bg-white/[0.02]">
                  {/* Header */}
                  <div className="flex items-center gap-4 mb-6">
                    <div>
                      <div className="font-mono text-white font-bold">
                        {walletProfile.address.slice(0, 6)}...{walletProfile.address.slice(-4)}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold mt-1 inline-block ${
                        walletProfile.cohort === 'Whale' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                        walletProfile.cohort === 'Active Trader' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                        walletProfile.cohort === 'Buy & Hold' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                        'bg-white/10 text-slate-400 border border-white/10'
                      }`}>
                        {walletProfile.cohort === 'Whale' ? '🐋 ' : walletProfile.cohort === 'Active Trader' ? '🔥 ' : ''}
                        {walletProfile.cohort.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1" />
                    <div className="text-right text-xs text-slate-500">
                      Trading since {walletProfile.tradingSince}
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
                    {[
                      { label: 'Total PnL (After Fees)', value: formatPnl(walletProfile.totalPnl), color: walletProfile.totalPnl >= 0 ? 'text-[#4FFFC8]' : 'text-red-400' },
                      { label: 'Realized PnL', value: formatPnl(walletProfile.realizedPnl), color: walletProfile.realizedPnl >= 0 ? 'text-[#4FFFC8]' : 'text-red-400' },
                      { label: 'Volume', value: formatUSD(walletProfile.volume), color: 'text-white' },
                      { label: 'ROI', value: `${walletProfile.roi >= 0 ? '+' : ''}${walletProfile.roi}%`, color: walletProfile.roi >= 0 ? 'text-[#4FFFC8]' : 'text-red-400' },
                      { label: 'Win Rate', value: `${walletProfile.winRate}%`, color: 'text-white' },
                      { label: 'Trades', value: walletProfile.trades.toLocaleString(), color: 'text-white' },
                      { label: 'W / L', value: `${walletProfile.winStreak.wins} / ${walletProfile.winStreak.losses}`, color: 'text-white' },
                      { label: 'Profit Factor', value: walletProfile.profitFactor.toFixed(2), color: 'text-white' },
                    ].map((stat) => (
                      <div key={stat.label} className="border border-[#1A1A1A] rounded-xl p-3 bg-white/[0.02]">
                        <div className="text-[9px] text-slate-500 uppercase tracking-wider font-bold mb-1">{stat.label}</div>
                        <div className={`text-lg font-mono font-bold ${stat.color}`}>{stat.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Bottom stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                    {[
                      { label: 'Positions', value: `${walletProfile.positions} (${walletProfile.activePositions} active)` },
                      { label: 'Avg Hold Time', value: walletProfile.walletAge },
                      { label: 'Wallet Age', value: walletProfile.walletAge },
                      { label: 'Best Trade', value: formatUSD(walletProfile.bestTrade), color: 'text-[#4FFFC8]' },
                      { label: 'Worst Trade', value: formatUSD(Math.abs(walletProfile.worstTrade)), color: 'text-red-400' },
                      { label: 'Win Streak', value: `W${walletProfile.winStreak.wins} / L${walletProfile.winStreak.losses}` },
                      { label: 'Avg Trade', value: formatUSD(walletProfile.avgTradeSize) },
                    ].map((stat) => (
                      <div key={stat.label} className="border border-[#1A1A1A] rounded-xl p-3 bg-white/[0.02]">
                        <div className="text-[9px] text-slate-500 uppercase tracking-wider font-bold mb-1">{stat.label}</div>
                        <div className={`text-sm font-mono font-bold ${stat.color || 'text-white'}`}>{stat.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MARKET DETAIL MODAL (Enhanced — shows full card with Yes/No odds)
          ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {selectedMarket && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setSelectedMarket(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-2xl bg-[#0a0a0a] border border-[#1A1A1A] rounded-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-[#1A1A1A]">
                <div className="flex items-center gap-3">
                  {selectedMarket.provider === 'Kalshi' ? (
                    <span className="text-[10px] px-2 py-1 rounded-full font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      KALSHI
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-1 rounded-full font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                      POLY
                    </span>
                  )}
                  <span className="text-xs text-slate-500 uppercase tracking-wider">{selectedMarket.category}</span>
                </div>
                <button
                  onClick={() => setSelectedMarket(null)}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6">
                <h3 className="text-xl font-bold text-white mb-4">{selectedMarket.eventTitle || selectedMarket.name}</h3>

                {/* Yes / No Odds Display */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-[#4FFFC8]/5 rounded-xl border border-[#4FFFC8]/20">
                    <div className="text-[10px] text-[#4FFFC8] uppercase tracking-wider font-bold mb-1">Yes</div>
                    <div className="text-3xl font-mono font-bold text-[#4FFFC8]">
                      {((selectedMarket.yesPrice ?? selectedMarket.price) * 100).toFixed(1)}¢
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {((selectedMarket.yesPrice ?? selectedMarket.price) * 100).toFixed(0)}% probability
                    </div>
                  </div>
                  <div className="p-4 bg-red-500/5 rounded-xl border border-red-500/20">
                    <div className="text-[10px] text-red-400 uppercase tracking-wider font-bold mb-1">No</div>
                    <div className="text-3xl font-mono font-bold text-red-400">
                      {((selectedMarket.noPrice ?? (1 - selectedMarket.price)) * 100).toFixed(1)}¢
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {((selectedMarket.noPrice ?? (1 - selectedMarket.price)) * 100).toFixed(0)}% probability
                    </div>
                  </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="p-3 bg-white/[0.02] rounded-xl border border-[#1A1A1A]">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Price</div>
                    <div className="text-xl font-mono font-bold text-white">
                      ${selectedMarket.price.toFixed(2)}
                    </div>
                  </div>
                  <div className="p-3 bg-white/[0.02] rounded-xl border border-[#1A1A1A]">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Volume</div>
                    <div className="text-xl font-mono font-bold text-white">
                      {formatUSD(selectedMarket.volume)}
                    </div>
                  </div>
                  <div className="p-3 bg-white/[0.02] rounded-xl border border-[#1A1A1A]">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Provider</div>
                    <div className="text-xl font-bold text-white">
                      {selectedMarket.provider}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3">
                  {/* Trade This Market — opens trade panel */}
                  <button
                    onClick={() => {
                      const mkt = selectedMarket;
                      setSelectedMarket(null);
                      setQuickTradeMarket(mkt);
                      setIsQuickTradeOpen(true);
                    }}
                    className="flex-1 py-3 rounded-xl bg-[#4FFFC8] text-black font-bold text-sm text-center hover:bg-[#3de6b3] transition-colors"
                  >
                    Trade This Market
                  </button>

                  {/* Open in Markets Tab */}
                  <Link
                    href={`/markets?search=${encodeURIComponent((selectedMarket.eventTitle || selectedMarket.name).slice(0, 40))}`}
                    onClick={() => setSelectedMarket(null)}
                    className="px-4 py-3 rounded-xl border border-[#1A1A1A] text-slate-400 hover:text-white hover:border-[#4FFFC8]/30 transition-colors"
                    title="View in Markets"
                  >
                    <Search className="w-4 h-4" />
                  </Link>

                  {/* External Link */}
                  <a
                    href={
                      selectedMarket.provider === 'Kalshi'
                        ? (selectedMarket.kalshiUrl || `https://kalshi.com/markets`)
                        : (selectedMarket.polymarketUrl || `https://polymarket.com`)
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-3 rounded-xl border border-[#1A1A1A] text-slate-400 hover:text-white hover:border-[#4FFFC8]/30 transition-colors"
                    title={`Open on ${selectedMarket.provider}`}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>

                  {/* Copy */}
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${selectedMarket.name} - $${selectedMarket.price.toFixed(2)}`);
                      toast.success('Copied!', { duration: 1500 });
                    }}
                    className="px-4 py-3 rounded-xl border border-[#1A1A1A] text-slate-400 hover:text-white hover:border-[#4FFFC8]/30 transition-colors"
                    title="Copy market info"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Trade Panel (full trade UI — expand button) */}
      {isQuickTradeOpen && quickTradeMarket && (
        <TradePanel
          market={quickTradeMarket}
          isOpen={isQuickTradeOpen}
          onClose={() => setIsQuickTradeOpen(false)}
          onTrade={(market, side, quantity) => {
            console.log(`Trade placed: ${quantity} shares of ${side} on ${market.name}`);
            setIsQuickTradeOpen(false);
          }}
        />
      )}
    </div>
  );
}

// Display constant
const WHALE_THRESHOLD_DISPLAY = '5,000';
