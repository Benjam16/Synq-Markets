"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useDebounce } from "@/lib/use-debounce";
import { Market } from "@/lib/types";
import { Filter, TrendingUp, Zap, Sparkles, ChevronLeft, ChevronRight, Vote, Trophy, Coins, TrendingDown, Globe, Briefcase, Timer, Layers, X, Plus, Minus, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
// Dynamic imports for code splitting
import dynamic from 'next/dynamic';

const TradePanel = dynamic(() => import("../components/TradePanel"), { ssr: false });
const MarketCard = dynamic(() => import("../components/MarketCard"), { ssr: false });
const VirtualizedMarketList = dynamic(() => import("../components/VirtualizedMarketList"), { ssr: false });
import { useAuth } from "../components/AuthProvider";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "react-hot-toast";

export interface ParlayLeg {
  marketId: string;
  provider: string;
  outcome: 'yes' | 'no';
  outcomeName?: string;
  price: number;
  marketName: string;
  status: 'pending' | 'won' | 'lost';
}

export default function MarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [fastMarkets, setFastMarkets] = useState<Market[]>([]);
  const [fastMarketsLoading, setFastMarketsLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [selectedCategory, setSelectedCategory] = useState('Trending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<{ key: string; eventTitle: string; markets: Market[] } | null>(null);
  const [isTradePanelOpen, setIsTradePanelOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [topNavHeight, setTopNavHeight] = useState(57);
  const [sourceFilter, setSourceFilter] = useState<'All' | 'Polymarket' | 'Kalshi'>('All');
  const { user } = useAuth();
  const router = useRouter();

  // ── Parlay / Multi-Bet state ───────────────────────────────────────
  const [parlayMode, setParlayMode] = useState(false);
  const [parlayLegs, setParlayLegs] = useState<ParlayLeg[]>([]);
  const [parlayStake, setParlayStake] = useState<string>('10');
  const [parlaySlipOpen, setParlaySlipOpen] = useState(false);
  const [parlayPlacing, setParlayPlacing] = useState(false);
  const [dbUserId, setDbUserId] = useState<number | null>(null);

  // Resolve dbUserId for parlay placement
  useEffect(() => {
    if (!user?.email) return;
    fetch(`/api/user?email=${encodeURIComponent(user.email)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.user?.id) setDbUserId(d.user.id); })
      .catch(() => {});
  }, [user]);

  // Measure top nav height to position markets header exactly
  useEffect(() => {
    const measureTopNav = () => {
      // Try multiple selectors to find the top nav
      const topNav = document.querySelector('header.sticky.top-0') || 
                     document.querySelector('header[class*="sticky"][class*="top-0"]') ||
                     document.querySelector('header');
      if (topNav) {
        const height = topNav.getBoundingClientRect().height;
        if (height > 0) {
          setTopNavHeight(height);
        }
      }
    };
    
    // Measure immediately and after layout
    measureTopNav();
    const timeout1 = setTimeout(measureTopNav, 50);
    const timeout2 = setTimeout(measureTopNav, 200);
    window.addEventListener('resize', measureTopNav);
    
    return () => {
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      window.removeEventListener('resize', measureTopNav);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    let currentAbortController: AbortController | null = null;
    let initialLoadComplete = false;
    
    const loadMarkets = async () => {
      // Cancel previous request if still pending (but not on first call)
      if (currentAbortController && initialLoadComplete) {
        currentAbortController.abort();
      }
      currentAbortController = new AbortController();
      
      try {
        const isInitial = !initialLoadComplete;
        
        const fetchOptions: RequestInit = {};

        // Only add abort signal after initial load completes
        if (initialLoadComplete) {
          fetchOptions.signal = currentAbortController.signal;
        }
        
        // Fetch all markets — let the server-side 60s cache handle freshness
        const res = await fetch(`/api/markets?limit=5000`, fetchOptions);
        
        if (!mounted) {
          return;
        }
        
        if (res.ok) {
          const data = await res.json();
          const marketsCount = data.markets?.length || 0;
          
          if (data.error) {
            console.error(`[Markets Page] API error:`, data.error);
          }
          
          // Always update markets if we got data
          if (marketsCount > 0) {
            setMarkets(data.markets);
          } else {
            // Only clear on initial load if we get 0 markets
            if (isInitial) {
              setMarkets([]);
            }
          }
        } else {
          // If API fails, keep existing markets (don't clear them)
          const errorText = await res.text().catch(() => 'Unknown error');
          console.error(`[Markets Page] Failed to fetch markets (${res.status}):`, errorText);
          // Don't clear markets on error - keep existing ones
        }
      } catch (error: any) {
        // Ignore aborted requests (navigation cancelled them) - but log for debugging
        if (error?.name === 'AbortError') {
          const isInitial = !initialLoadComplete;
          // On initial load, abort shouldn't happen - this is a problem
          if (isInitial) {
            console.error('[Markets Page] ⚠️ Initial load was aborted! This should not happen.');
          }
          return;
        }
        // Log errors for debugging
        if (mounted) {
          console.error('[Markets Page] Market fetch error:', error);
          if (error instanceof Error) {
            console.error('[Markets Page] Error details:', error.message, error.stack);
          }
          // Don't clear markets on error - keep existing ones
        }
      } finally {
        if (mounted) {
          setLoading(false);
          initialLoadComplete = true; // Mark initial load as complete
        }
      }
    };
    
    // Initial load
    loadMarkets();
    
    // Update prices every 60 seconds (markets don't change that frequently)
    const interval = setInterval(() => {
      if (mounted) {
        loadMarkets();
      }
    }, 60000);
    
    return () => {
      mounted = false;
      clearInterval(interval);
      // Cancel any pending requests
      if (currentAbortController) {
        currentAbortController.abort();
      }
    };
  }, []);

  // ── Fast markets polling (15s refresh when Fast tab is active) ──────────
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setFastMarketsLoading(true);
      try {
        const res = await fetch(`/api/markets/fast?_t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok && mounted) {
          const data = await res.json();
          setFastMarkets(data.markets || []);
        }
      } catch { /* silent */ } finally {
        if (mounted) setFastMarketsLoading(false);
      }
    };
    load();
    const id = setInterval(load, 15_000); // refresh every 15s
    return () => { mounted = false; clearInterval(id); };
  }, []);

  // ── Live clock for countdown timers (every second when Fast tab open) ──
  useEffect(() => {
    if (selectedCategory !== 'Fast') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [selectedCategory]);

  // Debounced search for better performance
  const debouncedSearch = useDebounce(searchQuery, 300);

  // ── Build Fast tab from BOTH fast API + client-side filter of main markets
  const combinedFastMarkets = useMemo(() => {
    const CRYPTO_KW = ['bitcoin', 'btc', 'ethereum', 'eth', 'solana', 'sol', 'xrp', 'doge', 'avax', 'link', 'bnb', 'hyperliquid'];
    const nowMs = now; // reactive timestamp updated every second
    const in24h = nowMs + 24 * 60 * 60 * 1000;
    // Client-side filter: "Up or Down" crypto markets resolving within 24 hours AND not yet resolved
    const fromMain = markets.filter(m => {
      const name = (m.name || m.eventTitle || '').toLowerCase();
      const isUpDown = name.includes('up or down') || name.includes('up/down');
      if (!isUpDown) return false;
      const cat = (m.category || '').toLowerCase();
      if (!(cat === 'crypto' || CRYPTO_KW.some(kw => name.includes(kw)))) return false;
      if (m.resolutionDate) {
        try {
          const resMs = new Date(m.resolutionDate).getTime();
          if (resMs < nowMs) return false; // already past resolution
          if (resMs > in24h) return false;
        } catch { /* keep */ }
      }
      return true;
    });
    // Merge with fast API results, deduplicate by id — drop anything already resolved
    const seen = new Set<string>();
    const merged: Market[] = [];
    for (const m of [...fastMarkets, ...fromMain]) {
      if (m.resolutionDate) {
        try {
          const resMs = new Date(m.resolutionDate).getTime();
          if (resMs < nowMs) continue; // resolved — drop immediately
        } catch { /* keep */ }
      }
      if (!seen.has(m.id)) { seen.add(m.id); merged.push(m); }
    }
    // Sort: soonest-resolving first so traders see the most urgent markets
    merged.sort((a, b) => {
      const aMs = a.resolutionDate ? new Date(a.resolutionDate).getTime() : Infinity;
      const bMs = b.resolutionDate ? new Date(b.resolutionDate).getTime() : Infinity;
      return aMs - bMs;
    });
    return merged;
  }, [markets, fastMarkets, now]);

  // Group markets by event (slug) - Polymarket style: one card per event
  const groupedMarkets = useMemo(() => {
    // Fast tab: use combined fast markets (API + client-side filter)
    if (selectedCategory === 'Fast') {
      const source = combinedFastMarkets.filter(m => {
        if (sourceFilter !== 'All' && m.provider !== sourceFilter) return false;
        if (!debouncedSearch) return true;
        return (m.eventTitle || m.name).toLowerCase().includes(debouncedSearch.toLowerCase());
      });
      const grouped = new Map<string, Market[]>();
      source.forEach(m => {
        const key = m.slug || m.id;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(m);
      });
      return Array.from(grouped.entries()).map(([key, mkts]) => ({
        key,
        eventTitle: mkts[0].eventTitle || mkts[0].name,
        markets: mkts,
        mainMarket: mkts[0],
        totalVolume: mkts.reduce((s, m) => s + (m.volume || 0), 0),
      }));
    }

    // Filter markets
    let filtered = markets.filter(m => {
      // Source filter (Polymarket / Kalshi / All)
      if (sourceFilter !== 'All' && m.provider !== sourceFilter) return false;

      const matchesSearch = !debouncedSearch || 
        (m.eventTitle || m.name).toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (m.description || '').toLowerCase().includes(debouncedSearch.toLowerCase());
      
      // Handle special categories
      let matchesCat = false;
      if (selectedCategory === 'Trending') {
        matchesCat = true;
      } else if (selectedCategory === 'Breaking') {
        // Breaking: Show ALL sports and crypto markets (not just same-day), plus high volume markets
        const marketName = (m.name || '').toLowerCase();
        const marketDesc = (m.description || '').toLowerCase();
        const combined = `${marketName} ${marketDesc}`;
        
        // VERY BROAD keyword detection - catch ALL crypto and sports markets
        const categoryLower = (m.category || '').toLowerCase();
        
        // Sports detection - very broad (including player props)
        const isSports = categoryLower === 'sports' || 
                        marketName.includes('nba') || marketName.includes('nfl') || 
                        marketName.includes('nhl') || marketName.includes('mlb') ||
                        marketName.includes('soccer') || marketName.includes('football') ||
                        marketName.includes('basketball') || marketName.includes('hockey') ||
                        marketName.includes('baseball') || marketName.includes('tennis') ||
                        marketName.includes('golf') || marketName.includes('mma') ||
                        marketName.includes('ufc') || marketName.includes('boxing') ||
                        marketName.includes('premier league') || marketName.includes('champions league') ||
                        marketName.includes('ncaa') || marketName.includes('college') ||
                        marketName.includes('playoff') || marketName.includes('championship') ||
                        marketName.includes('super bowl') || marketName.includes('stanley cup') ||
                        marketName.includes('world series') || marketName.includes('olympics') ||
                        marketName.includes('esports') || marketName.includes('gaming') ||
                        // Player props detection
                        combined.includes('player') || combined.includes('prop') ||
                        combined.includes('points') || combined.includes('rebounds') ||
                        combined.includes('assists') || combined.includes('yards') ||
                        combined.includes('touchdowns') || combined.includes('goals') ||
                        combined.includes('shots') || combined.includes('saves') ||
                        // Game-related keywords
                        combined.includes(' vs ') || combined.includes('game') || 
                        combined.includes('match') || combined.includes('tournament') ||
                        combined.includes('winner') || combined.includes('champion') ||
                        combined.includes('over/under') || combined.includes('over under') ||
                        combined.includes('spread') || combined.includes('total');
        
        // Crypto detection - very broad (including "Up or Down" markets)
        const isCrypto = categoryLower === 'crypto' || 
                         marketName.includes('bitcoin') || marketName.includes('btc') ||
                         marketName.includes('ethereum') || marketName.includes('eth') ||
                         marketName.includes('crypto') || marketName.includes('blockchain') ||
                         marketName.includes('defi') || marketName.includes('nft') ||
                         marketName.includes('solana') || marketName.includes('sol') ||
                         marketName.includes('cardano') || marketName.includes('ada') ||
                         marketName.includes('polygon') || marketName.includes('matic') ||
                         marketName.includes('avalanche') || marketName.includes('avax') ||
                         marketName.includes('chainlink') || marketName.includes('link') ||
                         marketName.includes('uniswap') || marketName.includes('doge') ||
                         marketName.includes('shib') || marketName.includes('meme') ||
                         marketName.includes('stablecoin') || marketName.includes('usdt') ||
                         marketName.includes('usdc') || marketName.includes('binance') ||
                         marketName.includes('bnb') || marketName.includes('exchange') ||
                         marketName.includes('token') || marketName.includes('coin') ||
                         // "Up or Down" markets are typically crypto (e.g., "Solana Up or Down")
                         combined.includes('up or down') || combined.includes('up/down') ||
                         // Time-based markets (e.g., "6:00AM-6:15AM ET") are often crypto
                         (combined.includes('am et') || combined.includes('pm et') || 
                          (combined.includes(':') && combined.includes('et'))) ||
                         (combined.includes('price') && (combined.includes('btc') || combined.includes('eth') || combined.includes('crypto')));
        
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
        // Make detection VERY broad to catch all variations including "Up or Down" markets
        const isShortTermCrypto = isCrypto && (
          // "Up or Down" markets are ALWAYS short-term (hourly/15-min intervals)
          combined.includes('up or down') ||
          combined.includes('up/down') ||
          // Time range patterns (e.g., "6:00AM-6:15AM ET", "11PM-12AM ET")
          (combined.includes(':') && combined.includes('et') && (combined.includes('-') || combined.includes(' to '))) ||
          // 15-minute variations
          combined.includes('15 min') || 
          combined.includes('15-minute') ||
          combined.includes('15m') ||
          combined.includes('15 minute') ||
          combined.includes('15mins') ||
          combined.includes('15 mins') ||
          // Time-based keywords
          combined.includes('hourly') ||
          combined.includes('hour') ||
          combined.includes('minute') ||
          combined.includes('minutes') ||
          combined.includes('mins') ||
          // Same-day keywords
          combined.includes('today') ||
          combined.includes('tonight') ||
          combined.includes('daily') ||
          combined.includes('intraday') ||
          combined.includes('price by end of day') ||
          combined.includes('by end of today') ||
          combined.includes('by midnight') ||
          combined.includes('end of day') ||
          // Price-related short-term
          (combined.includes('price') && (combined.includes('today') || combined.includes('tonight') || combined.includes('hour') || combined.includes('minute'))) ||
          // If it's crypto and recent (updated in last 24 hours), likely short-term
          isRecentMarket ||
          // If it's crypto and resolves today, it's short-term
          isSameDayByDate ||
          // If volume is very low (< $10k), likely a new short-term market
          (m.volume && m.volume < 10000)
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
          // Betting market keywords (over/under, spreads, totals)
          (combined.includes('over') && combined.includes('under')) ||
          combined.includes('o/u') ||
          combined.includes('over/under') ||
          combined.includes('spread') ||
          combined.includes('total') ||
          combined.includes('points') ||
          combined.includes('rebounds') ||
          combined.includes('assists') ||
          combined.includes('yards') ||
          combined.includes('touchdowns') ||
          combined.includes('goals') ||
          // Player props (very common for same-day)
          combined.includes('player') ||
          combined.includes('prop') ||
          // Time-based keywords
          combined.includes('tonight') ||
          combined.includes('today') ||
          combined.includes('live') ||
          // Game-related keywords with time
          (combined.includes('game') && (combined.includes('today') || combined.includes('tonight') || combined.includes('live'))) ||
          // Team vs team format often indicates live games
          (combined.includes(' vs ') && (isRecentMarket || isSameDayByDate)) ||
          // Check for common game-related keywords with time
          (combined.includes('win') && (combined.includes('today') || combined.includes('tonight'))) ||
          (combined.includes('score') && (combined.includes('today') || combined.includes('tonight'))) ||
          // If it's sports and recent (updated in last 24 hours), likely same-day
          isRecentMarket ||
          // If volume is very low (< $10k), likely a new same-day market
          (m.volume && m.volume < 10000)
        );
        
        // Include: 
        // 1. ALL crypto markets (prioritize short-term ones)
        // 2. ALL sports markets (prioritize same-day ones including player props)
        // 3. High volume markets (but exclude long-term championships)
        // This ensures we show ALL crypto and sports, not just same-day ones
        matchesCat = isCrypto || isSports || (isHighVolume && !isLongTermChampionship);
        
        
      } else if (selectedCategory === 'Fast') {
        // Fast tab uses fastMarkets state — this branch never matches from `markets`
        matchesCat = false;
      } else {
        // Enhanced category matching - handle all variations and edge cases
        const marketCat = (m.category || '').toLowerCase().trim();
        const selectedCat = selectedCategory.toLowerCase().trim();
        
        // Normalize "&" to "and" for matching
        const normalizeCat = (cat: string) => cat.replace(/&/g, 'and').replace(/\s+/g, ' ');
        const normalizedMarketCat = normalizeCat(marketCat);
        const normalizedSelectedCat = normalizeCat(selectedCat);
        
        // Exact match
        matchesCat = marketCat === selectedCat || 
                     normalizedMarketCat === normalizedSelectedCat;
        
        // Partial match (either direction)
        if (!matchesCat) {
          matchesCat = marketCat.includes(selectedCat) || 
                       selectedCat.includes(marketCat) ||
                       normalizedMarketCat.includes(normalizedSelectedCat) ||
                       normalizedSelectedCat.includes(normalizedMarketCat);
        }
        
        // Special mappings for common variations
        if (!matchesCat) {
          const specialMappings: Record<string, string[]> = {
            'finance': ['economics', 'financial', 'economy'],
            'economy': ['economics', 'financial', 'finance'],
            'climate & science': ['climate', 'science', 'climate and science'],
            'climate and science': ['climate', 'science', 'climate & science'],
            'geopolitics': ['world', 'geopolitical', 'international'],
            'world': ['geopolitics', 'geopolitical', 'international'],
            'tech': ['technology', 'tech'],
            'crypto': ['cryptocurrency', 'cryptocurrencies'],
            'sports': ['sport', 'nba', 'nfl', 'nhl', 'mlb', 'soccer', 'football', 'basketball', 'hockey', 'baseball', 'tennis', 'golf', 'mma', 'ufc', 'boxing'],
            'culture': ['entertainment'],
            'elections': ['election', 'political'],
            'politics': ['political', 'election'],
          };
          
          const variations = specialMappings[selectedCat] || [];
          matchesCat = variations.some(v => marketCat.includes(v) || v.includes(marketCat));
        }
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
          const categoryLower = (m.category || '').toLowerCase();
          const marketName = (m.name || '').toLowerCase();
          const marketDesc = (m.description || '').toLowerCase();
          const combined = `${marketName} ${marketDesc}`;
          
          // More lenient category detection
          const isSports = categoryLower === 'sports' || 
                          marketName.includes('nba') || marketName.includes('nfl') || 
                          marketName.includes('nhl') || marketName.includes('mlb') ||
                          marketName.includes('soccer') || marketName.includes('football') ||
                          marketName.includes('basketball') || marketName.includes('hockey') ||
                          marketName.includes('baseball') || combined.includes(' vs ') ||
                          combined.includes('game') || combined.includes('match');
          
          const isCrypto = categoryLower === 'crypto' || 
                          marketName.includes('bitcoin') || marketName.includes('btc') ||
                          marketName.includes('ethereum') || marketName.includes('eth') ||
                          marketName.includes('crypto') || marketName.includes('blockchain') ||
                          marketName.includes('defi') || marketName.includes('nft') ||
                          marketName.includes('solana') || marketName.includes('cardano');
          
          if (!isSports && !isCrypto) return false;
          
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
              isRecentMarket = hoursSinceUpdate < 48; // More lenient
            } catch (e) {
              isRecentMarket = false;
            }
          }
          
          // Crypto: Short-term markets (very broad detection)
          if (isCrypto) {
            return isSameDayByDate || 
                   combined.includes('15 min') || 
                   combined.includes('15-minute') ||
                   combined.includes('15m') ||
                   combined.includes('15 minute') ||
                   combined.includes('15mins') ||
                   combined.includes('hourly') ||
                   combined.includes('hour') ||
                   combined.includes('minute') ||
                   combined.includes('minutes') ||
                   combined.includes('today') ||
                   combined.includes('daily') ||
                   combined.includes('intraday') ||
                   (combined.includes('price') && (combined.includes('today') || combined.includes('tonight') || combined.includes('hour') || combined.includes('minute'))) ||
                   isRecentMarket ||
                   (m.volume && m.volume < 10000); // Low volume = likely new short-term
          }
          
          // Sports: Same-day game markets (very broad detection including player props)
          if (isSports) {
            return isSameDayByDate ||
                   (combined.includes('over') && combined.includes('under')) ||
                   combined.includes('o/u') ||
                   combined.includes('over/under') ||
                   combined.includes('spread') ||
                   combined.includes('total') ||
                   combined.includes('points') ||
                   combined.includes('rebounds') ||
                   combined.includes('assists') ||
                   combined.includes('yards') ||
                   combined.includes('touchdowns') ||
                   combined.includes('goals') ||
                   combined.includes('player') ||
                   combined.includes('prop') ||
                   combined.includes('tonight') ||
                   combined.includes('today') ||
                   combined.includes('live') ||
                   (combined.includes('game') && (combined.includes('today') || combined.includes('tonight') || combined.includes('live'))) ||
                   (combined.includes(' vs ') && (isRecentMarket || isSameDayByDate)) ||
                   isRecentMarket ||
                   (m.volume && m.volume < 10000); // Low volume = likely new same-day
          }
          
          return false;
        });
        
        return {
          key,
          eventTitle: mainMarket.eventTitle || mainMarket.name,
          imageUrl: mainMarket.imageUrl,
          markets: eventMarkets.sort((a, b) => {
            // Sort markets within event: Main first, then by type
            if (a.marketType === 'Main') return -1;
            if (b.marketType === 'Main') return 1;
            return (a.marketType || '').localeCompare(b.marketType || '');
          }),
          totalVolume,
          hasSameDaySportsCrypto, // Flag for prioritization
          mainMarket, // For card display
        };
      })
      .sort((a, b) => {
        // For Breaking category, prioritize short-term/same-day markets
        if (selectedCategory === 'Breaking') {
          // First: Short-term crypto markets (15 min, hourly, etc.)
          const aIsShortTermCrypto = a.markets.some((m: Market) => {
            const name = (m.name || '').toLowerCase();
            const desc = (m.description || '').toLowerCase();
            const combined = `${name} ${desc}`;
            const isCrypto = (m.category || '').toLowerCase() === 'crypto' || 
                            name.includes('bitcoin') || name.includes('btc') ||
                            name.includes('ethereum') || name.includes('eth') ||
                            name.includes('crypto');
            return isCrypto && (
              combined.includes('15 min') || combined.includes('15-minute') ||
              combined.includes('15m') || combined.includes('hourly') ||
              combined.includes('hour') || combined.includes('minute') ||
              combined.includes('today') || combined.includes('daily')
            );
          });
          
          const bIsShortTermCrypto = b.markets.some((m: Market) => {
            const name = (m.name || '').toLowerCase();
            const desc = (m.description || '').toLowerCase();
            const combined = `${name} ${desc}`;
            const isCrypto = (m.category || '').toLowerCase() === 'crypto' || 
                            name.includes('bitcoin') || name.includes('btc') ||
                            name.includes('ethereum') || name.includes('eth') ||
                            name.includes('crypto');
            return isCrypto && (
              combined.includes('15 min') || combined.includes('15-minute') ||
              combined.includes('15m') || combined.includes('hourly') ||
              combined.includes('hour') || combined.includes('minute') ||
              combined.includes('today') || combined.includes('daily')
            );
          });
          
          if (aIsShortTermCrypto && !bIsShortTermCrypto) return -1;
          if (!aIsShortTermCrypto && bIsShortTermCrypto) return 1;
          
          // Second: Same-day sports markets
          if (a.hasSameDaySportsCrypto && !b.hasSameDaySportsCrypto) return -1;
          if (!a.hasSameDaySportsCrypto && b.hasSameDaySportsCrypto) return 1;
        } else {
          // For other categories, prioritize same-day sports/crypto markets first
          if (a.hasSameDaySportsCrypto && !b.hasSameDaySportsCrypto) return -1;
          if (!a.hasSameDaySportsCrypto && b.hasSameDaySportsCrypto) return 1;
        }
        // Then sort by volume
        return b.totalVolume - a.totalVolume;
      });
  }, [markets, combinedFastMarkets, debouncedSearch, selectedCategory, sourceFilter]);

  // ── Countdown helper for Fast Markets ──────────────────────────────────
  const getCountdown = useCallback((resolutionDate: string | undefined): string => {
    if (!resolutionDate) return '';
    const ms = new Date(resolutionDate).getTime() - now;
    if (ms <= 0) return 'Resolving…';
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  }, [now]);

  // ── Parlay helpers ────────────────────────────────────────────────────
  const parlayMultiplier = useMemo(() => {
    if (parlayLegs.length === 0) return 1;
    return parlayLegs.reduce((acc, l) => acc * (1 / l.price), 1);
  }, [parlayLegs]);

  const parlayPayout = useMemo(() => {
    const stakeNum = parseFloat(parlayStake) || 0;
    return +(stakeNum * parlayMultiplier).toFixed(2);
  }, [parlayStake, parlayMultiplier]);

  const addParlayLeg = useCallback((market: Market, outcome: 'yes' | 'no', outcomeName?: string, outcomePrice?: number) => {
    if (parlayLegs.length >= 6) {
      toast.error('Maximum 6 legs per parlay');
      return;
    }
    // Composite key: marketId + outcomeName + side for multi-outcome dedup
    const legKey = outcomeName
      ? `${market.id}::${outcomeName}::${outcome}`
      : `${market.id}::${outcome}`;
    const getLegKey = (l: ParlayLeg) => l.outcomeName
      ? `${l.marketId}::${l.outcomeName}::${l.outcome}`
      : `${l.marketId}::${l.outcome}`;

    if (parlayLegs.some(l => getLegKey(l) === legKey)) {
      setParlayLegs(prev => prev.filter(l => getLegKey(l) !== legKey));
      return;
    }
    // Use actual outcome price when provided; fall back to market.price
    const rawPrice = outcomePrice ?? (outcome === 'yes' ? market.price : 1 - market.price);
    const safeprice = Math.max(0.01, Math.min(0.99, rawPrice));
    const displayName = outcomeName
      ? `${outcomeName} — ${market.eventTitle || market.name}`
      : (market.eventTitle || market.name);
    setParlayLegs(prev => [
      ...prev,
      {
        marketId: market.id,
        provider: market.provider || 'polymarket',
        outcome,
        outcomeName,
        price: safeprice,
        marketName: displayName,
        status: 'pending',
      },
    ]);
    setParlaySlipOpen(true);
  }, [parlayLegs]);

  const removeParlayLeg = useCallback((legKey: string) => {
    const getLegKey = (l: ParlayLeg) => l.outcomeName
      ? `${l.marketId}::${l.outcomeName}::${l.outcome}`
      : `${l.marketId}::${l.outcome}`;
    setParlayLegs(prev => prev.filter(l => getLegKey(l) !== legKey));
  }, []);

  const clearParlay = useCallback(() => {
    setParlayLegs([]);
    setParlayStake('10');
    setParlaySlipOpen(false);
  }, []);

  const placeParlay = useCallback(async () => {
    if (parlayLegs.length < 2) { toast.error('Add at least 2 legs'); return; }
    if (!dbUserId) { toast.error('Please sign in to place a parlay'); return; }
    const stakeNum = parseFloat(parlayStake);
    if (!stakeNum || stakeNum <= 0) { toast.error('Enter a valid stake'); return; }
    setParlayPlacing(true);
    try {
      const res = await fetch('/api/parlay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: dbUserId, legs: parlayLegs, stake: stakeNum }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to place parlay');
      toast.success(`Parlay placed! Potential payout: $${data.potentialPayout.toFixed(2)}`);
      clearParlay();
      setParlayMode(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to place parlay');
    } finally {
      setParlayPlacing(false);
    }
  }, [parlayLegs, parlayStake, dbUserId, clearParlay]);

  const handleBuy = useCallback((market: Market, side: "yes" | "no") => {
    // In parlay mode, add to slip instead of opening TradePanel
    if (parlayMode) {
      addParlayLeg(market, side);
      return;
    }
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

  // Polymarket-style categories
  const mainCategories = [
    { id: 'Trending', label: 'Trending', icon: TrendingUp },
    { id: 'Breaking', label: 'Breaking', icon: Zap },
    { id: 'Fast', label: '⚡ Fast', icon: Timer },
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
    const container = document.getElementById('category-scroll');
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

  return (
    <div className="min-h-screen bg-[#050505]">
      <Toaster position="top-right" />

      {/* Header - sticky below top nav */}
      <div 
        className="sticky z-40 bg-slate-950/95 backdrop-blur-md border-b border-slate-800"
        style={{ top: '64px' }}
      >
        <div className="max-w-7xl mx-auto w-full pt-3 pb-1">
          <div className="flex flex-col items-center w-full">
            {/* Search Bar */}
            <div className="flex justify-center w-full mb-3">
              <div className="relative max-w-[600px] w-full mx-auto px-4 md:px-0">
                <input
                  type="text"
                  placeholder="Search markets or type a command..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-[42px] px-5 pr-16 bg-white/[0.03] backdrop-blur-xl rounded-xl text-sm text-white placeholder:text-slate-500 placeholder:font-medium focus:outline-none focus:border focus:border-white/10 focus:shadow-[inset_0_0_20px_rgba(255,255,255,0.02)] transition-all"
                />
                {/* Keyboard shortcut badge */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 bg-white/[0.05] rounded text-[10px] text-slate-400 font-medium">
                  <span>⌘</span>
                  <span>K</span>
                </div>
              </div>
            </div>

            {/* Source Toggle + Multi-Bet Button row */}
            <div className="flex items-center justify-between w-full max-w-[600px] mx-auto px-4 md:px-0 mb-1">
              {/* Source Toggle — All / Polymarket / Kalshi */}
              <div className="flex items-center gap-1 bg-white/[0.03] rounded-full p-1">
                {(['All', 'Polymarket', 'Kalshi'] as const).map((src) => {
                  const isActive = sourceFilter === src;
                  return (
                    <button
                      key={src}
                      onClick={() => setSourceFilter(src)}
                      className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] transition-all ${
                        isActive
                          ? src === 'Kalshi'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : src === 'Polymarket'
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              : 'bg-white/10 text-white border border-white/10'
                          : 'text-slate-500 hover:text-white border border-transparent'
                      }`}
                    >
                      {src !== 'All' && (
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          src === 'Kalshi' ? 'bg-emerald-400' : 'bg-blue-400'
                        }`} />
                      )}
                      {src}
                    </button>
                  );
                })}
              </div>

              {/* Multi-Bet Toggle */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    if (parlayMode) {
                      // Toggle slip visibility when already active
                      setParlaySlipOpen(prev => !prev);
                    } else {
                      setParlayMode(true);
                      setParlaySlipOpen(true);
                    }
                  }}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] transition-all border ${
                    parlayMode
                      ? 'bg-violet-500/20 text-violet-300 border-violet-500/40'
                      : 'text-slate-400 border-white/10 hover:text-white hover:border-white/20 bg-white/[0.03]'
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  Multi-Bet
                  {parlayLegs.length > 0 && (
                    <span className="ml-0.5 w-4 h-4 rounded-full bg-violet-500 text-white text-[9px] flex items-center justify-center font-black">
                      {parlayLegs.length}
                    </span>
                  )}
                </button>
                {parlayMode && (
                  <button
                    onClick={() => { clearParlay(); setParlayMode(false); }}
                    title="Cancel Multi-Bet"
                    className="w-6 h-6 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-slate-500 hover:text-red-400 hover:border-red-400/30 transition-all"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Ghost Category Navigation - Full Width Edge to Edge */}
        <div className="w-screen mt-0 mb-0 relative left-1/2 -translate-x-1/2">
          <div
            id="category-scroll"
            className="flex gap-x-6 py-1.5 items-center overflow-x-auto scroll-smooth px-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
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
                  className={`relative flex items-center gap-2 px-3 py-2 whitespace-nowrap transition-all flex-shrink-0 ${
                    isSelected
                      ? 'text-white'
                      : 'text-slate-500 hover:text-white'
                  }`}
                >
                  {Icon && <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />}
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em]">{category.label}</span>
                  {/* Active indicator - Electric Lime dot - Perfectly Centered */}
                  {isSelected && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#4FFFC8]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Section Divider - Faint horizontal line */}
        <div className="w-full h-[1px] bg-white/[0.03] mt-0" />
      </div>

      {/* Main Content - Full Width with Better Spacing */}
      <main className="w-full max-w-[1600px] mx-auto px-6 pt-6 pb-4">

        {/* ── Fast Markets info banner ── */}
        {selectedCategory === 'Fast' && (
          <div className="flex items-center gap-3 mb-5 px-4 py-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
            <Timer className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-amber-400 text-xs font-bold uppercase tracking-widest">Fast-Settling Crypto Markets</span>
              <p className="text-slate-400 text-[11px] mt-0.5">
                Crypto markets resolving within the next hour from Polymarket &amp; Kalshi. Prices and timers update every 15 seconds.
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-amber-400 text-[10px] font-bold">{combinedFastMarkets.length} markets</span>
            </div>
          </div>
        )}

        {(loading && selectedCategory !== 'Fast') || (fastMarketsLoading && selectedCategory === 'Fast' && combinedFastMarkets.length === 0) ? (
          <div className="flex items-center justify-center py-32">
            <div className="flex flex-col items-center gap-4">
              <div className={`w-12 h-12 border-4 border-t-transparent rounded-full animate-spin ${selectedCategory === 'Fast' ? 'border-amber-400' : 'border-[#4FFFC8]'}`} />
              <span className="text-slate-400 text-sm">
                {selectedCategory === 'Fast' ? 'Fetching fast crypto markets…' : 'Loading markets...'}
              </span>
            </div>
          </div>
        ) : groupedMarkets.length === 0 ? (
          <div className="text-center py-32">
            {selectedCategory === 'Fast' ? (
              <>
                <Timer className="w-12 h-12 text-amber-700 mx-auto mb-4" />
                <p className="text-lg text-slate-400 mb-2">No fast-settling markets right now</p>
                <p className="text-sm text-slate-500">Check back soon — new markets open every few minutes</p>
              </>
            ) : (
              <>
                <Filter className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                <p className="text-lg text-slate-400 mb-2">
                  {markets.length === 0 ? 'Loading markets...' : 'No markets found'}
                </p>
                <p className="text-sm text-slate-500">
                  {markets.length === 0
                    ? 'Please wait while we fetch markets from Polymarket'
                    : 'Try adjusting your search or filters'}
                </p>
                {markets.length > 0 && (
                  <p className="text-xs text-slate-600 mt-2">
                    Found {markets.length} total markets, but none match "{selectedCategory}"
                  </p>
                )}
              </>
            )}
          </div>
        ) : (
          <VirtualizedMarketList
            items={groupedMarkets}
            initialCount={50}
            loadMoreCount={50}
            className="mt-4"
            renderItem={(eventGroup, index) => (
              <div key={eventGroup.key} className="relative">
                <MarketCard
                  market={eventGroup.mainMarket}
                  onBuy={handleBuy}
                  onSelect={() => {
                    setSelectedEvent({
                      key: eventGroup.key,
                      eventTitle: eventGroup.eventTitle,
                      markets: eventGroup.markets,
                    });
                    setIsTradePanelOpen(true);
                  }}
                  isSelected={selectedEvent?.key === eventGroup.key}
                  marketCount={eventGroup.markets.length}
                  parlayMode={parlayMode}
                  parlayLegs={parlayLegs}
                />
                {/* Countdown badge pinned to bottom bar for fast markets */}
                {selectedCategory === 'Fast' && eventGroup.mainMarket.resolutionDate && (() => {
                  const cd = getCountdown(eventGroup.mainMarket.resolutionDate);
                  if (!cd || cd === 'Resolving…') return null;
                  return (
                    <div className="absolute bottom-[13px] left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 backdrop-blur-sm">
                      <Timer className="w-2.5 h-2.5 text-amber-400" />
                      <span className="text-amber-400 text-[10px] font-mono font-bold whitespace-nowrap">{cd}</span>
                    </div>
                  );
                })()}
              </div>
            )}
          />
        )}
      </main>

      {/* Parlay mode banner */}
      <AnimatePresence>
        {parlayMode && (
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0, transition: { duration: 0.15 } }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-full bg-violet-950/90 border border-violet-500/30 backdrop-blur-xl shadow-2xl pointer-events-auto"
          >
            <Layers className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-[11px] font-bold text-violet-200">
              Multi-Bet active — open a market or click YES / NO to add a leg
            </span>
            <span className="text-violet-400 font-black text-[11px]">{parlayLegs.length}/6</span>
            <button
              onClick={() => setParlaySlipOpen(prev => !prev)}
              className="px-3 py-1 rounded-full bg-violet-500/30 text-violet-200 text-[10px] font-bold hover:bg-violet-500/50 transition-all"
            >
              {parlaySlipOpen ? 'Hide Slip' : 'View Slip'}
            </button>
            <button onClick={() => { clearParlay(); setParlayMode(false); }} title="Cancel Multi-Bet" className="text-violet-500 hover:text-red-400 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Parlay Slip Panel */}
      <AnimatePresence>
        {parlaySlipOpen && (
          <>
            {/* Backdrop - click to close slip but keep mode active */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0 } }}
              onClick={() => setParlaySlipOpen(false)}
              className="fixed inset-0 z-40 bg-black/20"
            />
            {/* Slip */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%', transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              className="fixed right-0 top-0 h-full w-full max-w-sm z-50 bg-[#09090F] border-l border-white/5 shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-violet-400" />
                  <span className="text-sm font-bold text-white">Multi-Bet Slip</span>
                  {!parlayMode && (
                    <button
                      onClick={() => setParlayMode(true)}
                      className="ml-2 px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 text-[9px] font-bold"
                    >
                      ACTIVATE
                    </button>
                  )}
                </div>
                <button onClick={() => setParlaySlipOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Legs list */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {parlayLegs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-center">
                    <Layers className="w-8 h-8 text-slate-700 mb-3" />
                    <p className="text-slate-500 text-sm">No legs added yet</p>
                    <p className="text-slate-600 text-[11px] mt-1">
                      {parlayMode ? 'Click YES or NO on any market card' : 'Activate Multi-Bet to start building'}
                    </p>
                  </div>
                ) : (
                  parlayLegs.map((leg, i) => {
                    const legKey = leg.outcomeName
                      ? `${leg.marketId}::${leg.outcomeName}::${leg.outcome}`
                      : `${leg.marketId}::${leg.outcome}`;
                    return (
                      <motion.div
                        key={legKey}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5"
                      >
                        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center">
                          <span className="text-[9px] font-black text-violet-300">{i + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-white font-medium truncate">{leg.marketName}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                              leg.outcome === 'yes' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                            }`}>{leg.outcome}</span>
                            <span className="text-[10px] text-slate-400">${leg.price.toFixed(2)}</span>
                            <span className="text-[10px] text-slate-500">{(1 / leg.price).toFixed(2)}x</span>
                          </div>
                        </div>
                        <button
                          onClick={() => removeParlayLeg(legKey)}
                          className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </motion.div>
                    );
                  })
                )}

                {parlayLegs.length > 0 && parlayLegs.length < 6 && parlayMode && (
                  <div className="text-center py-2">
                    <span className="text-[10px] text-slate-600">
                      Add up to {6 - parlayLegs.length} more leg{6 - parlayLegs.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>

              {/* Summary + Controls */}
              {parlayLegs.length >= 2 && (
                <div className="border-t border-white/5 px-4 py-4 space-y-3 bg-white/[0.02]">
                  {/* Combined odds */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">Combined Odds</span>
                    <span className="text-sm font-black text-violet-300">{parlayMultiplier.toFixed(2)}x</span>
                  </div>

                  {/* Stake input */}
                  <div>
                    <label className="text-[10px] text-slate-500 mb-1.5 block">Stake ($)</label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setParlayStake(s => String(Math.max(1, (parseFloat(s) || 0) - 5)))}
                        className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all"
                      >
                        <Minus className="w-3 h-3 text-slate-400" />
                      </button>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={parlayStake}
                        onChange={e => setParlayStake(e.target.value)}
                        className="flex-1 h-8 px-3 bg-white/[0.04] rounded-lg text-white text-sm font-mono text-center focus:outline-none focus:ring-1 focus:ring-violet-500/30 border border-white/5"
                      />
                      <button
                        onClick={() => setParlayStake(s => String((parseFloat(s) || 0) + 5))}
                        className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all"
                      >
                        <Plus className="w-3 h-3 text-slate-400" />
                      </button>
                    </div>
                  </div>

                  {/* Potential payout */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-violet-500/5 border border-violet-500/10">
                    <span className="text-[10px] text-slate-500">Potential Payout</span>
                    <span className="text-base font-black text-violet-300">${parlayPayout.toFixed(2)}</span>
                  </div>

                  {/* Place button */}
                  <button
                    onClick={placeParlay}
                    disabled={parlayPlacing || parlayLegs.length < 2}
                    className="w-full py-3.5 rounded-xl bg-violet-500 hover:bg-violet-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    {parlayPlacing ? (
                      <>
                        <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        Placing...
                      </>
                    ) : (
                      <>
                        <Layers className="w-3.5 h-3.5" />
                        Place Parlay ({parlayLegs.length} legs)
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => { clearParlay(); setParlayMode(false); }}
                    className="w-full py-2 text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
                  >
                    Clear slip & exit multi-bet
                  </button>
                </div>
              )}

              {parlayLegs.length === 1 && (
                <div className="border-t border-white/5 px-4 py-4">
                  <p className="text-[11px] text-slate-500 text-center">
                    Add at least 1 more leg to place a parlay
                  </p>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Trade Panel - Shows all markets for the event */}
      {selectedEvent && (
        <TradePanel
          eventMarkets={selectedEvent.markets}
          eventTitle={selectedEvent.eventTitle}
          isOpen={isTradePanelOpen}
          onClose={() => {
            setIsTradePanelOpen(false);
            setSelectedEvent(null);
          }}
          parlayMode={parlayMode}
          onAddToParlay={(market, side, outcomeName, outcomePrice) => {
            addParlayLeg(market, side, outcomeName, outcomePrice);
            setParlaySlipOpen(true);
          }}
          onTrade={() => {
            router.push('/dashboard');
          }}
        />
      )}
    </div>
  );
}
