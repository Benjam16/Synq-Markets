import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function POST(req: NextRequest) {
  try {
    const { userId, fullName, paypalEmail } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Verify user exists and get Supabase user ID
    const userCheck = await query(
      `SELECT id, email, supabase_user_id FROM users WHERE id = $1`,
      [userId]
    );

    if (userCheck.rows.length === 0) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const userData = userCheck.rows[0];
    const supabaseUserId = userData.supabase_user_id;

    // Update user profile in PostgreSQL database
    await query(
      `
      UPDATE users
      SET full_name = $1,
          paypal_email = $2,
          updated_at = NOW()
      WHERE id = $3
      `,
      [fullName || null, paypalEmail || null, userId]
    );

    // Also sync to Supabase Auth metadata if Supabase user ID exists
    if (supabaseUserId && supabaseServiceKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        });

        // Get existing metadata to preserve it
        const { data: existingUser, error: fetchError } = await supabase.auth.admin.getUserById(supabaseUserId);
        
        if (!fetchError && existingUser.user) {
          // Update Supabase user metadata (preserve existing metadata)
          const { error: metadataError } = await supabase.auth.admin.updateUserById(
            supabaseUserId,
            {
              user_metadata: {
                ...existingUser.user.user_metadata,
                full_name: fullName || null,
                paypal_email: paypalEmail || null,
              },
            }
          );

          if (metadataError) {
            console.warn("[Update Profile] Failed to sync to Supabase metadata:", metadataError);
            // Don't fail the request - database update succeeded
          } else {
            console.log("[Update Profile] Successfully synced to Supabase metadata");
          }
        }
      } catch (supabaseError) {
        console.warn("[Update Profile] Supabase sync error (non-critical):", supabaseError);
        // Don't fail the request - database update succeeded
      }
    }

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
    });
  } catch (error: any) {
    console.error("Error updating profile:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update profile" },
      { status: 500 }
    );
  }
}
