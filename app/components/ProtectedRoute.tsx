'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { Loader2, AlertCircle } from 'lucide-react';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Check if Supabase is configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isConfigured = supabaseUrl && supabaseKey && 
    supabaseUrl !== 'https://placeholder.supabase.co' && 
    supabaseKey !== 'placeholder-key';

  useEffect(() => {
    if (!isConfigured) {
      // If Supabase not configured, allow access (for development)
      return;
    }
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router, isConfigured]);

  if (!isConfigured) {
    // Show warning but allow access for development
    return (
      <>
        <div className="bg-[#f59e0b]/10 border-b border-[#f59e0b]/30 p-4">
          <div className="max-w-7xl mx-auto flex items-center gap-3 text-[#fbbf24] text-sm">
            <AlertCircle className="w-5 h-5" />
            <span>Supabase authentication is not configured. Some features may not work. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local</span>
          </div>
        </div>
        {children}
      </>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#4FFFC8] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}

