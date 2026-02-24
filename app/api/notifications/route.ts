import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Get notifications for a user
export async function GET(req: NextRequest) {
  try {
    // Get user from session
    // For server-side, use simple client without cookie handling
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Get auth token from cookies manually
    const cookieStore = await cookies();
    const authToken = cookieStore.get('sb-access-token')?.value || 
                      cookieStore.get('supabase-auth-token')?.value;
    
    if (authToken) {
      supabase.auth.setSession({ access_token: authToken, refresh_token: '' } as any);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user ID from database
    const userRes = await query<{ id: number }>(
      `SELECT id FROM users WHERE email = $1`,
      [user.email]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json({ notifications: [], unreadCount: 0 });
    }

    const userId = userRes.rows[0].id;

    // Get query parameters
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50", 10);
    const offset = parseInt(req.nextUrl.searchParams.get("offset") || "0", 10);
    const unreadOnly = req.nextUrl.searchParams.get("unreadOnly") === "true";
    const type = req.nextUrl.searchParams.get("type");

    // Build query
    let sql = `
      SELECT 
        id,
        type,
        title,
        message,
        data,
        read,
        created_at
      FROM notifications
      WHERE user_id = $1
    `;

    const params: any[] = [userId];
    let paramCount = 2;

    if (unreadOnly) {
      sql += ` AND read = false`;
    }

    if (type) {
      sql += ` AND type = $${paramCount}`;
      params.push(type);
      paramCount++;
    }

    sql += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    // Get unread count
    const unreadCountRes = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND read = false`,
      [userId]
    );
    const unreadCount = parseInt(unreadCountRes.rows[0]?.count || "0", 10);

    return NextResponse.json({
      notifications: result.rows.map((row) => ({
        id: row.id,
        type: row.type,
        title: row.title,
        message: row.message,
        data: row.data,
        read: row.read,
        createdAt: row.created_at,
      })),
      unreadCount,
    });
  } catch (error: any) {
    console.error("[Notifications] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

// Mark notifications as read
export async function PATCH(req: NextRequest) {
  try {
    // For server-side, use simple client without cookie handling
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Get auth token from cookies manually
    const cookieStore = await cookies();
    const authToken = cookieStore.get('sb-access-token')?.value || 
                      cookieStore.get('supabase-auth-token')?.value;
    
    if (authToken) {
      supabase.auth.setSession({ access_token: authToken, refresh_token: '' } as any);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRes = await query<{ id: number }>(
      `SELECT id FROM users WHERE email = $1`,
      [user.email]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = userRes.rows[0].id;
    const { notificationIds, markAllRead } = await req.json();

    if (markAllRead) {
      // Mark all as read
      await query(
        `UPDATE notifications SET read = true WHERE user_id = $1 AND read = false`,
        [userId]
      );
    } else if (notificationIds && Array.isArray(notificationIds)) {
      // Mark specific notifications as read
      await query(
        `UPDATE notifications SET read = true WHERE user_id = $1 AND id = ANY($2::bigint[])`,
        [userId, notificationIds]
      );
    } else {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Notifications] Error marking as read:", error);
    return NextResponse.json(
      { error: "Failed to update notifications" },
      { status: 500 }
    );
  }
}
