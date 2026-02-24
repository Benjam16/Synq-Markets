import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/**
 * Vercel Cron Job: Drawdown Check
 * Runs every 2 minutes to check risk limits
 * Configured in vercel.json
 */
export async function GET(req: NextRequest) {
  try {
    // Verify this is a cron request (security)
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Try Supabase Edge Function first (recommended)
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/risk-engine`;
    
    try {
      const response = await fetch(edgeFunctionUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`[Cron] Risk check complete (Edge Function): ${result.checked} checked, ${result.closed} closed`);
        
        return NextResponse.json({
          success: true,
          source: "edge-function",
          ...result,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (edgeError) {
      console.warn("[Cron] Edge Function failed, falling back to API route:", edgeError);
    }

    // Fallback: Use existing API route (if Edge Function unavailable)
    const apiUrl = req.nextUrl.origin + "/api/risk-check";
    const fallbackResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}), // Empty body = check all users
    });

    if (!fallbackResponse.ok) {
      const errorText = await fallbackResponse.text();
      console.error("[Cron] Risk check error (fallback):", errorText);
      return NextResponse.json(
        { error: "Risk engine failed", details: errorText },
        { status: 500 }
      );
    }

    const result = await fallbackResponse.json();
    console.log(`[Cron] Risk check complete (API fallback): ${result.checked} checked, ${result.closed} closed`);

    return NextResponse.json({
      success: true,
      source: "api-route",
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[Cron] Drawdown check error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to run drawdown check" },
      { status: 500 }
    );
  }
}
