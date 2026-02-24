/**
 * Trader Psychology Analysis Utility
 * Calculates Tilt Score based on trading behavior patterns
 */

export interface Trade {
  id: number;
  executed_at: string;
  side: 'yes' | 'no';
  price: number;
  quantity: number;
  market_id: string;
  provider: string;
  close_price?: number;
  status?: 'open' | 'closed' | 'settled';
}

export interface PsychologyAnalysis {
  tiltScore: number; // 0-100, higher = more tilted
  revengeTrades: number; // Count of trades within 5 mins of a loss
  avgTimeBetweenTrades: number; // Average minutes between trades
  losingStreak: number; // Current consecutive losses
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  insights: string[];
}

/**
 * Calculate if a trade was a loss
 */
function isLosingTrade(trade: Trade, nextPrice?: number): boolean {
  if (!nextPrice || trade.status !== 'closed') return false;
  
  if (trade.side === 'yes') {
    return trade.close_price! < trade.price;
  } else {
    return trade.close_price! > trade.price;
  }
}

/**
 * Calculate time difference in minutes between two timestamps
 */
function getTimeDifferenceMinutes(timestamp1: string, timestamp2: string): number {
  const date1 = new Date(timestamp1);
  const date2 = new Date(timestamp2);
  return (date2.getTime() - date1.getTime()) / (1000 * 60);
}

/**
 * Analyze trader psychology from trade history
 */
export function analyzeTraderPsychology(trades: Trade[]): PsychologyAnalysis {
  if (trades.length === 0) {
    return {
      tiltScore: 0,
      revengeTrades: 0,
      avgTimeBetweenTrades: 0,
      losingStreak: 0,
      riskLevel: 'low',
      insights: ['No trading history available'],
    };
  }

  // Sort trades by execution time
  const sortedTrades = [...trades].sort(
    (a, b) => new Date(a.executed_at).getTime() - new Date(b.executed_at).getTime()
  );

  let revengeTrades = 0;
  let totalTimeBetween = 0;
  let timeBetweenCount = 0;
  let currentLosingStreak = 0;
  let maxLosingStreak = 0;
  const insights: string[] = [];

  // Analyze each trade pair
  for (let i = 0; i < sortedTrades.length - 1; i++) {
    const currentTrade = sortedTrades[i];
    const nextTrade = sortedTrades[i + 1];

    // Calculate time between trades
    const timeDiff = getTimeDifferenceMinutes(currentTrade.executed_at, nextTrade.executed_at);
    totalTimeBetween += timeDiff;
    timeBetweenCount++;

    // Check for revenge trading (trade within 5 mins of a loss)
    if (isLosingTrade(currentTrade, currentTrade.close_price)) {
      if (timeDiff < 5) {
        revengeTrades++;
      }
      
      // Track losing streak
      currentLosingStreak++;
      maxLosingStreak = Math.max(maxLosingStreak, currentLosingStreak);
    } else {
      currentLosingStreak = 0;
    }
  }

  // Calculate average time between trades
  const avgTimeBetweenTrades = timeBetweenCount > 0 ? totalTimeBetween / timeBetweenCount : 0;

  // Calculate Tilt Score (0-100)
  // Factors:
  // - Revenge trades: 40 points max
  // - Short time between trades: 30 points max
  // - Losing streak: 30 points max
  let tiltScore = 0;

  // Revenge trading component (0-40 points)
  const revengeRatio = revengeTrades / Math.max(sortedTrades.length - 1, 1);
  tiltScore += Math.min(revengeRatio * 100, 40);

  // Time between trades component (0-30 points)
  // Lower average time = higher tilt
  if (avgTimeBetweenTrades < 10) {
    tiltScore += 30;
  } else if (avgTimeBetweenTrades < 30) {
    tiltScore += 20;
  } else if (avgTimeBetweenTrades < 60) {
    tiltScore += 10;
  }

  // Losing streak component (0-30 points)
  if (maxLosingStreak >= 5) {
    tiltScore += 30;
  } else if (maxLosingStreak >= 3) {
    tiltScore += 20;
  } else if (maxLosingStreak >= 2) {
    tiltScore += 10;
  }

  tiltScore = Math.min(tiltScore, 100);

  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high' | 'critical';
  if (tiltScore >= 70) {
    riskLevel = 'critical';
    insights.push('⚠️ Critical tilt detected. Consider taking a break.');
  } else if (tiltScore >= 50) {
    riskLevel = 'high';
    insights.push('⚠️ High tilt risk. Monitor your trading decisions carefully.');
  } else if (tiltScore >= 30) {
    riskLevel = 'medium';
    insights.push('Moderate tilt detected. Stay disciplined.');
  } else {
    riskLevel = 'low';
    insights.push('✅ Trading psychology looks healthy.');
  }

  // Add specific insights
  if (revengeTrades > 0) {
    insights.push(`Found ${revengeTrades} potential revenge trade(s) (trades within 5 mins of a loss).`);
  }

  if (avgTimeBetweenTrades < 10) {
    insights.push('Very short time between trades detected. Consider slowing down.');
  }

  if (maxLosingStreak >= 3) {
    insights.push(`Maximum losing streak: ${maxLosingStreak} consecutive losses.`);
  }

  return {
    tiltScore: Math.round(tiltScore),
    revengeTrades,
    avgTimeBetweenTrades: Math.round(avgTimeBetweenTrades * 10) / 10,
    losingStreak: maxLosingStreak,
    riskLevel,
    insights,
  };
}

