export const runtime = 'nodejs';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-bold text-white tracking-tight mt-10 mb-3">
      {children}
    </h2>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#1A1A1A] bg-white/[0.02] p-5">
      <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
        {title}
      </div>
      <div className="text-sm text-slate-300 leading-relaxed">{children}</div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-white/10 bg-white/[0.03] text-[11px] text-slate-300 font-mono">
      {children}
    </span>
  );
}

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Docs</h1>
          <p className="text-slate-400 text-sm mt-2 leading-relaxed">
            Synq is a wallet-native platform for predictions, a unified activity
            terminal, tokenized RWAs, and Bags tokens. This page explains what
            each section does, where data comes from, and how trading is routed.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card title="Predictions">
            Trade prediction markets from <b>Polymarket</b> and <b>Kalshi</b>.
            Markets, pricing, and activity are pulled from their APIs and shown
            in the Markets UI and Terminal.
          </Card>
          <Card title="Terminal">
            A live, unified feed that merges activity across providers and
            surfaces large trades, price changes, and fast-trade entry points.
            Use provider filters to focus on <Pill>POLY</Pill>, <Pill>KALSHI</Pill>,{' '}
            <Pill>RWA</Pill>, or <Pill>BAGS</Pill>.
          </Card>
          <Card title="RWAs">
            Tokenized real-world assets (stocks) traded via <b>Dflow</b>. Prices
            and charts come from market data providers; execution and live
            receive quotes are from Dflow.
          </Card>
          <Card title="Bags">
            Discover and trade Bags tokens. The Bags screener shows tokens with{' '}
            <b>24h trading volume</b>. Swaps are executed via the Bags API and
            signed by the connected wallet.
          </Card>
        </div>

        <SectionTitle>How trading works</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card title="RWA trading (Dflow)">
            Quotes are requested from Dflow, then a transaction (or swap
            instructions) is returned and signed by your wallet. Amount scaling
            uses mint decimals to avoid 10×/100× errors.
          </Card>
          <Card title="Bags trading (Bags API)">
            Quotes are requested from Bags <Pill>GET /trade/quote</Pill>. On
            execute, Synq calls <Pill>POST /trade/swap</Pill> to receive a ready
            transaction. Your wallet signs and broadcasts it on Solana.
          </Card>
        </div>

        <SectionTitle>Data sources</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card title="Market stats, volume, liquidity">
            Bags/RWAs charts and 24h market stats are derived primarily from
            GeckoTerminal where available. Some tokens (especially new ones)
            may have missing market cap/FDV/24h change until indexed upstream.
          </Card>
          <Card title="Core prices">
            SOL and USDC reference prices are fetched from CoinGecko for USD
            notional display and UI context.
          </Card>
        </div>

        <SectionTitle>Terminal provider balance</SectionTitle>
        <Card title="Feed diversity">
          The backend balances Polymarket and Kalshi so one venue doesn’t take
          over the feed, and the client merges in RWA and Bags activity buffers
          so those trades stay visible alongside predictions.
        </Card>

        <SectionTitle>Pages</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card title="Markets">
            <Pill>/markets</Pill> — browse Polymarket + Kalshi markets and
            explore prices and outcomes.
          </Card>
          <Card title="Terminal">
            <Pill>/terminal</Pill> — live activity feed with fast-trade entry.
          </Card>
          <Card title="RWAs">
            <Pill>/stocks</Pill> — RWA screener + details + Dflow trading.
          </Card>
          <Card title="Bags">
            <Pill>/bags</Pill> — Bags token list + Bags trading modal.
          </Card>
        </div>

        <div className="mt-10 text-xs text-slate-600">
          Tip: If something looks stale, refresh — some endpoints cache for a
          short time to keep the UI snappy and avoid rate limits.
        </div>
      </div>
    </div>
  );
}

