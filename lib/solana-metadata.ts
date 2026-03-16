import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { Metadata } from '@metaplex-foundation/mpl-token-metadata';

const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL ||
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  clusterApiUrl('mainnet-beta');

const METADATA_PROGRAM_ID = new PublicKey(
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
);

export type MintMetadata = {
  mint: string;
  name: string | null;
  symbol: string | null;
  uri: string | null;
  image: string | null;
};

const metaCache = new Map<string, { value: MintMetadata; updatedAt: number }>();
const META_TTL_MS = 30 * 60 * 1000;

async function fetchJsonImage(uri: string): Promise<string | null> {
  try {
    const res = await fetch(uri, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    const img = json?.image;
    return typeof img === 'string' && img.length > 0 ? img : null;
  } catch {
    return null;
  }
}

export async function getMintMetadata(mint: string): Promise<MintMetadata> {
  const key = mint;
  const now = Date.now();
  const cached = metaCache.get(key);
  if (cached && now - cached.updatedAt < META_TTL_MS) return cached.value;

  const conn = new Connection(SOLANA_RPC_URL, { commitment: 'confirmed' });
  const mintPk = new PublicKey(mint);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('metadata'), METADATA_PROGRAM_ID.toBuffer(), mintPk.toBuffer()],
    METADATA_PROGRAM_ID,
  );

  let name: string | null = null;
  let symbol: string | null = null;
  let uri: string | null = null;
  let image: string | null = null;

  try {
    const md = await Metadata.fromAccountAddress(conn as any, pda);
    name = md?.data?.name ? String(md.data.name).replace(/\0/g, '').trim() : null;
    symbol = md?.data?.symbol ? String(md.data.symbol).replace(/\0/g, '').trim() : null;
    uri = md?.data?.uri ? String(md.data.uri).replace(/\0/g, '').trim() : null;
  } catch {
    // ignore
  }

  if (uri) {
    image = await fetchJsonImage(uri);
  }

  const value: MintMetadata = { mint, name, symbol, uri, image };
  metaCache.set(key, { value, updatedAt: now });
  return value;
}

