export type Tier = {
  id?: number;
  name: string;
  accountSize: number;
  fee: number;
  target: string;
};

export type MarketOutcome = {
  id: string;
  name: string;
  price: number; 
  volume?: number;
  tokenId?: string;
};

export type Market = {
  id: string;
  conditionId: string; 
  provider: "Polymarket" | "Kalshi";
  /** Jupiter Prediction API compatible market identifier (slug/event_ticker). */
  jupMarketId?: string;
  name: string;
  price: number; 
  yesPrice: number;
  noPrice: number;
  outcomes?: MarketOutcome[];
  marketType?: string; // e.g., "Moneyline", "Totals", "Both Team Score", "Spreads"
  eventTitle?: string; // The parent event title
  change?: number;
  asOf?: string;
  resolutionDate?: string;
  description?: string;
  imageUrl: string; 
  polymarketUrl: string;
  kalshiUrl?: string; 
  slug: string;
  volume: number; 
  volumeFormatted: string; 
  category: string;
  last_updated: string;
};

export type Position = {
  id: string;
  marketId: string;
  marketName: string;
  outcome?: string;
  provider: "Polymarket" | "Kalshi";
  side: "YES" | "NO";
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  externalUrl?: string;
};

export type DashboardData = {
  currentEquity: number;
  cashBalance: number;
  dayStartBalance: number;
  dailyDrawdownPct: number;
  positions: Position[];
  tiers: Tier[];
  initialBalance?: number;
  accountStatus?: string;
  failReason?: string | null;
  subscriptionId?: number;
  unrealizedPnl?: number;
};
