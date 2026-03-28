'use client';

import { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Market } from '@/lib/types';
import { useAuth } from './AuthProvider';
import dynamic from 'next/dynamic';
import { toast } from 'react-hot-toast';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, VersionedTransaction, clusterApiUrl } from '@solana/web3.js';
import { Buffer } from 'buffer';

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
  parlayMode?: boolean;
  onAddToParlay?: (market: Market, side: 'yes' | 'no', outcomeName?: string, outcomePrice?: number) => void;
}

export default function TradePanel({ market, eventMarkets, eventTitle, isOpen, onClose, onTrade, parlayMode, onAddToParlay }: TradePanelProps) {
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
  // Stop-loss is not supported in Jupiter execution mode.
  const { user } = useAuth();
  const { publicKey, connected, signTransaction } = useWallet();
  const dataInitializedRef = useRef(false); // Track if initial data has been loaded
  const lastUpdateTimeRef = useRef<number>(0); // Track last update timestamp

  const rpcUrl = useMemo(() => process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl('mainnet-beta'), []);
  const connection = useMemo(() => new Connection(rpcUrl, { commitment: 'confirmed' }), [rpcUrl]);

  const JUPUSD_MINT = 'JuprjznTrTSp2UFa3ZBUFgwdAmtZCq4MQCwysN55USD';
  const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  const [depositMint, setDepositMint] = useState<'JUPUSD' | 'USDC'>('USDC');

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
        const wallet = user?.address;
        if (!wallet) {
          setUserPositions([]);
          return;
        }
        const res = await fetch(`/api/positions?wallet=${encodeURIComponent(wallet)}&marketId=${selectedMarket.id || selectedMarket.conditionId}`);
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
      const wallet = user?.address;
      if (!wallet) {
        setTradeStatus('error');
        toast.error('Wallet not connected — please connect your wallet');
        return;
      }

      await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet }),
      }).catch(() => {});

      // Use the tradeSide state (set when clicking Buy Yes/No buttons)
      // This ensures "Buy No" on a candidate trades "No" on that candidate, not a generic "No" outcome
      const side = tradeSide;

      // REAL EXECUTION (Jupiter Prediction): buy only for now
      if (!connected || !publicKey) {
        setTradeStatus('error');
        toast.error('Wallet not connected (Phantom/Solflare)');
        setTimeout(() => setTradeStatus('idle'), 2000);
        return;
      }
      if (typeof signTransaction !== 'function') {
        setTradeStatus('error');
        toast.error('Wallet cannot sign transactions');
        setTimeout(() => setTradeStatus('idle'), 2000);
        return;
      }
      if (tradeType !== 'buy') {
        setTradeStatus('idle');
        toast('Close-outs are managed from the Positions tab.', {
          icon: '📊',
        });
        // Ask terminal to switch to Positions view
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('open-positions-tab'));
        }
        onClose();
        return;
      }

      const jupMarketId =
        (selectedMarket as any)?.jupMarketId ||
        selectedMarket.slug ||
        selectedMarket.conditionId ||
        selectedMarket.id;
      if (!jupMarketId) {
        setTradeStatus('error');
        toast.error('This market is missing a Jupiter market id');
        setTimeout(() => setTradeStatus('idle'), 2000);
        return;
      }

      // depositAmount is in micro USD units (1e6 = $1.00)
      const depositAmountMicro = Math.max(1, Math.ceil(cost * 1_000_000));
      const mint = depositMint === 'JUPUSD' ? JUPUSD_MINT : USDC_MINT;

      const orderResp = await fetch('/api/jup/prediction/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerPubkey: publicKey.toBase58(),
          depositAmount: String(depositAmountMicro),
          depositMint: mint,
          marketId: String(jupMarketId),
          isYes: side === 'yes',
          isBuy: true,
        }),
      }).then((r) => r.json());

      if (orderResp?.error) {
        setTradeStatus('error');
        toast.error(orderResp.error);
        setTimeout(() => setTradeStatus('idle'), 2000);
        return;
      }

      const txB64: string | undefined = orderResp?.transaction;
      if (!txB64) {
        setTradeStatus('error');
        toast.error('Jupiter did not return a transaction');
        setTimeout(() => setTradeStatus('idle'), 2000);
        return;
      }

      const tx = VersionedTransaction.deserialize(Buffer.from(txB64, 'base64'));
      const signed = await signTransaction(tx);

      const latest = await connection.getLatestBlockhash({ commitment: 'confirmed' });
      const sig = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: true,
        maxRetries: 2,
      });

      await connection.confirmTransaction(
        { signature: sig, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
        'confirmed'
      );

      setTradeStatus('success');
      toast.success(`Order sent: ${sig.slice(0, 4)}…${sig.slice(-4)}`);
      if (selectedMarket) {
        try {
          onTrade(selectedMarket, tradeSide, Number(quantity) || 0);
        } catch {
          /* parent hook optional */
        }
      }
      setTimeout(() => setTradeStatus('idle'), 2000);
      return;
    } catch (error: any) {
      setTradeStatus('error');
      console.error('Jupiter trade failed:', error);
      toast.error(error?.message || 'Failed to execute Jupiter trade');
      setTimeout(() => setTradeStatus('idle'), 2000);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[59]"
          />

          {/* Panel — bottom-sheet on mobile, centered dialog on md+ */}
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-[60] md:inset-0 md:flex md:items-center md:justify-center md:p-4"
            style={{ top: 0 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) onClose();
            }}
          >
            <div
              className="w-full h-[92dvh] md:h-auto md:max-w-4xl bg-[#0c0c14] md:bg-slate-950/50 backdrop-blur-md border border-white/5 rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden md:max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {/* ── Sticky mobile close header ── */}
              <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-[#0c0c14]/95 backdrop-blur-md">
                {/* Drag handle pill */}
                <div className="md:hidden absolute left-1/2 -translate-x-1/2 top-1.5 w-10 h-1 rounded-full bg-white/20" />
                <span className="text-sm font-bold text-white truncate max-w-[calc(100%-48px)]">{displayTitle}</span>
                <button
                  onClick={onClose}
                  className="flex-shrink-0 p-2 -mr-1 rounded-xl hover:bg-white/10 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-slate-400" strokeWidth={1.5} />
                </button>
              </div>

              {/* ── Scrollable body ── */}
              <div className="flex-1 overflow-y-auto">

              {/* Market Banner Image at the top */}
              {selectedMarket.imageUrl && (
                <div className="relative w-full h-36 md:h-48 bg-slate-900/50 overflow-hidden flex-shrink-0">
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

              <div className="p-4 md:p-8">
                {/* Event Title and Market Selection */}
                <div className="mb-6 md:mb-8">
                  <h2 className="hidden md:block text-3xl font-bold text-white mb-4 leading-tight">
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
                  
                  <div className="flex flex-wrap items-center gap-3 md:gap-6">
                    <div>
                      <span className="text-sm text-slate-400">Volume: </span>
                      <span className="text-base md:text-lg mono-number volume font-bold text-[#4FFFC8]">
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
                                {/* Binary Market — stacked on mobile */}
                                <div className="p-3 md:p-4 rounded-lg border-2 border-white/5 bg-slate-950/50 backdrop-blur-md">
                                  {/* Name row */}
                                  <div className="flex items-center gap-2 mb-3">
                                    <div className="text-sm md:text-base font-medium text-white truncate">
                                      {mkt.name?.includes(' - ') ? mkt.name.split(' - ')[0] : displayTitle}
                                    </div>
                                    <div className="text-[10px] md:text-xs text-slate-500 font-mono flex-shrink-0">
                                      {mkt.volumeFormatted || '$0'} Vol.
                                    </div>
                                  </div>
                                  {/* Buttons row — always fits */}
                                  <div className="grid grid-cols-2 gap-2">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        if (parlayMode && onAddToParlay) {
                                          onAddToParlay(mkt, 'yes', undefined, yesPrice);
                                        } else {
                                          setSelectedMarket(mkt);
                                          setSelectedOutcome(yesOutcome?.id || null);
                                        }
                                      }}
                                      className={`flex flex-col items-center gap-0.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                        parlayMode
                                          ? 'bg-violet-600/20 text-violet-300 border border-violet-500/40 hover:bg-violet-500/30'
                                          : yesSelected
                                            ? 'bg-[#4FFFC8] text-[#050505]'
                                            : 'bg-green-600/20 text-green-400 border border-green-600/30 hover:bg-green-600/30'
                                      }`}
                                    >
                                      <span className="text-xs font-bold">{parlayMode ? '+ Add YES' : 'Buy Yes'}</span>
                                      <span className="mono-number text-[11px] opacity-80">${yesPrice.toFixed(2)} · {(yesPrice * 100).toFixed(1)}%</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        if (parlayMode && onAddToParlay) {
                                          onAddToParlay(mkt, 'no', undefined, noPrice);
                                        } else {
                                          setSelectedMarket(mkt);
                                          setSelectedOutcome(noOutcome?.id || null);
                                        }
                                      }}
                                      className={`flex flex-col items-center gap-0.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                        parlayMode
                                          ? 'bg-violet-600/20 text-violet-300 border border-violet-500/40 hover:bg-violet-500/30'
                                          : noSelected
                                            ? 'bg-[#4FFFC8] text-[#050505]'
                                            : 'bg-red-600/20 text-red-400 border border-red-600/30 hover:bg-red-600/30'
                                      }`}
                                    >
                                      <span className="text-xs font-bold">{parlayMode ? '+ Add NO' : 'Buy No'}</span>
                                      <span className="mono-number text-[11px] opacity-80">${noPrice.toFixed(2)} · {(noPrice * 100).toFixed(1)}%</span>
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
                                  
                                  const isOutcomeSettled = !!(outcome as any).settled;
                                  const settledResultText = (outcome as any).settledResult === 'yes' ? 'Yes' : (outcome as any).settledResult === 'no' ? 'No' : '';

                                  return (
                                    <div
                                      key={outcome.id}
                                      onClick={(e) => {
                                        if (isOutcomeSettled) return;
                                        const target = e.target as HTMLElement;
                                        const isButton = target.tagName === 'BUTTON' || 
                                                        target.closest('button') !== null;
                                        if (!isButton) {
                                          setSelectedMarket(mkt);
                                          setSelectedOutcome(outcome.id);
                                          setTradeSide('yes');
                                        }
                                      }}
                                      className={`p-3 md:p-4 rounded-lg border-2 transition-all ${
                                        isOutcomeSettled
                                          ? 'border-white/5 bg-slate-900/30 opacity-50 cursor-default'
                                          : isSelected
                                            ? 'border-[#4FFFC8] bg-[#4FFFC8]/10 cursor-pointer'
                                            : 'border-white/5 bg-slate-950/50 backdrop-blur-md hover:border-white/10 cursor-pointer'
                                      }`}
                                    >
                                      {/* Top: Name + Price */}
                                      <div className="flex items-center justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                          <div className={`text-sm md:text-base font-medium truncate ${isOutcomeSettled ? 'text-slate-500' : 'text-white'}`}>
                                            {outcome.name}
                                          </div>
                                          {isOutcomeSettled && (
                                            <span className={`flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-bold border ${
                                              settledResultText === 'Yes'
                                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                                            }`}>
                                              Settled: {settledResultText}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex-shrink-0 text-right">
                                          <span className={`text-sm md:text-lg mono-number font-bold ${isOutcomeSettled ? 'text-slate-600' : isSelected ? 'text-[#4FFFC8]' : 'text-white'}`}>
                                            ${outcomePrice.toFixed(2)}
                                          </span>
                                          <span className="ml-1 text-[10px] md:text-xs text-slate-500 mono-number">
                                            {probability.toFixed(1)}%
                                          </span>
                                        </div>
                                      </div>
                                      
                                      {/* Bottom: Buttons — always visible */}
                                      {isOutcomeSettled ? (
                                        <div className="text-center text-[10px] text-slate-600 font-bold uppercase tracking-wider py-1">Closed</div>
                                      ) : (
                                        <div className="grid grid-cols-2 gap-2 relative z-10" onClick={(e) => e.stopPropagation()}>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              e.preventDefault();
                                              if (parlayMode && onAddToParlay) {
                                                onAddToParlay(mkt, 'yes', outcome.name, outcomePrice);
                                              } else {
                                                setSelectedMarket(mkt);
                                                setSelectedOutcome(outcome.id);
                                                setTradeSide('yes');
                                              }
                                            }}
                                            className={`py-2 rounded-lg text-xs md:text-sm font-medium transition-all ${
                                              parlayMode
                                                ? 'bg-violet-600/20 text-violet-300 border border-violet-500/40 hover:bg-violet-500/30'
                                                : isSelected && tradeSide === 'yes'
                                                  ? 'bg-[#4FFFC8] text-[#050505]'
                                                  : 'bg-green-600/20 text-green-400 border border-green-600/30 hover:bg-green-600/30'
                                            }`}
                                          >
                                            {parlayMode ? '+ Add YES' : `Buy Yes ${outcomePrice.toFixed(2)}¢`}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              e.preventDefault();
                                              if (parlayMode && onAddToParlay) {
                                                onAddToParlay(mkt, 'no', outcome.name, noPrice);
                                              } else {
                                                setSelectedMarket(mkt);
                                                setSelectedOutcome(outcome.id);
                                                setTradeSide('no');
                                              }
                                            }}
                                            className={`py-2 rounded-lg text-xs md:text-sm font-medium transition-all ${
                                              parlayMode
                                                ? 'bg-violet-600/20 text-violet-300 border border-violet-500/40 hover:bg-violet-500/30'
                                                : isSelected && tradeSide === 'no'
                                                  ? 'bg-[#4FFFC8] text-[#050505]'
                                                  : 'bg-red-600/20 text-red-400 border border-red-600/30 hover:bg-red-600/30'
                                            }`}
                                          >
                                            {parlayMode ? '+ Add NO' : `Buy No ${noPrice.toFixed(2)}¢`}
                                          </button>
                                        </div>
                                      )}
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

                    {/* Execution (Jupiter Prediction) */}
                    <div className="mb-4 p-3 bg-slate-950/50 backdrop-blur-md border border-white/5 rounded-lg">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-500 font-semibold">
                          Execution
                        </div>
                        <span className="text-[10px] uppercase tracking-[0.16em] text-[#4FFFC8] font-semibold border border-[#4FFFC8]/30 bg-[#4FFFC8]/10 px-2 py-0.5 rounded-full">
                          Real (Jupiter)
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                        <div className="text-xs text-slate-500">
                          Requires wallet signature (Phantom/Solflare). Buy orders here; sell/claim in Positions.
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500 font-semibold">
                            Deposit
                          </span>
                          <select
                            value={depositMint}
                            onChange={(e) => setDepositMint(e.target.value as any)}
                            className="h-8 px-3 rounded-full bg-black/40 border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-[#4FFFC8]/40"
                          >
                            <option value="USDC">USDC</option>
                            <option value="JUPUSD">JupUSD</option>
                          </select>
                        </div>
                      </div>
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

                      {/* Stop loss removed for Jupiter execution */}

                      {parlayMode ? (
                        <div className="w-full p-4 rounded-lg border border-violet-500/30 bg-violet-500/10 text-center">
                          <p className="text-violet-300 text-sm font-medium">Multi-Bet Mode Active</p>
                          <p className="text-slate-500 text-xs mt-0.5">Click &quot;+ Add YES&quot; or &quot;+ Add NO&quot; above to add a leg to your slip</p>
                        </div>
                      ) : (
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
                      )}
                    </div>
                  </div>
                )}

                {!user && (
                  <p className="text-center text-sm text-slate-500 mt-4">
                    Please sign in to place trades
                  </p>
                )}
              </div>
              </div>{/* end scrollable body */}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
