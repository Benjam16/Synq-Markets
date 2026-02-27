import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(req: NextRequest) {
  let email: string | undefined;
  
  try {
    // Check if DATABASE_URL is configured
    if (!process.env.DATABASE_URL) {
      console.error('[User API] DATABASE_URL not configured');
      return NextResponse.json(
        { 
          error: 'Database connection not configured. Please check environment variables.',
          code: 'DATABASE_NOT_CONFIGURED'
        },
        { status: 500 }
      );
    }

    const body = await req.json();
    email = body.email;
    const { supabaseUserId, fullName } = body;

    console.log('[User API] Creating user:', { email, hasSupabaseId: !!supabaseUserId, fullName });

    if (!email) {
      return NextResponse.json(
        { error: 'email is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Check if user already exists (with retry logic for race conditions)
    let existingUser;
    let retries = 3;
    
    while (retries > 0) {
      try {
        existingUser = await query(
          `SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
          [email]
        );

        if (existingUser.rows.length > 0) {
          console.log('[User API] User already exists:', existingUser.rows[0].id);
          return NextResponse.json({
            userId: existingUser.rows[0].id,
            created: false,
          });
        }
      } catch (checkError: any) {
        console.error('[User API] Error checking for existing user:', checkError);
        // If database connection fails, throw immediately
        if (checkError.code === 'ECONNREFUSED' || checkError.code === 'ENOTFOUND' || checkError.message?.includes('connection')) {
          throw new Error(`Database connection failed: ${checkError.message}`);
        }
        // For other errors, continue to retry
      }

      // If trigger might be running, wait a bit and retry
      if (retries > 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      retries--;
    }

    // Create new user using UPSERT to handle race conditions
    // This handles cases where trigger might have created user between checks
    // First, check if supabase_user_id column exists
    let result;
    try {
      // Try with supabase_user_id column (if migration was run)
      result = await query(
      `
      INSERT INTO users (email, full_name, role, supabase_user_id)
      VALUES ($1, $2, 'trader', $3)
      ON CONFLICT (email) DO UPDATE
      SET supabase_user_id = COALESCE(users.supabase_user_id, EXCLUDED.supabase_user_id),
          updated_at = NOW()
      RETURNING id;
      `,
      [email, fullName || email.split('@')[0], supabaseUserId || null]
    );
    } catch (columnError: any) {
      // If column doesn't exist, try without supabase_user_id
      if (columnError.message?.includes('column') && columnError.message?.includes('supabase_user_id')) {
        console.warn('[User API] supabase_user_id column not found, creating user without it. Run migration to add this column.');
        try {
          result = await query(
            `
            INSERT INTO users (email, full_name, role)
            VALUES ($1, $2, 'trader')
            ON CONFLICT (email) DO UPDATE
            SET updated_at = NOW()
            RETURNING id;
            `,
            [email, fullName || email.split('@')[0]]
          );
        } catch (fallbackError: any) {
          console.error('[User API] Fallback insert also failed:', fallbackError);
          throw fallbackError;
        }
      } else {
        // Re-throw if it's a different error
        throw columnError;
      }
    }

    return NextResponse.json({
      userId: result.rows[0].id,
      created: true,
    });
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = error.code || 'UNKNOWN_ERROR';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('[User API] Error creating user:', {
      error: errorMessage,
      code: errorCode,
      email,
      stack: errorStack,
      fullError: error,
    });
    
    // Check for database connection errors
    if (errorCode === '28P01' || errorMessage?.includes('password authentication')) {
      console.error('[User API] Database password authentication failed. Check DATABASE_URL.');
      return NextResponse.json(
        { 
          error: 'Database authentication failed. Please check your database configuration.',
          code: 'DATABASE_AUTH_ERROR',
          details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        },
        { status: 500 }
      );
    }
    
    if (errorCode === 'ECONNREFUSED' || errorCode === 'ENOTFOUND' || errorMessage?.includes('connection')) {
      console.error('[User API] Database connection failed.');
      return NextResponse.json(
        { 
          error: 'Cannot connect to database. Please check your database configuration.',
          code: 'DATABASE_CONNECTION_ERROR',
          details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        },
        { status: 500 }
      );
    }
    
    // If it's a duplicate key error, try to fetch the existing user
    if (email && (errorCode === '23505' || errorMessage?.includes('duplicate') || errorMessage?.includes('unique'))) {
      try {
        const existingUser = await query(
          `SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
          [email]
        );
        if (existingUser.rows.length > 0) {
          console.log('[User API] User already exists, returning existing user ID:', existingUser.rows[0].id);
          return NextResponse.json({
            userId: existingUser.rows[0].id,
            created: false,
          });
        }
      } catch (fetchError: any) {
        console.error('[User API] Error fetching existing user after duplicate error:', fetchError);
        // Fall through to return error
      }
    }
    
    // Return detailed error for debugging
    return NextResponse.json(
      { 
        error: errorMessage || 'Failed to create user',
        code: errorCode,
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    // Check if DATABASE_URL is configured
    if (!process.env.DATABASE_URL) {
      console.error('[User API] DATABASE_URL not configured');
      return NextResponse.json(
        { 
          error: 'Database connection not configured. Please check environment variables.',
          code: 'DATABASE_NOT_CONFIGURED'
        },
        { status: 500 }
      );
    }

    const email = req.nextUrl.searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'email is required' },
        { status: 400 }
      );
    }

    let result;
    try {
      result = await query(
        `SELECT id, email, full_name, role, paypal_email, created_at, updated_at FROM users WHERE email = $1 LIMIT 1`,
        [email]
      );
    } catch (colError: any) {
      if (colError.message?.includes('paypal_email') || colError.code === '42703') {
        result = await query(
          `SELECT id, email, full_name, role, created_at, updated_at FROM users WHERE email = $1 LIMIT 1`,
          [email]
        );
      } else {
        throw colError;
      }
    }

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = result.rows[0];
    
    return NextResponse.json({ 
      user: {
        id: userData.id,
        email: userData.email,
        full_name: userData.full_name,
        role: userData.role,
        paypal_email: userData.paypal_email || null,
        created_at: userData.created_at,
        updated_at: userData.updated_at,
      }
    });
  } catch (error: any) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

