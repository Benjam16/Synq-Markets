// Supabase Edge Function: Risk Engine
// Runs periodically to check drawdown limits and close accounts when breached
// Deploy: supabase functions deploy risk-engine

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Position {
  id: number;
  provider: string;
  market_id: string;
  side: string;
  price: number;
  quantity: number;
}

interface Subscription {
  id: number;
  user_id: number;
  start_balance: number;
  current_balance: number;
  day_start_balance: number;
  status: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all active subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from("challenge_subscriptions")
      .select("id, user_id, start_balance, current_balance, day_start_balance, status")
      .eq("status", "active");

    if (subError) {
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active subscriptions to check" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const closedAccounts: Array<{ subscriptionId: number; reason: string }> = [];

    // Process each subscription
    for (const sub of subscriptions as Subscription[]) {
      // Get open positions
      const { data: positions, error: posError } = await supabase
        .from("simulated_trades")
        .select("id, provider, market_id, side, price, quantity")
        .eq("challenge_subscription_id", sub.id)
        .or("status.is.null,status.eq.open")
        .is("close_price", null)
        .is("closed_at", null);

      if (posError) {
        console.error(`[Risk Engine] Error fetching positions for sub ${sub.id}:`, posError);
        continue;
      }

      // Calculate unrealized P&L from cached prices (fast lookup)
      let unrealizedPnl = 0;
      const positionsList = (positions || []) as Position[];

      // Batch fetch prices from cache for all positions
      const priceKeys = positionsList.map(p => ({
        provider: p.provider.toLowerCase(),
        market_id: p.market_id,
      }));

      // Fetch all prices at once (more efficient)
      const { data: priceData, error: priceError } = await supabase
        .from("market_price_cache")
        .select("provider, market_id, last_price")
        .in("provider", [...new Set(priceKeys.map(k => k.provider))])
        .gt("as_of", new Date(Date.now() - 30 * 60 * 1000).toISOString()); // Last 30 minutes

      const priceMap = new Map<string, number>();
      if (priceData) {
        priceData.forEach((p: any) => {
          priceMap.set(`${p.provider}:${p.market_id}`, parseFloat(p.last_price));
        });
      }

      for (const pos of positionsList) {
        const entryPrice = parseFloat(pos.price.toString());
        const quantity = parseFloat(pos.quantity.toString());
        const side = pos.side.toLowerCase();

        // Get current price: cache → entry price (fallback)
        const cacheKey = `${pos.provider.toLowerCase()}:${pos.market_id}`;
        let currentPrice = priceMap.get(cacheKey);

        // If no cache, use entry price (conservative, avoids API call)
        if (currentPrice === undefined) {
          currentPrice = entryPrice;
        }

        // Calculate P&L based on side
        if (side === "yes") {
          unrealizedPnl += (currentPrice - entryPrice) * quantity;
        } else {
          unrealizedPnl += (entryPrice - currentPrice) * quantity;
        }
      }

      // Calculate equity and drawdowns
      const currentBalance = parseFloat(sub.current_balance.toString());
      const dayStartBalance = parseFloat(sub.day_start_balance.toString());
      const startBalance = parseFloat(sub.start_balance.toString());

      const currentEquity = currentBalance + unrealizedPnl;
      const dailyDrawdownPct = ((currentEquity - dayStartBalance) / dayStartBalance) * 100;
      const totalReturnPct = ((currentEquity - startBalance) / startBalance) * 100;

      // Check PASS condition: 10% profit
      if (totalReturnPct >= 10 && sub.status === "active") {
        console.log(`[Risk Engine] ✅ PASSING account ${sub.id}: Total return ${totalReturnPct.toFixed(2)}% (target: 10%)`);

        const { error: updateError } = await supabase
          .from("challenge_subscriptions")
          .update({
            status: "passed",
            ended_at: new Date().toISOString(),
          })
          .eq("id", sub.id);

        if (updateError) {
          console.error(`[Risk Engine] Error passing account ${sub.id}:`, updateError);
        } else {
          // Log pass event
          await supabase.from("risk_events").insert({
            challenge_subscription_id: sub.id,
            event_type: "profit_target",
            detail: {
              total_return_pct: totalReturnPct.toFixed(2),
              current_equity: currentEquity.toFixed(2),
              start_balance: startBalance.toFixed(2),
              passed_at: new Date().toISOString(),
            },
          });
        }
        continue;
      }

      // Check FAIL conditions
      if (sub.status === "active") {
        // FAIL: Total drawdown >= -10%
        if (totalReturnPct <= -10) {
          console.log(`[Risk Engine] ⚠️ FAILING account ${sub.id}: Total drawdown ${totalReturnPct.toFixed(2)}% (limit: -10%)`);

          const { error: failError } = await supabase
            .from("challenge_subscriptions")
            .update({
              status: "failed",
              fail_reason: `Total drawdown limit exceeded: ${totalReturnPct.toFixed(2)}% (limit: -10%)`,
              ended_at: new Date().toISOString(),
            })
            .eq("id", sub.id);

          if (!failError) {
            await supabase.from("risk_events").insert({
              challenge_subscription_id: sub.id,
              event_type: "total_drawdown",
              detail: {
                total_drawdown_pct: totalReturnPct.toFixed(2),
                current_equity: currentEquity.toFixed(2),
                start_balance: startBalance.toFixed(2),
                failed_at: new Date().toISOString(),
              },
            });

            closedAccounts.push({
              subscriptionId: sub.id,
              reason: `Total drawdown limit exceeded: ${totalReturnPct.toFixed(2)}%`,
            });
          }
        }
        // FAIL: Daily drawdown >= -5%
        else if (dailyDrawdownPct <= -5) {
          console.log(`[Risk Engine] ⚠️ FAILING account ${sub.id}: Daily drawdown ${dailyDrawdownPct.toFixed(2)}% (limit: -5%)`);

          const { error: failError } = await supabase
            .from("challenge_subscriptions")
            .update({
              status: "failed",
              fail_reason: `Daily drawdown limit exceeded: ${dailyDrawdownPct.toFixed(2)}% (limit: -5%)`,
              ended_at: new Date().toISOString(),
            })
            .eq("id", sub.id);

          if (!failError) {
            await supabase.from("risk_events").insert({
              challenge_subscription_id: sub.id,
              event_type: "daily_drawdown",
              detail: {
                daily_drawdown_pct: dailyDrawdownPct.toFixed(2),
                current_equity: currentEquity.toFixed(2),
                day_start_balance: dayStartBalance.toFixed(2),
                failed_at: new Date().toISOString(),
              },
            });

            closedAccounts.push({
              subscriptionId: sub.id,
              reason: `Daily drawdown limit exceeded: ${dailyDrawdownPct.toFixed(2)}%`,
            });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        checked: subscriptions.length,
        closed: closedAccounts.length,
        closedAccounts,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("[Risk Engine] Error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Failed to run risk engine",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
