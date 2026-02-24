'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';
import { setUserContext, clearUserContext, captureError } from '@/lib/error-reporting';

interface AuthContextType {
  user: User | null;
  session: Session | null;
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
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check if Supabase is properly configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey || 
        supabaseUrl === 'https://placeholder.supabase.co' || 
        supabaseKey === 'placeholder-key') {
      // Supabase not configured, skip auth
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        captureError(error, { context: 'AuthProvider.getSession' });
        setLoading(false);
        return;
      }
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      // Set Sentry user context
      if (currentUser) {
        setUserContext(currentUser.id, currentUser.email, {
          user_metadata: currentUser.user_metadata,
        });
      } else {
        clearUserContext();
      }
      
      setLoading(false);
    }).catch((error) => {
      captureError(error, { context: 'AuthProvider.getSession.catch' });
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      // Update Sentry user context
      if (currentUser) {
        setUserContext(currentUser.id, currentUser.email, {
          user_metadata: currentUser.user_metadata,
        });
      } else {
        clearUserContext();
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      clearUserContext(); // Clear Sentry user context on sign out
      router.push('/login');
    } catch (error) {
      captureError(error, { context: 'AuthProvider.signOut' });
      clearUserContext();
      // Still redirect even if signout fails
      router.push('/login');
    }
  };

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

