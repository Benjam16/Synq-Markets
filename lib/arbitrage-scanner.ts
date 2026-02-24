/**
 * Arbitrage Scanner Utility
 * Identifies price differences across providers for the same market
 */

import { Market } from '@/lib/types';

export interface ArbitrageOpportunity {
  marketName: string;
  kalshiPrice: number;
  polymarketPrice: number;
  priceDifference: number; // Absolute difference
  priceDifferencePercent: number; // Percentage difference
  opportunity: 'buy-kalshi-sell-polymarket' | 'buy-polymarket-sell-kalshi';
  potentialProfit: number; // Estimated profit per $1000 invested
}

/**
 * Normalize market names for comparison
 * Removes provider-specific prefixes and normalizes text
 */
function normalizeMarketName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(kalshi|polymarket)[.\s-]+/i, '')
    .replace(/[^\w\s]/g, '')
    .trim();
}

/**
 * Check if two market names refer to the same market
 */
function isSameMarket(name1: string, name2: string): boolean {
  const normalized1 = normalizeMarketName(name1);
  const normalized2 = normalizeMarketName(name2);
  
  // Exact match
  if (normalized1 === normalized2) return true;
  
  // Check if one contains the other (for partial matches)
  if (normalized1.length > 10 && normalized2.length > 10) {
    const words1 = normalized1.split(/\s+/);
    const words2 = normalized2.split(/\s+/);
    
    // If they share significant keywords, consider them the same
    const commonWords = words1.filter(w => w.length > 4 && words2.includes(w));
    if (commonWords.length >= 2) return true;
  }
  
  return false;
}

/**
 * Scan markets for arbitrage opportunities
 * Returns opportunities where price difference > 3%
 */
export function scanArbitrageOpportunities(markets: Market[]): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];
  
  // Group markets by normalized name
  const marketGroups = new Map<string, { kalshi?: Market; polymarket?: Market }>();
  
  markets.forEach(market => {
    const normalizedName = normalizeMarketName(market.name);
    const provider = market.provider?.toLowerCase() || '';
    
    if (!marketGroups.has(normalizedName)) {
      marketGroups.set(normalizedName, {});
    }
    
    const group = marketGroups.get(normalizedName)!;
    
    if (provider.includes('kalshi')) {
      group.kalshi = market;
    } else if (provider.includes('polymarket')) {
      group.polymarket = market;
    }
  });
  
  // Find opportunities
  marketGroups.forEach((group, normalizedName) => {
    if (!group.kalshi || !group.polymarket) return;
    
    const kalshiPrice = group.kalshi.price;
    const polymarketPrice = group.polymarket.price;
    
    if (!kalshiPrice || !polymarketPrice) return;
    
    const priceDiff = Math.abs(kalshiPrice - polymarketPrice);
    const priceDiffPercent = (priceDiff / Math.min(kalshiPrice, polymarketPrice)) * 100;
    
    // Only flag if difference > 3%
    if (priceDiffPercent > 3) {
      const opportunity: ArbitrageOpportunity = {
        marketName: group.kalshi.name || normalizedName,
        kalshiPrice,
        polymarketPrice,
        priceDifference: priceDiff,
        priceDifferencePercent: Math.round(priceDiffPercent * 100) / 100,
        opportunity: kalshiPrice < polymarketPrice 
          ? 'buy-kalshi-sell-polymarket' 
          : 'buy-polymarket-sell-kalshi',
        potentialProfit: Math.round(priceDiffPercent * 10), // Rough estimate: 1% = $10 per $1000
      };
      
      opportunities.push(opportunity);
    }
  });
  
  // Sort by price difference (highest first)
  return opportunities.sort((a, b) => b.priceDifferencePercent - a.priceDifferencePercent);
}

