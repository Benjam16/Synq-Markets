'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { setUserContext, clearUserContext, captureError } from '@/lib/error-reporting';

/** Wallet-based user for compatibility with existing useAuth() consumers */
export interface WalletUser {
  id: string;
  address: string;
  email: string; // same as address for display (e.g. truncated)
}

interface AuthContextType {
  user: WalletUser | null;
  session: { wallet: string } | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { publicKey, connected, disconnect, connecting, disconnecting } = useWallet();
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const user: WalletUser | null = publicKey && connected
    ? {
        id: publicKey.toBase58(),
        address: publicKey.toBase58(),
        email: `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`,
      }
    : null;

  const session = user ? { wallet: user.address } : null;

  useEffect(() => {
    setLoading(connecting || disconnecting);
  }, [connecting, disconnecting]);

  useEffect(() => {
    if (!connecting && !disconnecting) {
      setLoading(false);
    }
  }, [connected, connecting, disconnecting]);

  useEffect(() => {
    if (user) {
      setUserContext(user.id, user.address, { wallet: user.address });
    } else {
      clearUserContext();
    }
  }, [user?.id]);

  const signOut = useCallback(async () => {
    try {
      await disconnect();
      clearUserContext();
      router.push('/login');
    } catch (error) {
      captureError(error, { context: 'AuthProvider.signOut' });
      clearUserContext();
      router.push('/login');
    }
  }, [disconnect, router]);

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
