'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Wallet } from 'lucide-react';
import dynamic from 'next/dynamic';

const WalletMultiButton = dynamic(
  () =>
    import('@solana/wallet-adapter-react-ui').then((mod) => mod.WalletMultiButton),
  { ssr: false }
);

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    // Small delay so wallet adapter is mounted
    const t = setTimeout(() => {}, 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-[400px]"
      >
        <div className="text-center mb-10">
          <Link href="/" className="inline-block">
            <div className="text-2xl font-semibold text-white mb-1 tracking-tight">Synq</div>
            <div className="text-sm text-slate-400">Onchain Trading Platform</div>
          </Link>
        </div>

        <div className="p-8 glass-dark rounded-xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-[#4FFFC8]/10 rounded-full mb-4 border border-[#4FFFC8]/20">
              <Wallet className="w-6 h-6 text-[#4FFFC8]" strokeWidth={1.5} />
            </div>
            <h1 className="text-2xl font-semibold text-white mb-2 tracking-tight">
              Connect Wallet
            </h1>
            <p className="text-sm text-slate-400">
              Connect with Phantom or Solflare to access the terminal
            </p>
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className="w-full [&_.wallet-adapter-button]:!w-full [&_.wallet-adapter-button]:!justify-center [&_.wallet-adapter-button]:!rounded-full [&_.wallet-adapter-button]:!py-3 [&_.wallet-adapter-button]:!bg-[#4FFFC8] [&_.wallet-adapter-button]:!text-black [&_.wallet-adapter-button]:!font-bold [&_.wallet-adapter-button]:!hover:bg-[#3debb8] [&_.wallet-adapter-button]:!shadow-[0_0_20px_rgba(79,255,200,0.3)]">
              <WalletMultiButton />
            </div>
            <p className="text-xs text-slate-500">
              Phantom and Solflare are supported. Install a wallet if you don’t have one.
            </p>
          </div>

          <div className="mt-6 text-center">
            <Link
              href="/"
              className="text-sm text-slate-400 hover:text-[#4FFFC8] transition-colors"
            >
              ← Back to home
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
