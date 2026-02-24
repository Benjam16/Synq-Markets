'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase-client';
import { toast, Toaster } from 'react-hot-toast';
import { LogIn } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Check Supabase configuration
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey || 
        supabaseUrl === 'https://placeholder.supabase.co' || 
        supabaseKey === 'placeholder-key') {
      setError('Supabase is not configured. Please check your environment variables.');
      return;
    }

    // Test if Supabase URL is reachable
    fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        'apikey': supabaseKey,
      },
    }).catch(() => {
      setError('Cannot connect to Supabase. Please verify your Supabase project URL is correct and the project is active.');
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!email || !password) {
      setError('Please fill in all fields');
      toast.error('Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      // Check if Supabase is properly configured
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey || 
          supabaseUrl === 'https://placeholder.supabase.co' || 
          supabaseKey === 'placeholder-key') {
        throw new Error('Supabase is not configured. Please check your environment variables.');
      }

      // Verify Supabase client is initialized
      if (!supabase) {
        throw new Error('Supabase client not initialized. Please refresh the page.');
      }

      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        
        if (signUpError) {
          let errorMsg = signUpError.message || 'Failed to create account';
          
          // Provide more helpful error messages
          if (signUpError.message?.includes('refresh token') || 
              signUpError.message?.includes('FATAL') ||
              signUpError.message?.includes('terminating connection')) {
            errorMsg = 'Database connection error. Your Supabase project may be restoring. Please wait a moment and try again.';
          } else if (signUpError.message?.includes('fetch')) {
            errorMsg = 'Network error. Please check your internet connection and try again.';
          }
          
          setError(errorMsg);
          toast.error(errorMsg);
          return;
        }
        
        if (data?.user) {
          toast.success('Account created! Redirecting...');
          setTimeout(() => {
            router.push('/dashboard');
          }, 1000);
        } else {
          // User might need to verify email
          toast.success('Account created! Please check your email to verify your account.');
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (signInError) {
          let errorMsg = signInError.message || 'Invalid email or password';
          
          // Provide more helpful error messages
          if (signInError.message?.includes('refresh token') || 
              signInError.message?.includes('FATAL') ||
              signInError.message?.includes('terminating connection')) {
            errorMsg = 'Database connection error. Your Supabase project may be restoring. Please wait a moment and try again.';
          } else if (signInError.message?.includes('fetch')) {
            errorMsg = 'Network error. Please check your internet connection and try again.';
          } else if (signInError.message?.includes('Invalid login credentials')) {
            errorMsg = 'Invalid email or password. Please check your credentials and try again.';
          }
          
          setError(errorMsg);
          toast.error(errorMsg);
          return;
        }
        
        if (data?.user) {
          toast.success('Logged in successfully');
          router.push('/dashboard');
        }
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      
      // Handle network errors specifically
      if (error?.message?.includes('fetch') || error?.name === 'TypeError') {
        const errorMsg = 'Network error: Unable to connect to authentication server. Please check your internet connection and try again.';
        setError(errorMsg);
        toast.error(errorMsg);
      } else {
        const errorMsg = error?.message || 'An unexpected error occurred. Please try again.';
        setError(errorMsg);
        toast.error(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center px-6 py-12">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#0F172A',
            color: '#e2e8f0',
            border: '1px solid #1e293b',
            borderRadius: '8px',
          },
        }}
      />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-[400px]"
      >
        {/* Logo */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-block">
            <div className="text-2xl font-semibold text-white mb-1 tracking-tight">Prop Market</div>
            <div className="text-sm text-slate-400">Professional Trading Platform</div>
          </Link>
        </div>

        {/* Login Card - FTMO Style */}
        <div className="p-8 glass-dark rounded-xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-[#4FFFC8]/10 rounded-full mb-4 border border-[#4FFFC8]/20">
              <LogIn className="w-6 h-6 text-[#4FFFC8]" strokeWidth={1.5} />
            </div>
            <h1 className="text-2xl font-semibold text-white mb-2 tracking-tight">
              {isSignUp ? 'Create Account' : 'Welcome Back'}
            </h1>
            <p className="text-sm text-slate-400">
              {isSignUp
                ? 'Start your trading journey today'
                : 'Sign in to access your dashboard'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-full">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-[#050505] border border-[#1A1A1A] rounded-full text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#4FFFC8] focus:border-transparent transition-all text-sm"
                placeholder="you@example.com"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 bg-[#050505] border border-[#1A1A1A] rounded-full text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#4FFFC8] focus:border-transparent transition-all text-sm"
                placeholder="••••••••"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#4FFFC8] hover:bg-[#3debb8] disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold rounded-full shadow-[0_0_20px_rgba(79,255,200,0.3)] transition-all"
            >
              {loading ? 'Loading...' : (isSignUp ? 'Create Account' : 'Sign In')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
              className="text-sm text-[#4FFFC8] hover:text-[#3debb8] font-medium transition-colors"
            >
              {isSignUp
                ? 'Already have an account? Sign in'
                : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-sm text-slate-400 hover:text-[#4FFFC8] transition-colors"
          >
            ← Back to home
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
