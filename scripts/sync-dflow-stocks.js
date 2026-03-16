/* eslint-disable no-console */
/**
 * Sync Dflow-supported stocks into lib/dflow-stocks.json
 *
 * Strategy:
 * - Use your existing RWA stock list (PreStocks, xStock, etc.) from lib/rwa-tokens
 * - Call Dflow's /tokens-with-decimals endpoint to see which of those mints
 *   Dflow can currently trade
 * - Write the intersection to lib/dflow-stocks.json for the app to consume
 *
 * Run with:
 *   DFLOW_API_KEY=... DFLOW_QUOTE_BASE_URL=https://quote-api.dflow.net node scripts/sync-dflow-stocks.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

function loadEnvFile(filename) {
  const root = path.resolve(__dirname, '..');
  const full = path.join(root, filename);
  if (!fs.existsSync(full)) return;
  const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = val;
    }
  }
}

// Try to load .env.local so DFLOW_* vars are available when running via npm script.
loadEnvFile('.env.local');

const API_KEY = process.env.DFLOW_API_KEY;
const QUOTE_BASE =
  process.env.DFLOW_QUOTE_BASE_URL || 'https://quote-api.dflow.net';

if (!API_KEY) {
  console.error('DFLOW_API_KEY is not set (check .env.local).');
  process.exit(1);
}

function fetchTokensWithDecimals() {
  const url = new URL('/tokens-with-decimals', QUOTE_BASE);
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: 'GET',
        headers: {
          'x-api-key': API_KEY,
          'content-type': 'application/json',
        },
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(
              new Error(
                `Dflow /tokens-with-decimals failed (${res.statusCode}): ${
                  data || res.statusMessage
                }`,
              ),
            );
          }
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (err) {
            reject(err);
          }
        });
      },
    );

    req.on('error', (err) => reject(err));
    req.end();
  });
}

async function main() {
  console.log('Fetching Dflow tokens-with-decimals...');
  const tokens = await fetchTokensWithDecimals();

  // tokens: array of [mint, decimals]
  const dflowMints = new Map();
  for (const entry of tokens) {
    if (Array.isArray(entry) && typeof entry[0] === 'string') {
      const mint = entry[0];
      const decimals = typeof entry[1] === 'number' ? entry[1] : undefined;
      dflowMints.set(mint, decimals);
    }
  }

  console.log(
    `Dflow supports ${dflowMints.size} mints; intersecting with rwa-tokens-generated.json...`,
  );

  // Load your generated RWA stock configs (includes PreStocks/xStocks with mints).
  const rwaPath = path.join(__dirname, '..', 'lib', 'rwa-tokens-generated.json');
  const rwaRaw = fs.readFileSync(rwaPath, 'utf8');
  const rwaTokens = JSON.parse(rwaRaw);

  const stocks = [];
  for (const cfg of rwaTokens) {
    if (!cfg.mint) continue;
    const dec = dflowMints.get(cfg.mint);
    if (dec == null) continue;
    stocks.push({
      mint: cfg.mint,
      symbol: cfg.symbol,
      name: cfg.name,
      decimals: dec,
    });
  }

  console.log(`Matched ${stocks.length} RWA stocks supported by Dflow.`);

  const outPath = path.join(__dirname, '..', 'lib', 'dflow-stocks.json');
  fs.writeFileSync(outPath, JSON.stringify(stocks, null, 2));
  console.log(`Wrote ${stocks.length} entries to lib/dflow-stocks.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

