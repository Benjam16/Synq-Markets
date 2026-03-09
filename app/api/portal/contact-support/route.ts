import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { userId, wallet, email, subject, message } = await req.json();
    const identity = wallet || userId;

    if (!identity || !subject || !message) {
      return NextResponse.json(
        { error: "Wallet/identity, subject, and message are required" },
        { status: 400 }
      );
    }

    console.log("[Support Request]", {
      wallet: identity,
      email: email || null,
      subject,
      message,
      timestamp: new Date().toISOString(),
    });

    // TODO: Create support_tickets table and store the request
    // For now, we'll just return success

    return NextResponse.json({
      success: true,
      message: "Support request submitted successfully. We'll get back to you soon.",
    });
  } catch (error: any) {
    console.error("Error submitting support request:", error);
    return NextResponse.json(
      { error: error.message || "Failed to submit support request" },
      { status: 500 }
    );
  }
}
