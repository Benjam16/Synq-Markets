import { NextRequest, NextResponse } from "next/server";

/**
 * Admin check by wallet address.
 * Set ADMIN_WALLET_ADDRESSES in env (comma-separated base58 addresses) to grant admin access.
 */
export async function GET(req: NextRequest) {
  try {
    const wallet = req.nextUrl.searchParams.get("wallet")?.trim();
    if (!wallet) {
      return NextResponse.json({ isAdmin: false, role: null });
    }

    const adminList = process.env.ADMIN_WALLET_ADDRESSES;
    if (!adminList) {
      return NextResponse.json({ isAdmin: false, role: null });
    }

    const allowed = adminList.split(",").map((w) => w.trim().toLowerCase());
    const isAdmin = allowed.includes(wallet.toLowerCase());

    return NextResponse.json({
      isAdmin,
      role: isAdmin ? "admin" : null,
      wallet: isAdmin ? wallet : undefined,
    });
  } catch (error) {
    console.error("[Admin Check] Error:", error);
    return NextResponse.json(
      { isAdmin: false, error: "Failed to check admin status" },
      { status: 500 }
    );
  }
}
