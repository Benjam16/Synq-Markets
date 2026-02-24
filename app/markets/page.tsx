"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useDebounce } from "@/lib/use-debounce";
import { Market } from "@/lib/types";
import { Filter, TrendingUp, Zap, Sparkles, Bookmark, ChevronLeft, ChevronRight, Vote, Trophy, Coins, TrendingDown, Globe, Briefcase } from "lucide-react";
import { motion } from "framer-motion";
// Dynamic imports for code splitting
import dynamic from 'next/dynamic';

const TradePanel = dynamic(() => import("../components/TradePanel"), { ssr: false });
const MarketCard = dynamic(() => import("../components/MarketCard"), { ssr: false });
const VirtualizedMarketList = dynamic(() => import("../components/VirtualizedMarketList"), { ssr: false });
import { useAuth } from "../components/AuthProvider";
import { useRouter } from "next/navigation";
import { Toaster } from "react-hot-toast";

export default function MarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('Trending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<{ key: string; eventTitle: string; markets: Market[] } | null>(null);
  const [isTradePanelOpen, setIsTradePanelOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [topNavHeight, setTopNavHeight] = useState(57);
  const [sourceFilter, setSourceFilter] = useState<'All' | 'Polymarket' | 'Kalshi'>('All');
  const { user } = useAuth();
  const router = useRouter();

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
        console.log(`[Markets Page] ${isInitial ? 'Initial' : 'Refresh'} load started...`);
        
        // Fetch ALL markets (no limit or very high limit)
        // Don't use abort signal on initial load to prevent cancellation
        const fetchOptions: RequestInit = {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        };
        
        // Only add abort signal after initial load completes
        if (initialLoadComplete) {
          fetchOptions.signal = currentAbortController.signal;
        }
        
        // Fetch all markets - use high limit to get all 3000+ markets
        const res = await fetch(`/api/markets?limit=5000&_t=${Date.now()}`, fetchOptions);
        
        if (!mounted) {
          console.log('[Markets Page] Component unmounted, skipping state update');
          return;
        }
        
        if (res.ok) {
          const data = await res.json();
          const marketsCount = data.markets?.length || 0;
          console.log(`[Markets Page] ✅ Received ${marketsCount} markets from API`);
          
          if (data.error) {
            console.error(`[Markets Page] API error:`, data.error);
          }
          
          // Always update markets if we got data
          if (marketsCount > 0) {
            setMarkets(data.markets);
            console.log(`[Markets Page] ✅ Set ${marketsCount} markets in state`);
          } else {
            console.warn(`[Markets Page] ⚠️ Received 0 markets from API`);
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
          console.log(`[Markets Page] Request aborted ${isInitial ? '(unexpected on initial load!)' : '(navigation)'}`);
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

  // Debounced search for better performance
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Group markets by event (slug) - Polymarket style: one card per event
  const groupedMarkets = useMemo(() => {
    // Debug: Log total markets and category distribution
    if (markets.length > 0) {
      const categoryCounts: Record<string, number> = {};
      markets.forEach((m: any) => {
        const cat = (m.category || 'General').toLowerCase();
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      });
      console.log(`[Markets Page] Total markets: ${markets.length} | Categories:`, categoryCounts);
      
      if (selectedCategory === 'Breaking') {
        const cryptoCount = markets.filter(m => {
          const name = (m.name || '').toLowerCase();
          const cat = (m.category || '').toLowerCase();
          return cat === 'crypto' || name.includes('bitcoin') || name.includes('btc') || 
                 name.includes('ethereum') || name.includes('eth') || name.includes('crypto');
        }).length;
        const sportsCount = markets.filter(m => {
          const name = (m.name || '').toLowerCase();
          const cat = (m.category || '').toLowerCase();
          return cat === 'sports' || name.includes('nba') || name.includes('nfl') || 
                 name.includes('nhl') || name.includes('mlb') || name.includes('soccer');
        }).length;
        console.log(`[Breaking Debug] Crypto: ${cryptoCount} | Sports: ${sportsCount}`);
      }
    } else {
      console.warn(`[Markets Page] No markets available!`);
    }
    
    // First filter markets
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
        
        // Debug: Log if we found short-term/same-day markets
        if (matchesCat && (isShortTermCrypto || isSameDaySports)) {
          console.log(`[Breaking] Found ${isShortTermCrypto ? 'short-term crypto' : ''} ${isSameDaySports ? 'same-day sports' : ''} market: "${m.name?.substring(0, 60)}"`);
        }
      } else if (selectedCategory === 'New') {
        const marketDate = m.last_updated ? new Date(m.last_updated) : new Date();
        const daysSince = (Date.now() - marketDate.getTime()) / (1000 * 60 * 60 * 24);
        const isRecent = daysSince < 3;
        const isNewlyListed = (m.volume || 0) < 10000;
        matchesCat = isRecent || isNewlyListed;
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
            'sports': ['sport'],
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
    
    // Debug: Log category distribution of filtered markets
    const filteredCategoryCounts: Record<string, number> = {};
    filtered.forEach((m: any) => {
      const cat = (m.category || 'General').toLowerCase();
      filteredCategoryCounts[cat] = (filteredCategoryCounts[cat] || 0) + 1;
    });
    console.log(`[Markets Page] After filtering for "${selectedCategory}": ${filtered.length} markets`);
    console.log(`[Markets Page] Filtered category distribution:`, filteredCategoryCounts);
    
    // Debug: Show sample market categories for troubleshooting
    if (filtered.length === 0 && markets.length > 0) {
      const sampleCategories = Array.from(new Set(markets.slice(0, 20).map((m: any) => m.category || 'General')));
      console.warn(`[Markets Page] No markets matched "${selectedCategory}". Sample categories in data:`, sampleCategories);
    }

    // Group by event slug (or eventTitle if slug not available)
    const grouped = new Map<string, Market[]>();
    filtered.forEach(market => {
      const key = market.slug || market.eventTitle || market.id;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(market);
    });
    
    console.log(`[Markets Page] Grouped into ${grouped.size} event groups`);

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
  }, [markets, debouncedSearch, selectedCategory, sourceFilter]);

  const handleBuy = useCallback((market: Market, side: "yes" | "no") => {
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

            {/* Source Toggle — All / Polymarket / Kalshi */}
            <div className="flex items-center gap-1 bg-white/[0.03] rounded-full p-1 mb-1">
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
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-[#4FFFC8] border-t-transparent rounded-full animate-spin" />
              <span className="text-slate-400 text-sm">Loading markets...</span>
            </div>
          </div>
        ) : groupedMarkets.length === 0 ? (
          <div className="text-center py-32">
            <Filter className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <p className="text-lg text-slate-400 mb-2">
              {markets.length === 0 
                ? 'Loading markets...' 
                : 'No markets found'}
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
          </div>
        ) : (
          <VirtualizedMarketList
            items={groupedMarkets}
            initialCount={50} // Render first 50 markets
            loadMoreCount={50} // Load 50 more when scrolling near bottom
            className="mt-4"
            renderItem={(eventGroup, index) => (
              <MarketCard
                key={eventGroup.key}
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
              />
            )}
          />
        )}
      </main>

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
          onTrade={() => {
            router.push('/dashboard');
          }}
        />
      )}
    </div>
  );
}
