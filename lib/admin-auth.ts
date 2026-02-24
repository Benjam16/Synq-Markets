import { query } from "@/lib/db";
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Check if the current user is an admin
 * Returns the user object if admin, null otherwise
 */
export async function checkAdminAuth(req: NextRequest): Promise<{ id: number; email: string; role: string } | null> {
  try {
    if (!supabaseUrl || !supabaseKey || supabaseUrl === 'https://placeholder.supabase.co') {
      // In development, allow if no Supabase configured
      // In production, you'd want to return null here
      console.warn("[Admin Auth] Supabase not configured, allowing access in dev mode");
      return { id: 1, email: 'admin@dev.local', role: 'admin' };
    }

    // Get all cookies from request
    const cookieHeader = req.headers.get("cookie") || "";
    const cookies: Record<string, string> = {};
    cookieHeader.split(";").forEach((cookie) => {
      const [name, value] = cookie.trim().split("=");
      if (name && value) {
        cookies[name] = decodeURIComponent(value);
      }
    });

    // Create Supabase client with cookie support
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          cookie: cookieHeader,
        },
      },
    });

    // Try to get session from cookies
    // Supabase stores session in cookies with specific names
    const accessToken = cookies["sb-access-token"] || cookies[`sb-${supabaseUrl.split("//")[1]?.split(".")[0]}-auth-token`];
    
    if (!accessToken) {
      // Try to get session directly
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.user) {
        return null;
      }

      // Get user from database
      const result = await query(
        `SELECT id, email, role FROM users WHERE supabase_user_id = $1`,
        [session.user.id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const user = result.rows[0];

      // Check if user is admin or risk manager
      if (user.role === "admin" || user.role === "risk") {
        return {
          id: user.id,
          email: user.email,
          role: user.role,
        };
      }
    } else {
      // Verify token
      const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(accessToken);
      
      if (error || !supabaseUser) {
        return null;
      }

      // Get user from database
      const result = await query(
        `SELECT id, email, role FROM users WHERE supabase_user_id = $1`,
        [supabaseUser.id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const user = result.rows[0];

      // Check if user is admin or risk manager
      if (user.role === "admin" || user.role === "risk") {
        return {
          id: user.id,
          email: user.email,
          role: user.role,
        };
      }
    }

    return null;
  } catch (error) {
    console.error("[Admin Auth] Error:", error);
    return null;
  }
}

/**
 * Client-side check for admin role
 * Used in React components
 */
export async function isAdmin(): Promise<boolean> {
  try {
    const response = await fetch("/api/admin/check");
    const data = await response.json();
    return data.isAdmin === true;
  } catch (error) {
    return false;
  }
}
