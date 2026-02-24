'use client';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// In Next.js, NEXT_PUBLIC_ environment variables are available in client components
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Only create client if we have valid credentials
let supabase: SupabaseClient;

if (supabaseUrl && supabaseUrl !== '' && supabaseUrl !== 'https://placeholder.supabase.co' &&
    supabaseAnonKey && supabaseAnonKey !== '' && supabaseAnonKey !== 'placeholder-key') {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    });
    console.log('✅ Supabase client initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Supabase client:', error);
    // Fallback to placeholder
    supabase = createClient('https://placeholder.supabase.co', 'placeholder-key', {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
} else {
  // Create a mock client that won't crash but will fail gracefully
  console.error('❌ Supabase credentials not configured!');
  console.error('Please add to .env.local:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"');
  console.error('  NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"');
  supabase = createClient('https://placeholder.supabase.co', 'placeholder-key', {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export { supabase };

