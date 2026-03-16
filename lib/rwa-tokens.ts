export interface RWATokenConfig {
  /** Symbol of the tokenized stock on Solana, e.g. bAAPL, OPENAI */
  symbol: string;
  /** Human-readable name, e.g. Apple Inc. */
  name: string;
  /** Underlying ticker on the stock exchange, e.g. AAPL */
  underlying: string;
  /** SPL mint address on Solana (fill with the real mint from Jupiter/Token list) */
  mint: string;
  /** Optional category/sector label */
  sector?: string;
  /** Optional "About" description (Jupiter terminal-style) */
  description?: string;
}

// Backed/xStocks + PreStocks — add real SPL mints from https://jup.ag/terminal/stocks or Jupiter token list
export const RWA_TOKENS: RWATokenConfig[] = [
  // —— PreStocks (pre-IPO) ——
  { symbol: 'OPENAI', name: 'OpenAI PreStocks', underlying: 'OPENAI', mint: '', sector: 'Tech' },
  { symbol: 'ANDURIL', name: 'Anduril PreStocks', underlying: 'ANDURIL', mint: '', sector: 'Defense' },
  { symbol: 'SPACEX', name: 'SpaceX PreStocks', underlying: 'SPACEX', mint: '', sector: 'Aerospace' },
  { symbol: 'ANTHROPIC', name: 'Anthropic PreStocks', underlying: 'ANTHROPIC', mint: '', sector: 'Tech' },
  { symbol: 'XAI', name: 'xAI PreStocks', underlying: 'XAI', mint: '', sector: 'Tech' },
  { symbol: 'STRIPE', name: 'Stripe PreStocks', underlying: 'STRIPE', mint: '', sector: 'Fintech' },
  { symbol: 'DISCORD', name: 'Discord PreStocks', underlying: 'DISCORD', mint: '', sector: 'Tech' },
  { symbol: 'DATABRICKS', name: 'Databricks PreStocks', underlying: 'DATABRICKS', mint: '', sector: 'Tech' },
  { symbol: 'PERPLEXITY', name: 'Perplexity PreStocks', underlying: 'PERPLEXITY', mint: '', sector: 'Tech' },
  { symbol: 'FIGURES', name: 'Figure AI PreStocks', underlying: 'FIGURES', mint: '', sector: 'Tech' },
  { symbol: 'EPIC', name: 'Epic Games PreStocks', underlying: 'EPIC', mint: '', sector: 'Gaming' },
  { symbol: 'KRAKEN', name: 'Kraken PreStocks', underlying: 'KRAKEN', mint: '', sector: 'Crypto' },
  { symbol: 'NEURALINK', name: 'Neuralink PreStocks', underlying: 'NEURALINK', mint: '', sector: 'Tech' },
  // —— Backed / xStocks (tokenized public equities) ——
  { symbol: 'bAAPL', name: 'Apple Inc. (tokenized)', underlying: 'AAPL', mint: '', sector: 'Tech' },
  { symbol: 'bTSLA', name: 'Tesla Inc. (tokenized)', underlying: 'TSLA', mint: '', sector: 'Auto' },
  { symbol: 'bSPY', name: 'SPDR S&P 500 (tokenized)', underlying: 'SPY', mint: '', sector: 'ETF' },
  { symbol: 'bGOOGL', name: 'Alphabet Inc. (tokenized)', underlying: 'GOOGL', mint: '', sector: 'Tech' },
  { symbol: 'bAMZN', name: 'Amazon.com Inc. (tokenized)', underlying: 'AMZN', mint: '', sector: 'Tech' },
  { symbol: 'bMSFT', name: 'Microsoft Corp. (tokenized)', underlying: 'MSFT', mint: '', sector: 'Tech' },
  { symbol: 'bNVDA', name: 'NVIDIA Corp. (tokenized)', underlying: 'NVDA', mint: '', sector: 'Tech' },
  { symbol: 'bMETA', name: 'Meta Platforms (tokenized)', underlying: 'META', mint: '', sector: 'Tech' },
];

