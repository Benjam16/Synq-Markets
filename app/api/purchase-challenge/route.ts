import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    // Check if DATABASE_URL is configured
    if (!process.env.DATABASE_URL) {
      console.error('[Purchase Challenge] DATABASE_URL not configured');
      return NextResponse.json(
        { 
          error: 'Database connection not configured. Please check environment variables.',
          code: 'DATABASE_NOT_CONFIGURED'
        },
        { status: 500 }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch (parseError: any) {
      console.error('[Purchase Challenge] Failed to parse request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid request body. Expected JSON with userId and tierId.' },
        { status: 400 }
      );
    }

    const { userId, tierId } = body;
    
    console.log('[Purchase Challenge] Request received:', {
      userId,
      tierId,
      userIdType: typeof userId,
      tierIdType: typeof tierId,
      bodyKeys: Object.keys(body || {}),
    });

    if (!userId || !tierId) {
      console.error('[Purchase Challenge] Missing required fields:', {
        hasUserId: !!userId,
        hasTierId: !!tierId,
        userId,
        tierId,
      });
      return NextResponse.json(
        { 
          error: 'userId and tierId are required',
          received: {
            userId: userId || null,
            tierId: tierId || null,
          }
        },
        { status: 400 }
      );
    }

    // Get tier details
    let tierRes;
    try {
      tierRes = await query(
      `SELECT id, account_size, challenge_fee FROM account_tiers WHERE id = $1`,
      [tierId]
    );
    } catch (dbError: any) {
      console.error('[Purchase Challenge] Database query error:', dbError);
      const errorMessage = dbError instanceof Error ? dbError.message : 'Database query failed';
      const errorCode = dbError.code || 'DATABASE_ERROR';
      
      // Check for common database connection errors
      if (errorCode === 'ECONNREFUSED' || errorCode === 'ENOTFOUND' || errorMessage.includes('connection')) {
        return NextResponse.json(
          { 
            error: 'Cannot connect to database. Please check DATABASE_URL configuration.',
            code: 'DATABASE_CONNECTION_ERROR',
            details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
          },
          { status: 500 }
        );
      }
      
      throw dbError; // Re-throw to be caught by outer catch
    }

    if (tierRes.rows.length === 0) {
      return NextResponse.json(
        { error: 'Tier not found' },
        { status: 404 }
      );
    }

    const tier = tierRes.rows[0];
    const accountSize = Number(tier.account_size);
    const fee = Number(tier.challenge_fee);

    // Check if user already has an active challenge
    let activeChallenge;
    try {
      activeChallenge = await query(
      `SELECT id FROM challenge_subscriptions WHERE user_id = $1 AND status = 'active' LIMIT 1`,
      [userId]
    );
    } catch (dbError: any) {
      console.error('[Purchase Challenge] Error checking active challenge:', dbError);
      throw dbError;
    }

    if (activeChallenge.rows.length > 0) {
      return NextResponse.json(
        { error: 'User already has an active challenge' },
        { status: 400 }
      );
    }

    // Create challenge subscription
    let subscriptionRes;
    try {
      subscriptionRes = await query(
      `
      INSERT INTO challenge_subscriptions (user_id, tier_id, status, start_balance, current_balance, day_start_balance)
      VALUES ($1, $2, 'active', $3, $3, $3)
      RETURNING id;
      `,
      [userId, tierId, accountSize]
    );
    } catch (dbError: any) {
      console.error('[Purchase Challenge] Error creating subscription:', dbError);
      throw dbError;
    }

    const subscriptionId = subscriptionRes.rows[0].id;

    return NextResponse.json({
      success: true,
      subscriptionId,
      accountSize,
      message: 'Challenge purchased successfully',
    });
  } catch (error: any) {
    console.error('[Purchase Challenge] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCode = error.code || 'UNKNOWN_ERROR';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Log full error details for debugging
    console.error('[Purchase Challenge] Error details:', {
      message: errorMessage,
      code: errorCode,
      stack: errorStack,
      error: error,
    });
    
    // Provide helpful error messages based on error type
    let userFriendlyError = errorMessage;
    if (errorCode === 'ECONNREFUSED' || errorCode === 'ENOTFOUND') {
      userFriendlyError = 'Database connection failed. Please check your database configuration.';
    } else if (errorMessage.includes('DATABASE_URL')) {
      userFriendlyError = 'Database connection not configured. Please set DATABASE_URL environment variable.';
    }
    
    return NextResponse.json(
      { 
        error: userFriendlyError || 'Failed to purchase challenge',
        code: errorCode,
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}

