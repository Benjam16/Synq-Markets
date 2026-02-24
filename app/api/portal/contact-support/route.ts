import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { userId, email, subject, message } = await req.json();

    if (!userId || !email || !subject || !message) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    // Store support request in database (you can create a support_tickets table)
    // For now, we'll just log it and return success
    // In production, you'd want to:
    // 1. Store in a support_tickets table
    // 2. Send email notification to support team
    // 3. Send confirmation email to user

    console.log("[Support Request]", {
      userId,
      email,
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
