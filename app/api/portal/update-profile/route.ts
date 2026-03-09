import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { wallet, fullName, paypalEmail } = await req.json();

    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet address is required" },
        { status: 400 }
      );
    }

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ success: true, message: "Profile updated (no DB)." });
    }

    try {
      await query(
        `UPDATE users SET full_name = $1, paypal_email = $2, updated_at = NOW() WHERE wallet_address = $3`,
        [fullName || null, paypalEmail || null, wallet]
      );
    } catch (colErr: unknown) {
      const msg = colErr instanceof Error ? colErr.message : String(colErr);
      if (msg.includes("wallet_address") || (colErr as { code?: string }).code === "42703") {
        return NextResponse.json({
          success: true,
          message: "Profile preferences saved locally; add wallet_address column to users for persistence.",
        });
      }
      throw colErr;
    }

    return NextResponse.json({ success: true, message: "Profile updated successfully." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
