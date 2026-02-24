import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function POST(req: NextRequest) {
  try {
    const { currentPassword, newPassword, userEmail } = await req.json();

    if (!currentPassword || !newPassword || !userEmail) {
      return NextResponse.json(
        { error: "Current password, new password, and email are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Verify current password by attempting to sign in
    const { data: signInData, error: verifyError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: currentPassword,
    });

    if (verifyError || !signInData.session) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 401 }
      );
    }

    // Update password using the authenticated session
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      console.error("Error updating password:", updateError);
      return NextResponse.json(
        { error: updateError.message || "Failed to update password" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error: any) {
    console.error("Error changing password:", error);
    return NextResponse.json(
      { error: error.message || "Failed to change password" },
      { status: 500 }
    );
  }
}
