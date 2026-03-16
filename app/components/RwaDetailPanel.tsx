'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, BarChart3, TrendingUp } from 'lucide-react';
import type { JupStockDetail } from '@/lib/jup-stocks';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, VersionedTransaction, clusterApiUrl } from '@solana/web3.js';
import { Buffer } from 'buffer';
import StockCandleChart from './StockCandleChart';
import StockTradesTable from './StockTradesTable';
import InAppWebModal from './InAppWebModal';

const formatUSD = (v: number | undefined) =>
  v == null ? '—' : v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(2)}K` : `$${v.toFixed(2)}`;
const formatPct = (v: number | undefined) =>
  v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

type TradeAsset = 'USDC' | 'SOL';

interface RwaDetailPanelProps {
  stock: JupStockDetail;
  onClose: () => void;
}

export default function RwaDetailPanel({ stock, onClose }: RwaDetailPanelProps) {
  const { publicKey, connected, signTransaction } = useWallet();

  const s = stock.stats;
  const priceUp = (s?.priceChange24h ?? 0) >= 0;

  const rpcUrl = useMemo(
    () => process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl('mainnet-beta'),
    []
  );
  const connection = useMemo(
    () => new Connection(rpcUrl, { commitment: 'confirmed' }),
    [rpcUrl]
  );

  const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  const SOL_MINT = 'So11111111111111111111111111111111111111112';
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [quoteAsset, setQuoteAsset] = useState<TradeAsset>('USDC');
  const [amount, setAmount] = useState('0');
  const [busy, setBusy] = useState(false);
  const [lastSig, setLastSig] = useState<string | null>(null);
  const [expectedReceive, setExpectedReceive] = useState<string>('');
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [assetMenuOpen, setAssetMenuOpen] = useState(false);
  const [balances, setBalances] = useState<Record<TradeAsset | 'STOCK', number>>({
    USDC: 0,
    SOL: 0,
    STOCK: 0,
  });
  const [tokenDecimals, setTokenDecimals] = useState<number | null>(null);
  const [usdPrices, setUsdPrices] = useState<{ SOL: number | null; USDC: number | null }>({
    SOL: null,
    USDC: 1,
  });

  const [profile, setProfile] = useState<{
    description: string | null;
    websites: string[];
    socials: { twitter: string | null; discord: string | null; telegram: string | null };
  } | null>(null);
  const [webView, setWebView] = useState<{ title: string; url: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!stock.mint) return;
      try {
        const res = await fetch(
          `/api/stocks/profile?mint=${encodeURIComponent(stock.mint)}&symbol=${encodeURIComponent(stock.symbol)}`,
          { cache: 'no-store' }
        );
        const json = await res.json();
        if (!res.ok) return;
        if (!cancelled) {
          setProfile({
            description: json?.description ?? null,
            websites: Array.isArray(json?.websites) ? json.websites : [],
            socials: {
              twitter: json?.socials?.twitter ?? null,
              discord: json?.socials?.discord ?? null,
              telegram: json?.socials?.telegram ?? null,
            },
          });
        }
      } catch {}
    };
    setProfile(null);
    run();
    return () => {
      cancelled = true;
    };
  }, [stock.mint, stock.symbol]);

  useEffect(() => {
    let cancelled = false;

    const loadDecimals = async () => {
      if (!stock.mint) return;
      try {
        const res = await fetch(
          `/api/dflow/token-decimals?mint=${encodeURIComponent(stock.mint)}`,
          { cache: 'no-store' },
        );
        const json = await res.json();
        if (!res.ok || cancelled) return;
        const decs = json?.decimals;
        if (typeof decs === 'number' && Number.isFinite(decs)) {
          setTokenDecimals(decs);
        }
      } catch {
        // keep null; server-side Dflow calls will still use correct decimals
      }
    };

    setTokenDecimals(null);
    loadDecimals();

    return () => {
      cancelled = true;
    };
  }, [stock.mint]);

  useEffect(() => {
    let cancelled = false;

    const loadCorePrices = async () => {
      try {
        const res = await fetch('/api/prices/core', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok || cancelled) return;
        setUsdPrices({
          SOL: typeof json.sol === 'number' ? json.sol : null,
          USDC: typeof json.usdc === 'number' ? json.usdc : 1,
        });
      } catch {
        if (!cancelled) {
          setUsdPrices((prev) => prev);
        }
      }
    };

    loadCorePrices();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!publicKey) {
      setBalances({ USDC: 0, SOL: 0, STOCK: 0 });
      return;
    }

    let cancelled = false;

    const loadBalances = async () => {
      try {
        const [solLamports, usdcAccounts, stockAccounts] = await Promise.all([
          connection.getBalance(publicKey),
          stock.mint
            ? connection.getParsedTokenAccountsByOwner(publicKey, {
                mint: new PublicKey(USDC_MINT),
              })
            : Promise.resolve({ value: [] }),
          stock.mint
            ? connection.getParsedTokenAccountsByOwner(publicKey, {
                mint: new PublicKey(stock.mint),
              })
            : Promise.resolve({ value: [] }),
        ]);

        if (cancelled) return;

        const sol = solLamports / 10 ** 9;

        const sumParsed = (accounts: any[], defaultDecimals: number) =>
          accounts.reduce((acc, accInfo) => {
            const parsed = accInfo?.account?.data?.parsed;
            const amountInfo = parsed?.info?.tokenAmount;
            const ui = typeof amountInfo?.uiAmount === 'number' ? amountInfo.uiAmount : undefined;
            if (ui != null && Number.isFinite(ui)) {
              return acc + ui;
            }
            const raw = amountInfo?.amount ? Number(amountInfo.amount) : NaN;
            const decs =
              typeof amountInfo?.decimals === 'number'
                ? amountInfo.decimals
                : defaultDecimals;
            if (Number.isFinite(raw) && Number.isFinite(decs)) {
              return acc + raw / 10 ** decs;
            }
            return acc;
          }, 0);

        const usdc = sumParsed((usdcAccounts as any).value ?? [], 6);
        const stockDecs = stock.decimals ?? 6;
        const stockBal = sumParsed((stockAccounts as any).value ?? [], stockDecs);

        setBalances({
          USDC: usdc,
          SOL: sol,
          STOCK: stockBal,
        });
      } catch {
        if (!cancelled) {
          setBalances((prev) => prev);
        }
      }
    };

    loadBalances();

    return () => {
      cancelled = true;
    };
  }, [publicKey, connection, stock.mint, stock.decimals, USDC_MINT]);

  const doSwap = async () => {
    if (!connected || !publicKey) return;
    if (!signTransaction) throw new Error('Wallet does not support signing');
    if (!stock.mint) throw new Error('Missing stock mint');

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) throw new Error('Enter an amount');

    setBusy(true);
    setLastSig(null);
    try {
      const quoteMint = quoteAsset === 'USDC' ? USDC_MINT : SOL_MINT;

      let inputMint: string;
      let outputMint: string;

      if (side === 'buy') {
        // Spend quote asset, receive stock
        inputMint = quoteMint;
        outputMint = stock.mint;
      } else {
        // Spend stock, receive quote asset
        inputMint = stock.mint;
        outputMint = quoteMint;
      }

      const orderRes = await fetch('/api/dflow/order', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          inputMint,
          outputMint,
          uiAmount: amt,
          slippageBps: 50,
          userPublicKey: publicKey.toBase58(),
        }),
      });
      const orderJson = await orderRes.json();
      if (!orderRes.ok) {
        throw new Error(orderJson?.error || 'Order failed');
      }

      const txB64 = orderJson?.transaction;
      if (!txB64 || typeof txB64 !== 'string') {
        throw new Error('No transaction returned from Dflow');
      }

      const tx = VersionedTransaction.deserialize(Buffer.from(txB64, 'base64'));
      try {
        const signed = await signTransaction(tx);
        const sig = await connection.sendRawTransaction(signed.serialize(), {
          skipPreflight: false,
          maxRetries: 3,
        });
        setLastSig(sig);
        await connection.confirmTransaction(sig, 'confirmed');
        // Emit a terminal RWA trade event so the Terminal Live Ticker
        // can display this stock trade alongside prediction markets.
        try {
          const rawOut = orderJson?.outAmount;
          const outAmountNum =
            typeof rawOut === 'string'
              ? Number(rawOut)
              : typeof rawOut === 'number'
              ? rawOut
              : NaN;
          const outDecimals =
            typeof orderJson?.outDecimals === 'number'
              ? orderJson.outDecimals
              : tokenDecimals ?? 6;
          const stockUnits =
            side === 'buy'
              ? (Number.isFinite(outAmountNum) && outAmountNum > 0
                  ? outAmountNum / 10 ** outDecimals
                  : amt)
              : amt;
          const notionalUsd =
            quoteAsset === 'USDC'
              ? amt * (usdPrices.USDC ?? 1)
              : amt * (usdPrices.SOL ?? 0);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('rwa-trade-executed', {
                detail: {
                  symbol: stock.symbol,
                  name: stock.name,
                  mint: stock.mint,
                  side,
                  quoteAsset,
                  uiAmount: amt,
                  stockUnits,
                  notionalUsd,
                  price: stock.price ?? stock.markPrice ?? null,
                  walletAddress: publicKey.toBase58(),
                  externalUrl: `${window.location.origin}/stocks`,
                  imageUrl: stock.icon ?? null,
                },
              }),
            );
          }
        } catch {
          // best-effort only; trade execution already succeeded
        }
      } catch (err: any) {
        const msg = String(err?.message || '');
        const name = String(err?.name || '');
        // Treat explicit user rejection as a non-error.
        if (
          msg.toLowerCase().includes('user rejected') ||
          name.includes('UserRejected') ||
          name.includes('WalletSignTransactionError')
        ) {
          return;
        }
        throw err;
      }
      setExpectedReceive('');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const fetchPreview = async () => {
      if (!connected || !publicKey || !stock.mint) {
        setExpectedReceive('');
        setQuoteError(null);
        return;
      }

      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) {
        setExpectedReceive('');
        setQuoteError(null);
        return;
      }

      try {
        setQuoteError(null);
        const quoteMint = quoteAsset === 'USDC' ? USDC_MINT : SOL_MINT;

        let inputMint: string;
        let outputMint: string;

        if (side === 'buy') {
          inputMint = quoteMint;
          outputMint = stock.mint;
        } else {
          inputMint = stock.mint;
          outputMint = quoteMint;
        }

        const params = new URLSearchParams({
          inputMint,
          outputMint,
          uiAmount: String(amt),
          slippageBps: '50',
        });

        const res = await fetch(`/api/dflow/quote?${params.toString()}`, {
          cache: 'no-store',
        });
        const json = await res.json();
        if (!res.ok || cancelled) {
          if (!cancelled) setExpectedReceive('');
          const raw = json?.error || 'Quote failed';
          const clean = String(raw).replace(/<[^>]+>/g, '').slice(0, 140);
          if (!cancelled) setQuoteError(clean);
          return;
        }

        const rawOut = json?.outAmount;
        const outAmountNum =
          typeof rawOut === 'string'
            ? Number(rawOut)
            : typeof rawOut === 'number'
            ? rawOut
            : NaN;

        if (!Number.isFinite(outAmountNum) || outAmountNum <= 0) {
          setExpectedReceive('');
          setQuoteError('No route / no liquidity');
          return;
        }

        const apiOutDecimals = json?.outDecimals;
        const fallbackOutDecimals =
          side === 'buy'
            ? tokenDecimals ?? 6
            : quoteAsset === 'USDC'
            ? 6
            : 9;
        const outDecimals =
          typeof apiOutDecimals === 'number'
            ? apiOutDecimals
            : fallbackOutDecimals;

        const uiAmount = outAmountNum / 10 ** outDecimals;
        setExpectedReceive(
          uiAmount.toLocaleString(undefined, {
            maximumFractionDigits: 6,
          })
        );
      } catch {
        if (!cancelled) {
          setExpectedReceive('');
          setQuoteError('Quote failed');
        }
      }
    };

    const id = setTimeout(fetchPreview, 400);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [amount, side, quoteAsset, stock.mint, stock.decimals, tokenDecimals, connected, publicKey, USDC_MINT, SOL_MINT]);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/80 backdrop-blur-sm">
      <AnimatePresence>
        {webView ? (
          <InAppWebModal
            title={webView.title}
            url={webView.url}
            onClose={() => setWebView(null)}
          />
        ) : null}
      </AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col w-full max-w-6xl m-4 rounded-2xl border border-[#1A1A1A] bg-[#050505] overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1A1A1A] bg-[#0a0a0a]">
          <div className="flex items-center gap-4">
            {stock.icon ? (
              <img src={stock.icon} alt="" className="w-10 h-10 rounded-full bg-white/5" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#4FFFC8]/20 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-[#4FFFC8]" />
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold text-white">{stock.symbol}</h1>
              <p className="text-xs text-slate-500">{stock.name}</p>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <span className="text-xl font-mono font-bold text-white">
                {stock.price ? `$${stock.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
              </span>
              <span className={`text-sm font-mono ${priceUp ? 'text-[#4FFFC8]' : 'text-red-400'}`}>
                {formatPct(stock.stats?.priceChange24h)}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left: Stats + About + Links */}
          <div className="w-72 flex-shrink-0 border-r border-[#1A1A1A] overflow-y-auto p-4 space-y-6">
            <div className="space-y-3">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Key metrics</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">Mark price</span>
                  <p className="font-mono text-white">{stock.markPrice != null ? `$${stock.markPrice.toFixed(2)}` : '—'}</p>
                </div>
                <div>
                  <span className="text-slate-500">Discount</span>
                  <p className={`font-mono ${(stock.discount ?? 0) < 0 ? 'text-[#4FFFC8]' : 'text-white'}`}>
                    {stock.discount != null ? `${stock.discount.toFixed(2)}%` : '—'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">MC</span>
                  <p className="font-mono text-white">{formatUSD(stock.mc ?? stock.stats?.mcap)}</p>
                </div>
                <div>
                  <span className="text-slate-500">Liquidity</span>
                  <p className="font-mono text-white">{formatUSD(s?.liquidity)}</p>
                </div>
                <div>
                  <span className="text-slate-500">Holders</span>
                  <p className="font-mono text-white">{s?.holders != null ? s.holders.toLocaleString() : '—'}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Changes</h3>
              <div className="flex gap-4 text-xs">
                <span className={s?.priceChange5m != null ? (s.priceChange5m >= 0 ? 'text-[#4FFFC8]' : 'text-red-400') : 'text-slate-500'}>
                  5m {formatPct(s?.priceChange5m)}
                </span>
                <span className={s?.priceChange1h != null ? (s.priceChange1h >= 0 ? 'text-[#4FFFC8]' : 'text-red-400') : 'text-slate-500'}>
                  1h {formatPct(s?.priceChange1h)}
                </span>
                <span className={s?.priceChange6h != null ? (s.priceChange6h >= 0 ? 'text-[#4FFFC8]' : 'text-red-400') : 'text-slate-500'}>
                  6h {formatPct(s?.priceChange6h)}
                </span>
                <span className={s?.priceChange24h != null ? (s.priceChange24h >= 0 ? 'text-[#4FFFC8]' : 'text-red-400') : 'text-slate-500'}>
                  24h {formatPct(s?.priceChange24h)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">24h stats</h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">24h Vol</span>
                  <span className="font-mono text-white">{formatUSD(s?.volume24h)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Net Vol</span>
                  <span className="font-mono text-white">{formatUSD(s?.netVol24h)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Traders</span>
                  <span className="font-mono text-white">{s?.traders24h ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Net buyers</span>
                  <span className="font-mono text-white">{s?.netBuyers24h ?? '—'}</span>
                </div>
              </div>
            </div>

            {(profile?.description || stock.description || stock.name) && (
              <div className="space-y-2">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  About {stock.symbol}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {profile?.description || stock.description || `${stock.name} — tokenized on Solana.`}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Links</h3>
              <div className="flex flex-wrap gap-2">
                {(profile?.websites || []).slice(0, 4).map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-[#1A1A1A] text-slate-300 text-xs font-medium hover:border-[#4FFFC8]/30 hover:text-white transition-colors"
                    title={url}
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                    Website
                  </a>
                ))}
                {profile?.socials?.twitter ? (
                  <a
                    href={`https://x.com/${String(profile.socials.twitter).replace(/^@/, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-[#1A1A1A] text-slate-300 text-xs font-medium hover:border-[#4FFFC8]/30 hover:text-white transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                    X
                  </a>
                ) : null}
              </div>
            </div>
          </div>

          {/* Center: Chart + Transactions */}
          <div className="flex-1 flex flex-col min-w-0 p-4">
            <div className="flex-1 min-h-[200px] rounded-xl border border-[#1A1A1A] bg-black/30 overflow-hidden mb-4">
              {stock.mint ? (
                <StockCandleChart mint={stock.mint} tf="15m" height={260} />
              ) : (
                <div className="h-[260px] flex items-center justify-center text-xs text-slate-500">
                  Chart unavailable (missing mint)
                </div>
              )}
            </div>
            <div className="rounded-xl border border-[#1A1A1A] bg-white/[0.02] overflow-hidden">
              <div className="px-4 py-2 border-b border-[#1A1A1A] flex items-center gap-4">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Transactions</span>
                <span className="text-xs text-slate-500">Live (pool trades)</span>
              </div>
              {stock.mint ? (
                <StockTradesTable mint={stock.mint} symbol={stock.symbol} />
              ) : (
                <div className="p-6 text-center text-slate-500 text-sm">
                  <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Trades unavailable (missing mint).</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Trade + Token info */}
          <div className="w-80 flex-shrink-0 border-l border-[#1A1A1A] p-4 flex flex-col gap-6">
            <div className="rounded-xl border border-[#1A1A1A] bg-white/[0.02] p-4 space-y-4">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Trade</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSide('buy')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${
                    side === 'buy'
                      ? 'bg-[#4FFFC8]/20 text-[#4FFFC8] border-[#4FFFC8]/30'
                      : 'bg-white/[0.02] text-slate-500 border-[#1A1A1A] hover:text-white'
                  }`}
                >
                  Buy
                </button>
                <button
                  type="button"
                  onClick={() => setSide('sell')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${
                    side === 'sell'
                      ? 'bg-[#4FFFC8]/20 text-[#4FFFC8] border-[#4FFFC8]/30'
                      : 'bg-white/[0.02] text-slate-500 border-[#1A1A1A] hover:text-white'
                  }`}
                >
                  Sell
                </button>
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <label className="text-slate-500 block mb-1">
                    {side === 'buy' ? 'You pay' : `You sell (${stock.symbol})`}
                  </label>
                  <div className="relative mb-2">
                    <button
                      type="button"
                      onClick={() => setAssetMenuOpen((open) => !open)}
                      className="w-full flex items-center justify-between rounded-lg bg-white/[0.03] border border-[#1A1A1A] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:border-[#4FFFC8]/30"
                    >
                      <span>
                        {quoteAsset}{' '}
                        <span className="text-[10px] text-slate-500 normal-case font-normal">
                          · Bal{' '}
                          {balances[quoteAsset].toLocaleString(undefined, {
                            maximumFractionDigits: 4,
                          })}
                        </span>
                      </span>
                      <span className="text-xs text-slate-600">▼</span>
                    </button>
                    {assetMenuOpen ? (
                      <div className="absolute z-10 mt-1 w-full rounded-lg border border-[#1A1A1A] bg-[#050505] shadow-lg">
                        {(['USDC', 'SOL'] as TradeAsset[]).map((asset) => (
                          <button
                            key={asset}
                            type="button"
                            onClick={() => {
                              setQuoteAsset(asset);
                              setAssetMenuOpen(false);
                            }}
                            className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] text-slate-300 hover:bg-white/[0.04]"
                          >
                            <span className="font-medium">{asset}</span>
                            <span className="text-[10px] text-slate-500">
                              Bal{' '}
                              {balances[asset].toLocaleString(undefined, {
                                maximumFractionDigits: 4,
                              })}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] border border-[#1A1A1A] px-3 py-2">
                    <span className="text-white font-medium">
                      {side === 'buy' ? quoteAsset : stock.symbol}
                    </span>
                    <div className="flex-1 flex flex-col items-end">
                      <input
                        type="text"
                        placeholder="0"
                        className="w-full bg-transparent text-white font-mono text-right outline-none placeholder:text-slate-600"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                      <span className="mt-0.5 text-[10px] text-slate-500">
                        {(() => {
                          const amtNum = Number(amount);
                          if (!Number.isFinite(amtNum) || amtNum <= 0) return '$0.00';
                          const pricePerUnit =
                            side === 'buy'
                              ? quoteAsset === 'USDC'
                                ? usdPrices.USDC ?? 1
                                : usdPrices.SOL ?? null
                              : stock.price ?? stock.markPrice ?? null;
                          if (!pricePerUnit) return '$0.00';
                          const v = amtNum * pricePerUnit;
                          return `$${v.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                            minimumFractionDigits: 2,
                          })}`;
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-slate-500 block mb-1">Receive</label>
                  <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] border border-[#1A1A1A] px-3 py-2">
                    <span className="text-white font-medium">
                      {side === 'buy'
                        ? stock.symbol
                        : quoteAsset}
                    </span>
                    <div className="flex-1 flex flex-col items-end">
                      <input
                        type="text"
                        placeholder="0"
                        className="w-full bg-transparent text-white font-mono text-right outline-none placeholder:text-slate-600"
                        value={expectedReceive}
                        readOnly
                      />
                      <span className="mt-0.5 text-[10px] text-slate-500">
                        {(() => {
                          const recv = Number(expectedReceive.replace(/,/g, ''));
                          if (!Number.isFinite(recv) || recv <= 0) return '$0.00';
                          const outPricePerUnit =
                            side === 'buy'
                              ? stock.price ?? stock.markPrice ?? null
                              : quoteAsset === 'USDC'
                              ? usdPrices.USDC ?? 1
                              : usdPrices.SOL ?? null;
                          if (!outPricePerUnit) return '$0.00';
                          const v = recv * outPricePerUnit;
                          return `$${v.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                            minimumFractionDigits: 2,
                          })}`;
                        })()}
                      </span>
                    </div>
                  </div>
                  {quoteError ? (
                    <div className="mt-1 text-[10px] text-slate-500">
                      {quoteError}
                    </div>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                disabled={!connected || !publicKey || busy || !stock.mint}
                onClick={() => doSwap().catch(() => {})}
                className="block w-full py-2.5 rounded-lg bg-[#4FFFC8] disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold text-sm text-center hover:bg-[#3de6b3] transition-colors"
              >
                {!connected
                  ? 'Connect wallet to trade'
                  : busy
                  ? 'Building order…'
                  : side === 'buy'
                  ? 'Buy'
                  : 'Sell'}
              </button>
              {lastSig ? (
                <a
                  href={`https://solscan.io/tx/${lastSig}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#4FFFC8] hover:underline inline-flex items-center gap-1.5"
                >
                  View transaction <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : null}
            </div>

            <div className="rounded-xl border border-[#1A1A1A] bg-white/[0.02] p-4 space-y-3">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Token info</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Top 10 H.</span>
                  <span className="font-mono text-white">
                    {stock.tokenInfo?.top10HoldersPct != null ? `${stock.tokenInfo.top10HoldersPct.toFixed(2)}%` : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Freeze Auth</span>
                  <span className="font-mono text-white">
                    {stock.tokenInfo?.freezeAuthorityDisabled != null
                      ? stock.tokenInfo.freezeAuthorityDisabled ? 'No' : 'Yes'
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Mint Auth</span>
                  <span className="font-mono text-white">
                    {stock.tokenInfo?.mintAuthorityDisabled != null
                      ? stock.tokenInfo.mintAuthorityDisabled ? 'No' : 'Yes'
                      : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
