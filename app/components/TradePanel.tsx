'use client';

import { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Market } from '@/lib/types';
import { useAuth } from './AuthProvider';
import dynamic from 'next/dynamic';
import { toast } from 'react-hot-toast';

// Lazy load heavy chart component
const LineChart = dynamic(() => import('recharts').then(mod => ({ default: mod.LineChart })), { ssr: false });
const Line = dynamic(() => import('recharts').then(mod => ({ default: mod.Line })), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(mod => ({ default: mod.XAxis })), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(mod => ({ default: mod.YAxis })), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(mod => ({ default: mod.ResponsiveContainer })), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(mod => ({ default: mod.Tooltip })), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(mod => ({ default: mod.CartesianGrid })), { ssr: false });

interface TradePanelProps {
  market?: Market | null; // Legacy support
  eventMarkets?: Market[]; // New: all markets for an event
  eventTitle?: string; // Event title
  isOpen: boolean;
  onClose: () => void;
  onTrade: (market: Market, side: 'yes' | 'no', quantity: number) => void;
}

export default function TradePanel({ market, eventMarkets, eventTitle, isOpen, onClose, onTrade }: TradePanelProps) {
  // Use eventMarkets if provided, otherwise fall back to single market
  const markets = eventMarkets || (market ? [market] : []);
  const displayTitle = eventTitle || market?.eventTitle || market?.name || "Market";
  const mainMarket = markets[0] || market;
  
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(mainMarket);
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const [tradeSide, setTradeSide] = useState<'yes' | 'no'>('yes'); // Track if trading Yes or No on the selected outcome
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy'); // Buy or Sell (like Polymarket)
  const [quantity, setQuantity] = useState<string>('100');
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [userPositions, setUserPositions] = useState<any[]>([]); // User's open positions for this market
  const [tradeStatus, setTradeStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle'); // Optimistic trade state
  const { user } = useAuth();
  const dataInitializedRef = useRef(false); // Track if initial data has been loaded
  const lastUpdateTimeRef = useRef<number>(0); // Track last update timestamp

  // Set default selected market when panel opens
  useEffect(() => {
    if (isOpen && markets.length > 0) {
      setSelectedMarket(markets[0]);
    }
  }, [isOpen, markets.length]);

  // Helper function to create a data point from current market prices
  const createDataPoint = useCallback((market: Market, timestamp: number) => {
    const outcomes = market.outcomes || [];
    const hasMultipleOutcomes = outcomes.length > 2 || (outcomes.length === 2 && !outcomes.some(o => o.name.toUpperCase() === 'YES' || o.name.toUpperCase() === 'NO'));
    const dataPoint: any = {
      date: new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      timestamp: timestamp,
    };
    
    if (hasMultipleOutcomes && outcomes.length > 0) {
      outcomes.forEach((outcome, idx) => {
        const key = outcome.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() || `outcome_${idx}`;
        dataPoint[key] = (outcome.price || 0) * 100;
      });
    } else {
      dataPoint.yes = (market.yesPrice ?? market.price) * 100;
      dataPoint.no = (market.noPrice ?? (1 - market.price)) * 100;
    }
    
    return dataPoint;
  }, []);

  // Initial load: Fetch historical data once
  useEffect(() => {
    if (!isOpen || !selectedMarket?.conditionId) {
      setHistoricalData([]);
      dataInitializedRef.current = false;
      return;
    }

    // Only fetch full history on initial load or market change
    if (dataInitializedRef.current) return;

    const fetchInitialHistory = async () => {
      setLoadingHistory(true);
      try {
        const endpoint = `https://gamma-api.polymarket.com/history?market=${selectedMarket.conditionId}`;
        
        let data = null;
        try {
          const res = await fetch(endpoint, {
            mode: 'cors',
            credentials: 'omit',
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
          });
          
          if (res.ok) {
            const json = await res.json();
            if (Array.isArray(json) && json.length > 0) {
              data = json;
            } else if (json.data && Array.isArray(json.data) && json.data.length > 0) {
              data = json.data;
            } else if (json.history && Array.isArray(json.history) && json.history.length > 0) {
              data = json.history;
            }
          }
        } catch (e) {
          console.warn('[TradePanel] Failed to fetch history:', e);
        }

        const outcomes = selectedMarket.outcomes || [];
        const hasMultipleOutcomes = outcomes.length > 2 || (outcomes.length === 2 && !outcomes.some(o => o.name.toUpperCase() === 'YES' || o.name.toUpperCase() === 'NO'));
        
        if (!data || data.length === 0) {
          // Create synthetic initial data
          const syntheticData = [];
          const now = Date.now();
          for (let i = 24; i >= 0; i--) {
            const time = now - (i * 3600000);
            const point = createDataPoint(selectedMarket, time);
            // Add slight variation for synthetic data
            Object.keys(point).forEach(key => {
              if (key !== 'date' && key !== 'timestamp' && typeof point[key] === 'number') {
                const variation = (Math.random() - 0.5) * 2;
                point[key] = Math.max(0, Math.min(100, point[key] + variation));
              }
            });
            syntheticData.push(point);
          }
          setHistoricalData(syntheticData);
          dataInitializedRef.current = true;
        } else {
          // Parse real historical data
          const formatted = data
            .slice(-100)
            .map((point: any) => {
              const dataPoint: any = { timestamp: 0 };
              
              let timestamp = point.timestamp || point.time || point.date || Date.now();
              if (typeof timestamp === 'string') {
                timestamp = new Date(timestamp).getTime();
              }
              dataPoint.timestamp = timestamp;
              dataPoint.date = new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
              
              if (hasMultipleOutcomes && outcomes.length > 0 && point.outcomePrices && Array.isArray(point.outcomePrices)) {
                outcomes.forEach((outcome, idx) => {
                  const price = parseFloat(point.outcomePrices[idx] || '0');
                  const key = outcome.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() || `outcome_${idx}`;
                  dataPoint[key] = Math.max(0, Math.min(100, price * 100));
                });
              } else {
                const yesPrice = parseFloat(
                  point.yesPrice || point.yes || point.price || point.probability ||
                  (point.outcomePrices && Array.isArray(point.outcomePrices) ? point.outcomePrices[0] : null) || '0.5'
                );
                dataPoint.yes = Math.max(0, Math.min(100, yesPrice * 100));
                dataPoint.no = Math.max(0, Math.min(100, (1 - yesPrice) * 100));
              }
              
              return dataPoint;
            })
            .filter((p: any) => p.timestamp > 0)
            .sort((a: any, b: any) => a.timestamp - b.timestamp);
          
          if (formatted.length > 0) {
            setHistoricalData(formatted);
            dataInitializedRef.current = true;
            lastUpdateTimeRef.current = formatted[formatted.length - 1].timestamp;
          } else {
            const currentPoint = createDataPoint(selectedMarket, Date.now());
            setHistoricalData([currentPoint]);
            dataInitializedRef.current = true;
            lastUpdateTimeRef.current = Date.now();
          }
        }
      } catch (err) {
        console.warn('Failed to fetch historical data:', err);
        const currentPoint = createDataPoint(selectedMarket, Date.now());
        setHistoricalData([currentPoint]);
        dataInitializedRef.current = true;
        lastUpdateTimeRef.current = Date.now();
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchInitialHistory();
  }, [isOpen, selectedMarket?.conditionId, createDataPoint]);

  // Live updates: Only update the last data point or append new ones (smooth updates)
  // Throttled to reduce re-renders
  useEffect(() => {
    if (!isOpen || !selectedMarket || !dataInitializedRef.current) return;

    let lastUpdate = 0;
    const throttleMs = 2000; // Update every 2 seconds for selected market (high-frequency terminal feel)

    const updateLivePrice = () => {
      const now = Date.now();
      if (now - lastUpdate < throttleMs) return;
      lastUpdate = now;

      setHistoricalData((prevData) => {
        if (prevData.length === 0) return prevData;
        
        const newPoint = createDataPoint(selectedMarket, now);
        
        // If last point is very recent (< 15 seconds), update it instead of appending
        const lastPoint = prevData[prevData.length - 1];
        const timeSinceLastUpdate = now - (lastPoint.timestamp || now);
        
        if (timeSinceLastUpdate < 15000 && prevData.length > 0) {
          // Update last point smoothly
          return [...prevData.slice(0, -1), newPoint];
        } else {
          // Append new point, but keep only last 50 points for performance (reduced from 100)
          const updated = [...prevData, newPoint];
          return updated.slice(-50);
        }
      });
    };

    // Update every 2 seconds for selected market (high-frequency terminal feel)
    const interval = setInterval(updateLivePrice, 2000);
    
    return () => clearInterval(interval);
  }, [isOpen, selectedMarket, createDataPoint]);

  // Fetch user's positions for this market to show available shares to sell
  useEffect(() => {
    if (!user || !selectedMarket || !isOpen) {
      setUserPositions([]);
      return;
    }

    const fetchPositions = async () => {
      try {
        let userId: number | null = null;
        const getUserRes = await fetch(`/api/user?email=${encodeURIComponent(user.email || '')}`);
        if (getUserRes.ok) {
          const { user: dbUser } = await getUserRes.json();
          userId = dbUser.id;
        }

        if (!userId) {
          setUserPositions([]);
          return;
        }

        const res = await fetch(`/api/positions?userId=${userId}&marketId=${selectedMarket.id || selectedMarket.conditionId}`);
        if (res.ok) {
          const data = await res.json();
          setUserPositions(data.positions || []);
        } else {
          setUserPositions([]);
        }
      } catch (error) {
        // Silently fail - positions are optional
        console.warn('Error fetching positions:', error);
        setUserPositions([]);
      }
    };

    fetchPositions();
    // Refresh positions every 10 seconds for better performance (reduced from 3)
    const interval = setInterval(fetchPositions, 10000);
    return () => clearInterval(interval);
  }, [user, selectedMarket, isOpen]);

  if (!selectedMarket || markets.length === 0) return null;

  // Memoize expensive outcome computation
  const allOutcomes = useMemo(() => {
    if (selectedMarket.outcomes && selectedMarket.outcomes.length > 0) {
      return selectedMarket.outcomes;
    }
    
    // Fallback for binary markets
    const nameLower = selectedMarket.name.toLowerCase();
    if (nameLower.includes('up or down') || nameLower.includes('up/down')) {
      return [
        { id: 'up', name: 'Up', price: selectedMarket.yesPrice ?? selectedMarket.price },
        { id: 'down', name: 'Down', price: selectedMarket.noPrice ?? (1 - selectedMarket.price) },
      ];
    }
    
    return [
      { id: 'yes', name: 'YES', price: selectedMarket.yesPrice ?? selectedMarket.price },
      { id: 'no', name: 'NO', price: selectedMarket.noPrice ?? (1 - selectedMarket.price) },
    ];
  }, [selectedMarket]);
  
  // Sort outcomes: YES/NO or UP/DOWN first, then others
  const sortedOutcomes = useMemo(() => {
    if (!selectedMarket?.outcomes || selectedMarket.outcomes.length === 0) {
      return allOutcomes;
    }
    
    const yesNoUpDown = allOutcomes.filter(o => {
      const name = o.name.toUpperCase();
      return name === 'YES' || name === 'NO' || name === 'UP' || name === 'DOWN';
    });
    
    const others = allOutcomes.filter(o => {
      const name = o.name.toUpperCase();
      return name !== 'YES' && name !== 'NO' && name !== 'UP' && name !== 'DOWN';
    });
    
    return [...yesNoUpDown, ...others];
  }, [allOutcomes, selectedMarket]);
  
  // Set default selected outcome on mount (only if no outcome is selected)
  useEffect(() => {
    if (sortedOutcomes.length > 0 && !selectedOutcome && isOpen) {
      setSelectedOutcome(sortedOutcomes[0].id);
      setTradeSide('yes'); // Default to "Yes" when selecting first outcome
    }
  }, [isOpen, sortedOutcomes.length]); // Removed selectedOutcome from deps to prevent reset

  // Get the current price based on selected outcome and trade side - memoized
  const currentOutcome = useMemo(() => 
    sortedOutcomes.find(o => o.id === selectedOutcome) || sortedOutcomes[0],
    [sortedOutcomes, selectedOutcome]
  );
  
  const currentPrice = useMemo(() => 
    currentOutcome 
      ? (tradeSide === 'no' ? (1 - (currentOutcome.price || 0)) : (currentOutcome.price || 0))
      : 0,
    [currentOutcome, tradeSide]
  );
  
  const cost = useMemo(() => Number(quantity) * currentPrice, [quantity, currentPrice]);

  const handleTrade = async () => {
    if (!user || Number(quantity) <= 0 || !selectedOutcome || !currentOutcome) {
      toast.error('Please select an outcome to trade');
      return;
    }

    // OPTIMISTIC UPDATE: Show processing state immediately
    setTradeStatus('processing');

    try {
      // Ensure we have the user's email
      if (!user.email) {
        setTradeStatus('error');
        toast.error('No email found — please sign in again');
        return;
      }

      // Get or create user ID from database
      let userId: number | null = null;

      // Step 1: Try to get existing user
      try {
        const getUserRes = await fetch(`/api/user?email=${encodeURIComponent(user.email)}`);
      if (getUserRes.ok) {
        const { user: dbUser } = await getUserRes.json();
          userId = dbUser?.id ?? null;
        } else if (getUserRes.status === 404) {
          // User not found — will create below
      } else {
          // Server error — log but still try to create
          const errData = await getUserRes.json().catch(() => ({}));
          console.warn('[Trade] GET /api/user failed:', getUserRes.status, errData);
        }
      } catch (fetchErr) {
        console.warn('[Trade] GET /api/user network error:', fetchErr);
      }

      // Step 2: If user not found, create them
      if (!userId) {
        try {
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
            userId = data.userId ?? data.user?.id ?? null;
          } else {
            const errData = await createRes.json().catch(() => ({}));
            console.error('[Trade] POST /api/user failed:', createRes.status, errData);
            setTradeStatus('error');
            toast.error(errData.error || `Account setup failed (${createRes.status})`);
            return;
          }
        } catch (createErr) {
          console.error('[Trade] POST /api/user network error:', createErr);
          setTradeStatus('error');
          toast.error('Network error — please check your connection');
          return;
        }
      }

      if (!userId) {
        setTradeStatus('error');
        toast.error('Could not set up your account — please refresh and try again');
        return;
      }

      // Use the tradeSide state (set when clicking Buy Yes/No buttons)
      // This ensures "Buy No" on a candidate trades "No" on that candidate, not a generic "No" outcome
      const side = tradeSide;

      // Call buy or sell API based on tradeType
      const apiEndpoint = tradeType === 'sell' ? '/api/sell' : '/api/buy';
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          marketId: selectedMarket.id || selectedMarket.conditionId,
          provider: (selectedMarket.provider || 'polymarket').toLowerCase(),
          side: side, // 'yes' or 'no'
          outcome: currentOutcome.name, // Outcome name (e.g., "Gavin Newsom")
          currentOutcome: currentOutcome, // Full outcome object for price lookup
          price: currentPrice,
          quantity: Number(quantity),
          marketName: selectedMarket.eventTitle || selectedMarket.name || displayTitle,
          category: selectedMarket.category || 'General',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        
        // Check if there's an error in the response
        if (data.error) {
          setTradeStatus('error');
          toast.error(data.error, {
            style: {
              background: '#ef4444',
              color: '#ffffff',
              border: '1px solid #dc2626',
            },
          });
          // Reset to idle after error
          setTimeout(() => setTradeStatus('idle'), 2000);
          return;
        }
        
        // OPTIMISTIC UPDATE: Show success state immediately
        setTradeStatus('success');
        
        // Log successful trade
        console.log('[TradePanel] Trade successful:', data);
        
        // Optimistically update positions (don't wait for API)
        if (tradeType === 'buy') {
          // Add new position optimistically
          const newPosition = {
            id: data.trade?.id || Date.now(),
            marketId: selectedMarket.id || selectedMarket.conditionId,
            provider: (selectedMarket.provider || 'polymarket').toLowerCase(),
            side: side,
            price: currentPrice,
            quantity: Number(quantity),
            executedAt: new Date().toISOString(),
          };
          setUserPositions(prev => [...(prev || []), newPosition]);
        } else {
          // Remove/update sold positions optimistically
          setUserPositions(prev => {
            if (!prev) return [];
            let remaining = Number(quantity);
            return prev.filter(pos => {
              if (pos.marketId === (selectedMarket.id || selectedMarket.conditionId) && remaining > 0) {
                const posQty = Number(pos.quantity || 0);
                if (posQty <= remaining) {
                  remaining -= posQty;
                  return false; // Remove this position
                } else {
                  remaining = 0;
                  return true; // Keep but quantity will be updated by next refresh
                }
              }
              return true;
            });
          });
        }
        
        // Refresh positions in background (non-blocking)
        fetch(`/api/positions?userId=${userId}&marketId=${selectedMarket.id || selectedMarket.conditionId}`)
          .then(res => res.ok ? res.json() : null)
          .then(posData => {
            if (posData?.positions) {
              setUserPositions(posData.positions);
            }
          })
          .catch(() => {}); // Silently fail - optimistic update already applied
        
        // Trigger dashboard refresh by dispatching custom event (non-blocking)
        window.dispatchEvent(new CustomEvent('trade-executed', { detail: data }));
        
        const action = tradeType === 'sell' ? 'Sold' : 'Bought';
        const pnlInfo = tradeType === 'sell' && data.pnl ? ` (PnL: ${data.pnl >= 0 ? '+' : ''}$${data.pnl.toFixed(2)})` : '';
        toast.success(`${action}: ${currentOutcome?.name.toUpperCase()} ${selectedMarket.name}${pnlInfo}`, {
          duration: 3000,
          style: {
            background: tradeType === 'sell' ? '#ef4444' : '#10b981',
            color: '#ffffff',
          },
        });
        
        // Keep success state visible for 1 second before closing
        setTimeout(() => {
          setTradeStatus('idle');
          onClose();
          // Call the onTrade callback for any additional handling
          if (onTrade && selectedMarket) {
            onTrade(selectedMarket, tradeSide, Number(quantity));
          }
        }, 1000);
      } else {
        setTradeStatus('error');
        let errorMessage = `Failed to ${tradeType}`;
        try {
          // Try to get error message from response
          const text = await res.text();
          if (text) {
            try {
              const error = JSON.parse(text);
              errorMessage = error.error || error.message || error.details || errorMessage;
              
              // Check for specific error types and provide helpful messages
              const errorLower = errorMessage.toLowerCase();
              if (errorLower.includes('circuit breaker') || errorLower.includes('too many authentication')) {
                errorMessage = 'Authentication rate limit exceeded. Please wait a few minutes and try again. If this persists, check your Supabase credentials.';
              } else if (errorLower.includes('authentication') || errorLower.includes('unauthorized')) {
                errorMessage = 'Authentication error. Please refresh the page and try again.';
              } else if (errorLower.includes('no active challenge') || errorLower.includes('subscription')) {
                errorMessage = 'You need an active challenge subscription to trade. Please purchase a challenge first.';
              } else if (errorLower.includes('insufficient') || errorLower.includes('balance')) {
                errorMessage = 'Insufficient balance. Please check your account balance.';
              }
              
              // Only log if error object has meaningful content
              if (Object.keys(error).length > 0) {
                console.error('Trade API error:', {
                  status: res.status,
                  statusText: res.statusText,
                  error: error,
                  body: text,
                });
              } else {
                // If error object is empty, log the raw response
                console.error('Trade API error (empty error object):', {
                  status: res.status,
                  statusText: res.statusText,
                  body: text,
                  errorMessage: errorMessage,
                });
              }
            } catch {
              // If not JSON, use the text as error message
              errorMessage = text.length > 100 ? `Failed to ${tradeType} (HTTP ${res.status})` : text;
              console.error('Trade API error (non-JSON):', {
                status: res.status,
                statusText: res.statusText,
                body: text,
              });
            }
          } else {
            errorMessage = `Failed to ${tradeType} (HTTP ${res.status} ${res.statusText})`;
            console.error('Trade API error (empty response):', {
              status: res.status,
              statusText: res.statusText,
            });
          }
        } catch (parseError: any) {
          console.error('Failed to parse error response:', parseError);
          errorMessage = `Failed to ${tradeType} (HTTP ${res.status})`;
        }
        toast.error(errorMessage, {
          duration: 5000,
          style: {
            background: '#ef4444',
            color: '#ffffff',
            border: '1px solid #dc2626',
          },
        });
        // Reset to idle after error
        setTimeout(() => setTradeStatus('idle'), 2000);
      }
    } catch (error: any) {
      setTradeStatus('error');
      console.error('Trade failed:', error);
      let errorMessage = error?.message || 'Failed to execute trade';
      
      // Check for specific error types in network errors
      const errorLower = errorMessage.toLowerCase();
      if (errorLower.includes('circuit breaker') || errorLower.includes('too many authentication')) {
        errorMessage = 'Authentication rate limit exceeded. Please wait a few minutes and try again. If this persists, check your Supabase credentials.';
      } else if (errorLower.includes('network') || errorLower.includes('fetch')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (error?.name === 'AbortError') {
        errorMessage = 'Request was cancelled. Please try again.';
      }
      
      toast.error(errorMessage, {
        duration: 5000,
        style: {
          background: '#ef4444',
          color: '#ffffff',
          border: '1px solid #dc2626',
        },
      });
      // Reset to idle after error
      setTimeout(() => setTradeStatus('idle'), 2000);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop - Click outside to close */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
          />

          {/* Centered Slide-over Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4"
            onClick={(e) => {
              // Only close if clicking directly on the backdrop, not on the content
              if (e.target === e.currentTarget) {
                onClose();
              }
            }}
          >
            <div 
              className="w-full h-full md:h-auto md:max-w-4xl bg-slate-950/50 backdrop-blur-md border border-white/5 md:rounded-2xl shadow-2xl overflow-hidden md:max-h-[90vh] overflow-y-auto"
              onClick={(e) => {
                // Prevent clicks inside the content from closing the panel
                e.stopPropagation();
              }}
              onMouseDown={(e) => {
                // Also prevent mousedown events from bubbling
                e.stopPropagation();
              }}
            >
              {/* Market Banner Image at the top */}
              {selectedMarket.imageUrl && (
                <div className="relative w-full h-48 bg-slate-900/50 overflow-hidden">
                  <img
                    src={selectedMarket.imageUrl}
                    alt={displayTitle}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/50 to-transparent" />
                </div>
              )}

              <div className="p-8">
                {/* Close Button */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 hover:bg-slate-800 rounded-lg transition-colors z-10"
                >
                  <X className="w-5 h-5 text-slate-400" strokeWidth={1.5} />
                </button>

                {/* Event Title and Market Selection */}
                <div className="mb-8">
                  <h2 className="text-3xl font-bold text-white mb-4 leading-tight">
                    {displayTitle}
                  </h2>
                  
                  {/* Market Type Selector - Show all markets for this event */}
                  {markets.length > 1 && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-slate-400 mb-2">
                        Select Market Type
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {markets.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => {
                              setSelectedMarket(m);
                              setSelectedOutcome(null); // Reset outcome selection
                            }}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                              selectedMarket?.id === m.id
                                ? 'bg-[#4FFFC8] text-[#050505] border-2 border-[#4FFFC8]'
                                : 'bg-slate-950/50 backdrop-blur-md text-slate-300 border border-white/5 hover:border-white/10'
                            }`}
                          >
                            {/* Show outcome names for multi-outcome markets, otherwise show market type */}
                            {m.outcomes && m.outcomes.length > 2 
                              ? `${m.outcomes[0]?.name || m.marketType} (+${m.outcomes.length - 1})`
                              : m.outcomes && m.outcomes.length === 2 && m.marketType === m.outcomes[0]?.name
                              ? `${m.outcomes[0]?.name} / ${m.outcomes[1]?.name}`
                              : (m.marketType || 'Main')}
                            {m.volumeFormatted && (
                              <span className="ml-2 text-xs opacity-75">
                                {m.volumeFormatted}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-6">
                    <div>
                      <span className="text-sm text-slate-400">Volume: </span>
                      <span className="text-lg mono-number volume font-bold text-[#4FFFC8]">
                        {selectedMarket.volumeFormatted || (selectedMarket.volume ? `$${(selectedMarket.volume / 1000).toFixed(1)}k` : 'N/A')}
                      </span>
                    </div>
                    {selectedMarket.description && (
                      <div className="flex-1">
                        <p className="text-sm text-slate-400 line-clamp-2">{selectedMarket.description}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Polymarket Style: All Markets with All Outcomes */}
                <div className="space-y-6 mb-8">
                  {markets.map((mkt) => {
                    const mktOutcomes = mkt.outcomes || [];
                    const isSelectedMarket = selectedMarket?.id === mkt.id;
                    
                    // Check if this is a binary YES/NO or UP/DOWN market
                    const isBinaryMarket = mktOutcomes.length === 2 && 
                      (mktOutcomes.some(o => o.name.toUpperCase() === 'YES') && 
                       mktOutcomes.some(o => o.name.toUpperCase() === 'NO')) ||
                      (mktOutcomes.some(o => o.name.toUpperCase() === 'UP') && 
                       mktOutcomes.some(o => o.name.toUpperCase() === 'DOWN'));
                    
                    return (
                      <div key={mkt.id} className="bg-slate-950/50 backdrop-blur-md border border-white/5 rounded-lg p-6">
                        {/* Market Type Header */}
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold text-white">
                            {mkt.name?.includes(' - ') ? mkt.name.split(' - ')[1] : (mkt.marketType || 'Main Market')}
                          </h3>
                          <span className="text-sm text-slate-400 font-mono">
                            {mkt.volumeFormatted || 'N/A'} Vol.
                          </span>
                        </div>
                        
                        {/* Binary Market: Single Row with Yes/No */}
                        {isBinaryMarket ? (
                          (() => {
                            const yesOutcome = mktOutcomes.find(o => o.name.toUpperCase() === 'YES' || o.name.toUpperCase() === 'UP') || mktOutcomes[0];
                            const noOutcome = mktOutcomes.find(o => o.name.toUpperCase() === 'NO' || o.name.toUpperCase() === 'DOWN') || mktOutcomes[1];
                            const yesPrice = yesOutcome?.price || 0;
                            const noPrice = noOutcome?.price || 0;
                            const yesSelected = isSelectedMarket && selectedOutcome === yesOutcome?.id;
                            const noSelected = isSelectedMarket && selectedOutcome === noOutcome?.id;
                            
                            return (
                              <div className="space-y-2">
                                {/* Single Row for Binary Market */}
                                <div className="flex items-center justify-between p-4 rounded-lg border-2 border-white/5 bg-slate-950/50 backdrop-blur-md">
                                  {/* Market Question/Name */}
                                  <div className="flex items-center gap-3 flex-1">
                                    <div className="text-base font-medium text-white">
                                      {mkt.name?.includes(' - ') ? mkt.name.split(' - ')[0] : displayTitle}
                                    </div>
                                    <div className="text-xs text-slate-500 font-mono">
                                      {mkt.volumeFormatted || '$0'} Vol.
                                    </div>
                                  </div>
                                  
                                  {/* Yes Option */}
                                  <div className="flex items-center gap-3">
                                    <div className="text-right">
                                      <div className={`text-lg mono-number font-bold ${yesSelected ? 'text-[#4FFFC8]' : 'text-white'}`}>
                                        ${yesPrice.toFixed(2)}
                                      </div>
                                      <div className="text-xs text-slate-500 mono-number percentage">
                                        {(yesPrice * 100).toFixed(1)}%
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        setSelectedMarket(mkt);
                                        setSelectedOutcome(yesOutcome?.id || null);
                                      }}
                                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                        yesSelected
                                          ? 'bg-[#4FFFC8] text-[#050505]'
                                          : 'bg-green-600/20 text-green-400 border border-green-600/30 hover:bg-green-600/30'
                                      }`}
                                    >
                                      Buy Yes {yesPrice.toFixed(2)}¢
                                    </button>
                                  </div>
                                  
                                  {/* No Option */}
                                  <div className="flex items-center gap-3">
                                    <div className="text-right">
                                      <div className={`text-lg mono-number font-bold ${noSelected ? 'text-[#4FFFC8]' : 'text-white'}`}>
                                        ${noPrice.toFixed(2)}
                                      </div>
                                      <div className="text-xs text-slate-500 font-mono">
                                        {(noPrice * 100).toFixed(1)}%
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        setSelectedMarket(mkt);
                                        setSelectedOutcome(noOutcome?.id || null);
                                      }}
                                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                        noSelected
                                          ? 'bg-[#4FFFC8] text-[#050505]'
                                          : 'bg-red-600/20 text-red-400 border border-red-600/30 hover:bg-red-600/30'
                                      }`}
                                    >
                                      Buy No {noPrice.toFixed(2)}¢
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })()
                        ) : (
                          /* Multi-Choice Market: All Options with Yes/No for Each */
                          (() => {
                            // Filter out generic YES/NO outcomes for multi-choice markets
                            // Only show them if this is actually a binary market (exactly 2 outcomes total)
                            const isBinaryMarket = mktOutcomes.length === 2 && 
                              ((mktOutcomes.some(o => o.name.toUpperCase() === 'YES') && 
                                mktOutcomes.some(o => o.name.toUpperCase() === 'NO')) ||
                               (mktOutcomes.some(o => o.name.toUpperCase() === 'UP') && 
                                mktOutcomes.some(o => o.name.toUpperCase() === 'DOWN')));
                            
                            // For multi-choice markets, filter out generic YES/NO outcomes
                            const filteredOutcomes = isBinaryMarket 
                              ? mktOutcomes 
                              : mktOutcomes.filter(o => {
                                  const name = o.name.toUpperCase().trim();
                                  return name !== 'YES' && name !== 'NO';
                                });
                            
                            // Sort: put specific outcomes first
                            const sortedMktOutcomes = [...filteredOutcomes].sort((a, b) => {
                              const aName = a.name.toUpperCase();
                              const bName = b.name.toUpperCase();
                              const priority = ['YES', 'NO', 'UP', 'DOWN'];
                              const aIndex = priority.indexOf(aName);
                              const bIndex = priority.indexOf(bName);
                              // Put YES/NO/UP/DOWN at the end (only for binary markets)
                              if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
                              if (aIndex !== -1) return 1;
                              if (bIndex !== -1) return -1;
                              return 0;
                            });
                            
                            return (
                              <div className="space-y-2">
                                {sortedMktOutcomes.map((outcome) => {
                                  const isSelected = isSelectedMarket && selectedOutcome === outcome.id;
                                  const outcomePrice = outcome.price || 0;
                                  const probability = outcomePrice * 100;
                                  
                                  // Calculate "Buy No" price for this specific outcome
                                  // For multi-choice markets: "Buy No" = 1 - this outcome's price
                                  const noPrice = 1 - outcomePrice;
                                  
                                  return (
                                    <div
                                      key={outcome.id}
                                      onClick={(e) => {
                                        const target = e.target as HTMLElement;
                                        const isButton = target.tagName === 'BUTTON' || 
                                                        target.closest('button') !== null;
                                        if (!isButton) {
                                          setSelectedMarket(mkt);
                                          setSelectedOutcome(outcome.id);
                                          setTradeSide('yes'); // Default to "Yes" when clicking row
                                        }
                                      }}
                                      className={`flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-all ${
                                        isSelected
                                          ? 'border-[#4FFFC8] bg-[#4FFFC8]/10'
                                          : 'border-white/5 bg-slate-950/50 backdrop-blur-md hover:border-white/10'
                                      }`}
                                    >
                                      {/* Outcome Name */}
                                      <div className="flex items-center gap-3 flex-1">
                                        <div className="text-base font-medium text-white">
                                          {outcome.name}
                                        </div>
                                        <div className="text-xs text-slate-500 font-mono">
                                          {mkt.volumeFormatted || '$0'} Vol.
                                        </div>
                                      </div>
                                      
                                      {/* Price and Probability */}
                                      <div className="flex items-center gap-4">
                                        <div className="text-right">
                                          <div className={`text-lg mono-number font-bold ${isSelected ? 'text-[#4FFFC8]' : 'text-white'}`}>
                                            ${outcomePrice.toFixed(2)}
                                          </div>
                                          <div className="text-xs text-slate-500 mono-number percentage">
                                            {probability.toFixed(1)}%
                                          </div>
                                        </div>
                                        
                                        {/* Buy Yes/No Buttons */}
                                        <div className="flex gap-2 relative z-10" onClick={(e) => e.stopPropagation()}>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              e.preventDefault();
                                              setSelectedMarket(mkt);
                                              setSelectedOutcome(outcome.id);
                                              setTradeSide('yes'); // Trading "Yes" on this outcome
                                            }}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                              isSelected && tradeSide === 'yes'
                                                ? 'bg-[#4FFFC8] text-[#050505]'
                                                : 'bg-green-600/20 text-green-400 border border-green-600/30 hover:bg-green-600/30'
                                            }`}
                                          >
                                            Buy Yes {outcomePrice.toFixed(2)}¢
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              e.preventDefault();
                                              // For multi-choice markets, "Buy No" means trading "No" on THIS specific outcome
                                              // Keep the same outcome selected, but set tradeSide to 'no'
                                              setSelectedMarket(mkt);
                                              setSelectedOutcome(outcome.id); // Keep THIS outcome selected
                                              setTradeSide('no'); // Trading "No" on this outcome
                                            }}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                              isSelected && tradeSide === 'no'
                                                ? 'bg-[#4FFFC8] text-[#050505]'
                                                : 'bg-red-600/20 text-red-400 border border-red-600/30 hover:bg-red-600/30'
                                            }`}
                                          >
                                            Buy No {noPrice.toFixed(2)}¢
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Trading Panel - Right Side (Polymarket Style) */}
                {selectedMarket && selectedOutcome && (
                  <div className="bg-slate-950/50 backdrop-blur-md border border-white/5 rounded-lg p-6 mb-8">
                    {/* Market Identifier */}
                    <div className="flex items-center gap-2 mb-4">
                      {selectedMarket.imageUrl && (
                        <img 
                          src={selectedMarket.imageUrl} 
                          alt={selectedMarket.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      )}
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          {currentOutcome ? (
                            tradeSide === 'no' 
                              ? `${currentOutcome.name} (No)` 
                              : currentOutcome.name
                          ) : 'Select Outcome'}
                        </h3>
                        <p className={`text-xs ${selectedMarket.provider === 'Kalshi' ? 'text-emerald-400' : 'text-blue-400'}`}>
                          {selectedMarket.provider || 'Polymarket'}
                        </p>
                      </div>
                    </div>

                    {/* Buy/Sell Tabs (Polymarket Style) */}
                    <div className="flex gap-2 mb-4 border-b border-white/5">
                      <button
                        onClick={() => setTradeType('buy')}
                        className={`px-4 py-2 text-sm font-medium transition-all border-b-2 ${
                          tradeType === 'buy'
                            ? 'border-[#4FFFC8] text-[#4FFFC8]'
                            : 'border-transparent text-slate-400 hover:text-white'
                        }`}
                      >
                        Buy
                      </button>
                      <button
                        onClick={() => setTradeType('sell')}
                        className={`px-4 py-2 text-sm font-medium transition-all border-b-2 ${
                          tradeType === 'sell'
                            ? 'border-[#4FFFC8] text-[#4FFFC8]'
                            : 'border-transparent text-slate-400 hover:text-white'
                        }`}
                      >
                        Sell
                      </button>
                    </div>

                    {/* Show available positions when selling */}
                    {tradeType === 'sell' && userPositions.length > 0 && (
                      <div className="mb-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                        <p className="text-xs text-slate-400 mb-2">Your Positions:</p>
                        {userPositions.map((pos: any) => (
                          <div key={pos.id} className="text-xs text-slate-300 mb-1">
                            {pos.outcome || pos.side}: {pos.quantity} shares @ ${pos.price}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Price History Chart for Selected Market - Polymarket Style: All Outcomes */}
                    <div className="mb-6 p-4 bg-slate-950/50 backdrop-blur-md border border-white/5 rounded-lg">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-medium text-slate-400">Price History</h4>
                        {/* Dynamic Legend: Show all outcomes */}
                        {(() => {
                          const outcomes = selectedMarket.outcomes || [];
                          const hasMultipleOutcomes = outcomes.length > 2 || (outcomes.length === 2 && !outcomes.some(o => o.name.toUpperCase() === 'YES' || o.name.toUpperCase() === 'NO'));
                          const colors = ['#4FFFC8', '#ffffff', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#10b981'];
                          
                          if (hasMultipleOutcomes && outcomes.length > 0) {
                            return (
                              <div className="flex items-center gap-3 flex-wrap text-xs">
                                {outcomes.map((outcome, idx) => {
                                  const color = colors[idx % colors.length];
                                  return (
                                    <div key={outcome.id || idx} className="flex items-center gap-2">
                                      <div className="w-3 h-0.5" style={{ backgroundColor: color }}></div>
                                      <span className="text-slate-400">{outcome.name}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          } else {
                            return (
                              <div className="flex items-center gap-4 text-xs">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-0.5 bg-[#4FFFC8]"></div>
                                  <span className="text-slate-400">YES</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-0.5 bg-white"></div>
                                  <span className="text-slate-400">NO</span>
                                </div>
                              </div>
                            );
                          }
                        })()}
                      </div>
                      {loadingHistory ? (
                        <div className="h-48 flex items-center justify-center text-slate-400">
                          Loading chart...
                        </div>
                      ) : historicalData.length > 0 ? (
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart 
                              data={historicalData.slice(-30)} // Only show last 30 points for performance
                              margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                              syncId="tradePanelChart"
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                              <XAxis 
                                dataKey="date" 
                                tick={{ fill: '#64748b', fontSize: 10 }}
                                axisLine={{ stroke: '#1e293b' }}
                                interval="preserveStartEnd"
                                minTickGap={30}
                              />
                              <YAxis 
                                domain={[0, 100]}
                                tick={{ fill: '#64748b', fontSize: 10 }}
                                tickFormatter={(value) => `${value}%`}
                                width={40}
                              />
                              <Tooltip
                                wrapperStyle={{ zIndex: 1000 }}
                                contentStyle={{
                                  padding: 0,
                                  border: 'none',
                                  background: 'transparent',
                                }}
                                content={({ active, payload, label }) => {
                                  if (!active || !payload || !payload.length) return null;
                                  
                                  return (
                                    <div className="bg-slate-950/50 backdrop-blur-md border border-white/5 rounded-lg p-3 shadow-lg max-w-xs">
                                      <p className="text-sm font-medium text-slate-300 mb-2 border-b border-white/5 pb-2 sticky top-0 bg-slate-950/50 backdrop-blur-md">
                                        {label}
                                      </p>
                                      <div className="max-h-64 overflow-y-auto pr-2 space-y-1 custom-scrollbar">
                                        {payload.map((entry: any, index: number) => (
                                          <div key={index} className="flex items-center justify-between text-xs py-0.5">
                                            <span style={{ color: entry.color }} className="font-medium">
                                              {entry.name}:
                                            </span>
                                            <span className="text-slate-300 mono-number percentage ml-2">
                                              {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}%
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                }}
                                animationDuration={0}
                              />
                              {(() => {
                                const outcomes = selectedMarket.outcomes || [];
                                const hasMultipleOutcomes = outcomes.length > 2 || (outcomes.length === 2 && !outcomes.some(o => o.name.toUpperCase() === 'YES' || o.name.toUpperCase() === 'NO'));
                                const colors = ['#4FFFC8', '#ffffff', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#10b981'];
                                
                                if (hasMultipleOutcomes && outcomes.length > 0) {
                                  // Render a Line for each outcome
                                  return outcomes.map((outcome, idx) => {
                                    const color = colors[idx % colors.length];
                                    const key = outcome.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() || `outcome_${idx}`;
                                    return (
                                      <Line
                                        key={outcome.id || idx}
                                        type="monotone"
                                        dataKey={key}
                                        stroke={color}
                                        strokeWidth={1.5}
                                        dot={false}
                                        activeDot={false}
                                        name={outcome.name}
                                        isAnimationActive={false}
                                        animationDuration={0}
                                        connectNulls={true}
                                      />
                                    );
                                  });
                                } else {
                                  // Binary market: YES/NO
                                  return (
                                    <>
                                      <Line
                                        type="monotone"
                                        dataKey="yes"
                                        stroke="#4FFFC8"
                                        strokeWidth={1.5}
                                        dot={false}
                                        activeDot={false}
                                        name="YES"
                                        isAnimationActive={false}
                                        animationDuration={0}
                                        connectNulls={true}
                                      />
                                      <Line
                                        type="monotone"
                                        dataKey="no"
                                        stroke="#ffffff"
                                        strokeWidth={1.5}
                                        dot={false}
                                        activeDot={false}
                                        name="NO"
                                        isAnimationActive={false}
                                        animationDuration={0}
                                        connectNulls={true}
                                      />
                                    </>
                                  );
                                }
                              })()}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-48 flex items-center justify-center text-slate-500">
                          <p className="text-sm">No chart data</p>
                        </div>
                      )}
                    </div>

                    {/* Quantity and Trade */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">
                          Amount
                        </label>
                        <input
                          type="number"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          min="1"
                          step="1"
                          className="w-full px-4 py-3 bg-slate-950/50 backdrop-blur-md border border-white/5 rounded-lg text-white mono-number text-lg focus:outline-none focus:border-[#4FFFC8]"
                          placeholder="0"
                        />
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => setQuantity('1')} className="px-3 py-1 text-xs bg-slate-800 rounded">+$1</button>
                          <button onClick={() => setQuantity('20')} className="px-3 py-1 text-xs bg-slate-800 rounded">+$20</button>
                          <button onClick={() => setQuantity('100')} className="px-3 py-1 text-xs bg-slate-800 rounded">+$100</button>
                          <button onClick={() => setQuantity('1000')} className="px-3 py-1 text-xs bg-slate-800 rounded">Max</button>
                        </div>
                      </div>
                      
                      <div className="p-4 bg-slate-950/50 backdrop-blur-md border border-white/5 rounded-lg space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">You'll receive</span>
                          <span className="mono-number font-semibold text-white">
                            ${cost.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">Price per Share</span>
                          <span className="mono-number font-bold text-[#4FFFC8]">
                            ${currentPrice.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      
                      <motion.button
                        onClick={handleTrade}
                        disabled={!user || Number(quantity) <= 0 || !selectedOutcome || tradeStatus === 'processing'}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`btn-premium ${tradeType === 'buy' && tradeStatus === 'idle' ? 'shimmer' : ''} w-full p-4 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                          tradeStatus === 'success'
                            ? 'bg-green-600 text-white'
                            : tradeStatus === 'error'
                            ? 'bg-red-600 text-white'
                            : tradeStatus === 'processing'
                            ? 'bg-yellow-600 text-white animate-pulse'
                            : tradeType === 'sell'
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'bg-[#4FFFC8] hover:bg-[#3debb8] text-[#050505]'
                        }`}
                      >
                        {tradeStatus === 'processing' ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Processing...</span>
                          </>
                        ) : tradeStatus === 'success' ? (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Success!</span>
                          </>
                        ) : tradeStatus === 'error' ? (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            <span>Error</span>
                          </>
                        ) : (
                          <span>{tradeType === 'sell' ? 'Sell' : 'Buy'}</span>
                        )}
                      </motion.button>
                    </div>
                  </div>
                )}

                {!user && (
                  <p className="text-center text-sm text-slate-500 mt-4">
                    Please sign in to place trades
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
