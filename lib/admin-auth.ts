import { NextRequest } from "next/server";

/**
 * Check if the request is from an admin wallet.
 * Pass wallet address in header X-Wallet-Address or query.
 * ADMIN_WALLET_ADDRESSES = comma-separated base58 addresses.
 */
export async function checkAdminAuth(
  req: NextRequest
): Promise<{ id: string; email: string; role: string } | null> {
  const wallet =
    req.headers.get("x-wallet-address")?.trim() ||
    req.nextUrl?.searchParams?.get("wallet")?.trim();
  if (!wallet) return null;

  const adminList = process.env.ADMIN_WALLET_ADDRESSES;
  if (!adminList) return null;

  const allowed = adminList.split(",").map((w) => w.trim().toLowerCase());
  if (!allowed.includes(wallet.toLowerCase())) return null;

  return {
    id: wallet,
    email: wallet,
    role: "admin",
  };
}

export async function isAdmin(): Promise<boolean> {
  try {
    const response = await fetch("/api/admin/check");
    const data = await response.json();
    return data.isAdmin === true;
  } catch {
    return false;
  }
}
