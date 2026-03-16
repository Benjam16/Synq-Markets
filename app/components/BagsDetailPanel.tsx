'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, VersionedTransaction, clusterApiUrl } from '@solana/web3.js';
import { Buffer } from 'buffer';
import bs58 from 'bs58';

type TradeAsset = 'USDC' | 'SOL';

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const SOL_MINT = 'So11111111111111111111111111111111111111112';

export default function BagsDetailPanel({
  mint,
  onClose,
}: {
  mint: string;
  onClose: () => void;
}) {
  const { publicKey, connected, signTransaction } = useWallet();

  const rpcUrl = useMemo(
    () => process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl('mainnet-beta'),
    [],
  );
  const connection = useMemo(() => new Connection(rpcUrl, { commitment: 'confirmed' }), [rpcUrl]);

  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [quoteAsset, setQuoteAsset] = useState<TradeAsset>('USDC');
  const [amount, setAmount] = useState('0');
  const [busy, setBusy] = useState(false);
  const [expectedReceive, setExpectedReceive] = useState('');
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [lastSig, setLastSig] = useState<string | null>(null);
  const [lastQuote, setLastQuote] = useState<any | null>(null);
  const [tokenInfo, setTokenInfo] = useState<{
    name?: string;
    symbol?: string;
    imageUrl?: string | null;
    priceUsd?: number | null;
    priceChange24h?: number | null;
  } | null>(null);

  const inputMint = useMemo(() => {
    const quoteMint = quoteAsset === 'USDC' ? USDC_MINT : SOL_MINT;
    return side === 'buy' ? quoteMint : mint;
  }, [quoteAsset, side, mint]);

  const outputMint = useMemo(() => {
    const quoteMint = quoteAsset === 'USDC' ? USDC_MINT : SOL_MINT;
    return side === 'buy' ? mint : quoteMint;
  }, [quoteAsset, side, mint]);

  // Lightweight token metadata / price for header
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch(`/api/stocks/profile?mint=${encodeURIComponent(mint)}`, {
          cache: 'no-store',
        });
        const json = await res.json();
        if (!res.ok || cancelled) return;
        setTokenInfo({
          name: json?.name ?? undefined,
          symbol: json?.symbol ?? undefined,
          imageUrl: json?.imageUrl ?? null,
          priceUsd: typeof json?.priceUsd === 'number' ? json.priceUsd : null,
          priceChange24h:
            typeof json?.priceChange24h === 'number' ? json.priceChange24h : null,
        });
      } catch {
        if (!cancelled) setTokenInfo(null);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [mint]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) {
        setExpectedReceive('');
        setQuoteError(null);
        return;
      }
      try {
        setQuoteError(null);
        const params = new URLSearchParams({
          inputMint,
          outputMint,
          uiAmount: String(amt),
          slippageMode: 'auto',
        });
        const res = await fetch(`/api/bags/quote?${params.toString()}`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok || cancelled) {
          const raw = json?.error || 'Quote failed';
          setExpectedReceive('');
          setQuoteError(String(raw).slice(0, 160));
          return;
        }

        setLastQuote(json);
        const rawOut = json?.outAmount;
        const outAmountNum =
          typeof rawOut === 'string'
            ? Number(rawOut)
            : typeof rawOut === 'number'
            ? rawOut
            : NaN;
        const outDecimals =
          typeof json?.outDecimals === 'number' ? json.outDecimals : undefined;
        if (!Number.isFinite(outAmountNum) || outAmountNum <= 0 || outDecimals == null) {
          setExpectedReceive('');
          setQuoteError('No route / missing decimals');
          return;
        }
        const ui = outAmountNum / 10 ** outDecimals;
        setExpectedReceive(
          ui.toLocaleString(undefined, { maximumFractionDigits: 6 }),
        );
      } catch {
        if (!cancelled) {
          setExpectedReceive('');
          setQuoteError('Quote failed');
        }
      }
    };

    const id = setTimeout(run, 350);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [amount, inputMint, outputMint]);

  const doSwap = async () => {
    if (!connected || !publicKey) return;
    if (!signTransaction) throw new Error('Wallet does not support signing');

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) throw new Error('Enter an amount');

    setBusy(true);
    setLastSig(null);
    try {
      // Always create a fresh quote right before swap.
      const params = new URLSearchParams({
        inputMint,
        outputMint,
        uiAmount: String(amt),
        slippageMode: 'auto',
      });
      const quoteRes = await fetch(`/api/bags/quote?${params.toString()}`, { cache: 'no-store' });
      const quoteJson = await quoteRes.json();
      if (!quoteRes.ok) {
        throw new Error(quoteJson?.error || 'Quote failed');
      }

      const swapRes = await fetch('/api/bags/swap', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          quoteResponse: quoteJson,
          userPublicKey: publicKey.toBase58(),
        }),
      });
      const swapJson = await swapRes.json();
      if (!swapRes.ok) throw new Error(swapJson?.error || 'Swap build failed');

      const txB58 = swapJson?.swapTransaction;
      if (!txB58 || typeof txB58 !== 'string') {
        throw new Error('No swapTransaction returned from Bags');
      }

      const raw = bs58.decode(txB58);
      const tx = VersionedTransaction.deserialize(Buffer.from(raw));
      const signed = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });
      setLastSig(sig);
      await connection.confirmTransaction(sig, 'confirmed');

      // Emit to terminal (client-side) so Bags swaps appear instantly.
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('bags-trade-executed', {
              detail: {
                mint,
                side,
                quoteAsset,
                uiAmount: amt,
                timestamp: new Date().toISOString(),
              },
            }),
          );
        }
      } catch {}
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col w-full max-w-xl m-4 rounded-2xl border border-[#1A1A1A] bg-[#050505] overflow-hidden shadow-2xl"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1A1A1A] bg-[#0a0a0a]">
          <div className="flex items-center gap-3 min-w-0">
            {tokenInfo?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tokenInfo.imageUrl}
                alt=""
                className="w-8 h-8 rounded-full bg-white/5 flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-white/[0.04] border border-[#1A1A1A] flex-shrink-0" />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="text-sm font-bold text-white truncate max-w-[140px]">
                  {tokenInfo?.symbol || 'TOKEN'}
                </div>
                {typeof tokenInfo?.priceUsd === 'number' ? (
                  <div className="text-xs font-mono text-slate-400">
                    ${tokenInfo.priceUsd.toFixed(6)}
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <div className="text-slate-500 truncate max-w-[200px]">
                  {tokenInfo?.name || mint}
                </div>
                {typeof tokenInfo?.priceChange24h === 'number' ? (
                  <div
                    className={`font-mono ${
                      tokenInfo.priceChange24h >= 0 ? 'text-[#4FFFC8]' : 'text-red-400'
                    }`}
                  >
                    {tokenInfo.priceChange24h >= 0 ? '+' : ''}
                    {tokenInfo.priceChange24h.toFixed(2)}%
                  </div>
                ) : null}
              </div>
              <div className="text-[10px] text-slate-600 font-mono break-all mt-0.5">
                {mint}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSide('buy')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${
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
              className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${
                side === 'sell'
                  ? 'bg-[#4FFFC8]/20 text-[#4FFFC8] border-[#4FFFC8]/30'
                  : 'bg-white/[0.02] text-slate-500 border-[#1A1A1A] hover:text-white'
              }`}
            >
              Sell
            </button>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setQuoteAsset('USDC')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${
                quoteAsset === 'USDC'
                  ? 'bg-white/[0.04] text-white border-[#4FFFC8]/20'
                  : 'bg-white/[0.02] text-slate-500 border-[#1A1A1A] hover:text-white'
              }`}
            >
              USDC
            </button>
            <button
              type="button"
              onClick={() => setQuoteAsset('SOL')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${
                quoteAsset === 'SOL'
                  ? 'bg-white/[0.04] text-white border-[#4FFFC8]/20'
                  : 'bg-white/[0.02] text-slate-500 border-[#1A1A1A] hover:text-white'
              }`}
            >
              SOL
            </button>
          </div>

          <div className="rounded-xl border border-[#1A1A1A] bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-500">You pay</div>
              <div className="text-xs text-slate-400">{side === 'buy' ? quoteAsset : 'TOKEN'}</div>
            </div>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-transparent text-white font-mono text-right outline-none placeholder:text-slate-600 text-2xl"
              placeholder="0"
            />
            <div className="flex items-center justify-between pt-3 border-t border-[#1A1A1A]">
              <div className="text-xs text-slate-500">Receive</div>
              <div className="text-xs text-slate-400">{side === 'buy' ? 'TOKEN' : quoteAsset}</div>
            </div>
            <div className="text-right text-white font-mono text-xl">
              {expectedReceive || '0'}
            </div>
            {quoteError ? (
              <div className="text-[11px] text-slate-500">{quoteError}</div>
            ) : null}
          </div>

          <button
            type="button"
            disabled={!connected || !publicKey || busy}
            onClick={() => doSwap().catch(() => {})}
            className="block w-full py-3 rounded-lg bg-[#4FFFC8] disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold text-sm text-center hover:bg-[#3de6b3] transition-colors"
          >
            {!connected ? 'Connect wallet to trade' : busy ? 'Building swap…' : side === 'buy' ? 'Buy' : 'Sell'}
          </button>

          {lastSig ? (
            <a
              href={`https://solscan.io/tx/${lastSig}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#4FFFC8] hover:underline inline-flex items-center gap-1.5"
            >
              View transaction
            </a>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}

