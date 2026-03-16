/**
 * Sync RWA/stock tokens from Jupiter Tokens V2 into lib/rwa-tokens-generated.json.
 * Run: JUPITER_API_KEY=your-key node scripts/sync-jupiter-rwa-stocks.js
 * Or set JUPITER_API_KEY in .env.local and run: node scripts/sync-jupiter-rwa-stocks.js
 *
 * 1) Searches Tokens V2 for known symbols (PreStocks + Backed) to get mints.
 * 2) Fetches Tokens V2 category "toptraded" and keeps tokens that look like stocks.
 * 3) Merges with static list from lib/rwa-tokens.ts and writes generated JSON.
 */

const fs = require('fs');
const path = require('path');

function loadEnvFile() {
  const projectRoot = path.resolve(__dirname, '..');
  for (const name of ['.env.local', '.env']) {
    const envPath = path.join(projectRoot, name);
    if (!fs.existsSync(envPath)) continue;
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const match = trimmed.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = value;
      }
    });
    break; // first file wins
  }
}
loadEnvFile();

const JUPITER_API_KEY = process.env.JUPITER_API_KEY || process.env.JUPITER_API_KEY;
const TOKENS_V2_SEARCH = 'https://api.jup.ag/tokens/v2/search';
const TOKENS_V2_CATEGORY = 'https://api.jup.ag/tokens/v2/toptraded/24h';
const TOKENS_V2_TAG = 'https://api.jup.ag/tokens/v2/tag';
const LIMIT_CATEGORY = 150;

// Symbols we want to resolve (same as lib/rwa-tokens.ts)
const KNOWN_SYMBOLS = [
  'OPENAI', 'ANDURIL', 'SPACEX', 'ANTHROPIC', 'XAI', 'STRIPE', 'DISCORD',
  'DATABRICKS', 'PERPLEXITY', 'FIGURES', 'EPIC', 'KRAKEN', 'NEURALINK',
  'bAAPL', 'bTSLA', 'bSPY', 'bGOOGL', 'bAMZN', 'bMSFT', 'bNVDA', 'bMETA',
];

// Static list: symbol -> { name, underlying, sector }
const STATIC_META = {
  OPENAI: { name: 'OpenAI PreStocks', underlying: 'OPENAI', sector: 'Tech' },
  ANDURIL: { name: 'Anduril PreStocks', underlying: 'ANDURIL', sector: 'Defense' },
  SPACEX: { name: 'SpaceX PreStocks', underlying: 'SPACEX', sector: 'Aerospace' },
  ANTHROPIC: { name: 'Anthropic PreStocks', underlying: 'ANTHROPIC', sector: 'Tech' },
  XAI: { name: 'xAI PreStocks', underlying: 'XAI', sector: 'Tech' },
  STRIPE: { name: 'Stripe PreStocks', underlying: 'STRIPE', sector: 'Fintech' },
  DISCORD: { name: 'Discord PreStocks', underlying: 'DISCORD', sector: 'Tech' },
  DATABRICKS: { name: 'Databricks PreStocks', underlying: 'DATABRICKS', sector: 'Tech' },
  PERPLEXITY: { name: 'Perplexity PreStocks', underlying: 'PERPLEXITY', sector: 'Tech' },
  FIGURES: { name: 'Figure AI PreStocks', underlying: 'FIGURES', sector: 'Tech' },
  EPIC: { name: 'Epic Games PreStocks', underlying: 'EPIC', sector: 'Gaming' },
  KRAKEN: { name: 'Kraken PreStocks', underlying: 'KRAKEN', sector: 'Crypto' },
  NEURALINK: { name: 'Neuralink PreStocks', underlying: 'NEURALINK', sector: 'Tech' },
  bAAPL: { name: 'Apple Inc. (tokenized)', underlying: 'AAPL', sector: 'Tech' },
  bTSLA: { name: 'Tesla Inc. (tokenized)', underlying: 'TSLA', sector: 'Auto' },
  bSPY: { name: 'SPDR S&P 500 (tokenized)', underlying: 'SPY', sector: 'ETF' },
  bGOOGL: { name: 'Alphabet Inc. (tokenized)', underlying: 'GOOGL', sector: 'Tech' },
  bAMZN: { name: 'Amazon.com Inc. (tokenized)', underlying: 'AMZN', sector: 'Tech' },
  bMSFT: { name: 'Microsoft Corp. (tokenized)', underlying: 'MSFT', sector: 'Tech' },
  bNVDA: { name: 'NVIDIA Corp. (tokenized)', underlying: 'NVDA', sector: 'Tech' },
  bMETA: { name: 'Meta Platforms (tokenized)', underlying: 'META', sector: 'Tech' },
};

function isStockLike(token) {
  const name = (token.name || '').toLowerCase();
  const symbol = (token.symbol || '').toUpperCase();
  // Strict: only PreStocks/xStocks/Ondo/rStocks and explicit tokenized-stock wording,
  // plus our known whitelist of symbols.
  if (/prestocks?|prestock/.test(name)) return true;
  if (/\bxstocks?\b/.test(name)) return true;
  if (/ondo tokenized|ondo\b/.test(name)) return true;
  if (/\brstocks?\b/.test(name)) return true;
  if (/tokenized (stock|equity|share)/.test(name)) return true;
  if (KNOWN_SYMBOLS.includes(symbol)) return true;
  return false;
}

