/* eslint-disable no-console */
/**
 * Build lib/dflow-stocks.json from:
 * - dflow-tokens.json (downloaded once via curl from Dflow /tokens)
 * - lib/rwa-tokens-generated.json (your curated PreStocks/xStocks list with mints)
 *
 * Usage (from repo root):
 *   node scripts/build-dflow-stocks-from-file.js
 *
 * Make sure you've already run:
 *   curl -s 'https://e.quote-api.dflow.net/tokens' \
 *     -H 'x-api-key: YOUR_KEY' \
 *     -o dflow-tokens.json
 */

const fs = require('fs');
const path = require('path');

function main() {
  const root = path.resolve(__dirname, '..');

  const dflowTokensPath = path.join(root, 'dflow-tokens.json');
  if (!fs.existsSync(dflowTokensPath)) {
    console.error('dflow-tokens.json not found. Run the curl command first.');
    process.exit(1);
  }

  console.log('Loading Dflow tokens from dflow-tokens.json...');
  const dflowRaw = fs.readFileSync(dflowTokensPath, 'utf8');
  const dflowTokens = JSON.parse(dflowRaw);
  if (!Array.isArray(dflowTokens)) {
    console.error('dflow-tokens.json is not an array as expected.');
    process.exit(1);
  }

  const dflowSet = new Set(dflowTokens);
  console.log(`Dflow token count: ${dflowSet.size}`);

  const rwaPath = path.join(root, 'lib', 'rwa-tokens-generated.json');
  if (!fs.existsSync(rwaPath)) {
    console.error('lib/rwa-tokens-generated.json not found.');
    process.exit(1);
  }

  console.log('Loading RWA tokens from lib/rwa-tokens-generated.json...');
  const rwaRaw = fs.readFileSync(rwaPath, 'utf8');
  const rwaTokens = JSON.parse(rwaRaw);

  if (!Array.isArray(rwaTokens)) {
    console.error('rwa-tokens-generated.json is not an array as expected.');
    process.exit(1);
  }

  const stocks = [];
  for (const cfg of rwaTokens) {
    if (!cfg || typeof cfg !== 'object') continue;
    if (!cfg.mint) continue;
    if (!dflowSet.has(cfg.mint)) continue;
    stocks.push({
      mint: cfg.mint,
      symbol: cfg.symbol,
      name: cfg.name,
      // We don't have decimals here; you can fill them later or
      // extend this script to use /tokens-with-decimals if needed.
    });
  }

  console.log(`Matched ${stocks.length} RWA tokens that are tradable on Dflow.`);

  const outPath = path.join(root, 'lib', 'dflow-stocks.json');
  fs.writeFileSync(outPath, JSON.stringify(stocks, null, 2));
  console.log(`Wrote ${stocks.length} entries to lib/dflow-stocks.json`);
}

main();

