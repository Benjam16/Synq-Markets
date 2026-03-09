import { NextRequest, NextResponse } from "next/server";

// Wallet-only auth: no password. Return 410 Gone so frontend can hide this flow.
export async function POST(req: NextRequest) {
  return NextResponse.json(
    { error: "Password change is not used with wallet authentication." },
    { status: 410 }
  );
}
