import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/admin-auth";
import { query } from "@/lib/db";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

export async function GET(req: NextRequest) {
  try {
    // First try the standard admin auth check
    const admin = await checkAdminAuth(req);
    
    if (admin) {
      console.log('[Admin Check] Admin authenticated via checkAdminAuth:', admin.email);
      return NextResponse.json({
        isAdmin: true,
        role: admin.role,
        email: admin.email,
      });
    }

    // Fallback: Check by email from query param or cookies
    // This helps when Supabase session isn't working properly
    let emailToCheck = req.nextUrl.searchParams.get("email");
    
    // Also try to get email from cookies (if stored there)
    if (!emailToCheck) {
      const cookieHeader = req.headers.get("cookie") || "";
      // Try to extract email from cookies if available
      const emailMatch = cookieHeader.match(/email=([^;]+)/);
      if (emailMatch) {
        emailToCheck = decodeURIComponent(emailMatch[1]);
      }
    }
    
    if (emailToCheck) {
      try {
      // Case-insensitive email check - trim and normalize
      const normalizedEmail = emailToCheck.trim().toLowerCase();
      console.log('[Admin Check] Checking email:', normalizedEmail);
        
        // Check if DATABASE_URL is configured
        if (!process.env.DATABASE_URL) {
          console.error('[Admin Check] DATABASE_URL not configured');
          throw new Error('Database connection not configured');
        }
      
      const result = await query(
        `SELECT id, email, role FROM users WHERE LOWER(TRIM(email)) = $1`,
        [normalizedEmail]
      );
      
      console.log('[Admin Check] Query result:', result.rows.length, 'rows found');
      
      if (result.rows.length > 0) {
        const user = result.rows[0];
        console.log('[Admin Check] User found:', { id: user.id, email: user.email, role: user.role });
        
        if (user.role === "admin" || user.role === "risk") {
          return NextResponse.json({
            isAdmin: true,
            role: user.role,
            email: user.email,
          });
        } else {
          console.log('[Admin Check] User is not admin, role is:', user.role);
        }
      } else {
        console.log('[Admin Check] No user found with email:', normalizedEmail);
        }
      } catch (queryError) {
        console.error('[Admin Check] Database query error:', queryError);
        // Re-throw to be caught by outer catch block
        throw queryError;
      }
    }
    
    // Last resort: Check if any admin exists (for dev mode)
    // This is a fallback if session/auth isn't working
    if (!supabaseUrl || supabaseUrl === 'https://placeholder.supabase.co') {
      try {
        if (!process.env.DATABASE_URL) {
          console.warn("[Admin Check] Dev mode: DATABASE_URL not configured, cannot check admin");
        } else {
      const adminCheck = await query(
        `SELECT id, email, role FROM users WHERE role IN ('admin', 'risk') LIMIT 1`
      );
      if (adminCheck.rows.length > 0) {
        console.warn("[Admin Check] Dev mode: Allowing admin access (Supabase not configured)");
        return NextResponse.json({
          isAdmin: true,
          role: adminCheck.rows[0].role,
          email: adminCheck.rows[0].email,
          devMode: true,
        });
          }
        }
      } catch (devModeError) {
        console.error('[Admin Check] Dev mode query error:', devModeError);
        // Continue to return false instead of throwing
      }
    }
    
    console.log('[Admin Check] Access denied - not an admin');
    return NextResponse.json({
      isAdmin: false,
      role: null,
    });
  } catch (error) {
    console.error("[Admin Check] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Log full error details for debugging
    console.error("[Admin Check] Error details:", {
      message: errorMessage,
      stack: errorStack,
      error: error,
    });
    
    return NextResponse.json(
      { 
        isAdmin: false, 
        error: "Failed to check admin status",
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}