async function fetchSearch(symbols, apiKey) {
  const query = symbols.slice(0, 100).join(',');
  const res = await fetch(`${TOKENS_V2_SEARCH}?query=${encodeURIComponent(query)}`, {
    headers: { 'x-api-key': apiKey },
  });
  if (!res.ok) throw new Error(`Tokens V2 search failed: ${res.status}`);
  return res.json();
}

async function fetchCategory(apiKey) {
  const res = await fetch(`${TOKENS_V2_CATEGORY}?limit=${LIMIT_CATEGORY}`, {
    headers: { 'x-api-key': apiKey },
  });
  if (!res.ok) throw new Error(`Tokens V2 category failed: ${res.status}`);
  return res.json();
}

async function fetchVerified(apiKey) {
  const res = await fetch(`${TOKENS_V2_TAG}?query=verified`, {
    headers: { 'x-api-key': apiKey },
  });
  if (!res.ok) throw new Error(`Tokens V2 tag(verified) failed: ${res.status}`);
  return res.json();
}

function mergeResults(bySearch, byCategory) {
  const byMint = new Map();
  const bySymbol = new Map();

  for (const t of bySearch) {
    if (!t?.id || !t.symbol) continue;
    byMint.set(t.id, t);
    bySymbol.set((t.symbol || '').toUpperCase(), t);
  }
  for (const t of byCategory) {
    if (!t?.id || !t.symbol) continue;
    if (!byMint.has(t.id)) byMint.set(t.id, t);
    const sym = (t.symbol || '').toUpperCase();
    if (!bySymbol.has(sym)) bySymbol.set(sym, t);
  }

  const out = [];
  const seenMints = new Set();

  // 1) Known symbols: use static meta + mint from Jupiter
  for (const symbol of KNOWN_SYMBOLS) {
    const meta = STATIC_META[symbol];
    const jup = bySymbol.get(symbol);
    const mint = jup?.id || '';
    out.push({
      symbol,
      name: meta?.name || jup?.name || symbol,
      underlying: meta?.underlying || symbol.replace(/^b/, ''),
      mint,
      sector: meta?.sector,
    });
    if (mint) seenMints.add(mint);
  }

  // 2) Extra from category that look like stocks and weren't in our list
  for (const t of byCategory) {
    if (!t?.id || !isStockLike(t)) continue;
    const sym = (t.symbol || '').toUpperCase();
    if (KNOWN_SYMBOLS.includes(sym)) continue;
    if (seenMints.has(t.id)) continue;
    seenMints.add(t.id);
    const underlying = sym.startsWith('B') && sym.length > 1 ? sym.slice(1) : sym;
    out.push({
      symbol: sym,
      name: t.name || sym,
      underlying: underlying,
      mint: t.id,
      sector: undefined,
    });
  }

  return out;
}

async function main() {
  if (!JUPITER_API_KEY) {
    console.error('Set JUPITER_API_KEY in .env.local or env to run this script.');
    process.exit(1);
  }

  console.log('Fetching from Jupiter Tokens V2...');
  let bySearch = [];
  try {
    bySearch = await fetchSearch(KNOWN_SYMBOLS, JUPITER_API_KEY);
    if (!Array.isArray(bySearch)) bySearch = [];
    console.log(`  Search: ${bySearch.length} tokens for known symbols`);
  } catch (e) {
    console.warn('  Search failed:', e.message);
  }

  let byCategory = [];
  try {
    byCategory = await fetchCategory(JUPITER_API_KEY);
    if (!Array.isArray(byCategory)) byCategory = [];
    const stockLike = byCategory.filter(isStockLike);
    console.log(`  Category toptraded: ${byCategory.length} total, ${stockLike.length} stock-like`);
    byCategory = stockLike;
  } catch (e) {
    console.warn('  Category failed:', e.message);
  }

  const merged = mergeResults(bySearch, byCategory);
  // Pull the full verified universe and append stock-like ones (this is how we reach 200+)
  try {
    const verified = await fetchVerified(JUPITER_API_KEY);
    const verifiedArr = Array.isArray(verified) ? verified : [];
    const stockLike = verifiedArr.filter(isStockLike);
    console.log(`  Tag verified: ${verifiedArr.length} total, ${stockLike.length} stock-like`);
    // Merge in any new stock-like tokens not already present
    const existingMints = new Set(merged.map((m) => m.mint).filter(Boolean));
    for (const t of stockLike) {
      if (!t?.id || existingMints.has(t.id)) continue;
      const sym = (t.symbol || '').toUpperCase();
      existingMints.add(t.id);
      const underlying = sym.startsWith('B') && sym.length > 1 ? sym.slice(1) : sym.endsWith('X') ? sym.slice(0, -1) : sym;
      merged.push({
        symbol: sym,
        name: t.name || sym,
        underlying,
        mint: t.id,
        sector: undefined,
      });
    }
  } catch (e) {
    console.warn('  Tag verified failed:', e.message);
  }
  const withMint = merged.filter((t) => t.mint);
  console.log(`Merged: ${merged.length} entries, ${withMint.length} with mints`);

  const outPath = path.join(process.cwd(), 'lib', 'rwa-tokens-generated.json');
  fs.writeFileSync(outPath, JSON.stringify(merged, null, 2), 'utf8');
  console.log(`Wrote ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
