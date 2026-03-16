export type StockDirectoryEntry = {
  /** SPL mint */
  mint: string;
  /** Display symbol */
  symbol: string;
  /** Optional override description (wins over external sources) */
  description?: string;
  /** Optional official websites (wins over external sources) */
  websites?: string[];
  /** Optional socials */
  twitter?: string;
  discord?: string;
  telegram?: string;
};

/**
 * Local overrides for stock profiles.
 * Keep this minimal; the API will merge GeckoTerminal + Jupiter Tokens V2 by default.
 */
export const STOCK_DIRECTORY: StockDirectoryEntry[] = [];

