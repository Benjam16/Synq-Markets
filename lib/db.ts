import { Pool, QueryResult } from "pg";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error("DATABASE_URL env var is required for server routes");
    }

    const sslMode = process.env.PGSSLMODE;

    // Check if using connection pooler (pooler.supabase.com) or direct connection
    const isPooler = connectionString.includes('pooler.supabase.com');
    
    // For connection pooler, SSL is handled automatically, but we still need to configure it
    // For direct connections, use PGSSLMODE setting
    const sslConfig = isPooler 
      ? { rejectUnauthorized: false } // Pooler requires SSL but handles it automatically
      : (sslMode === "require" 
          ? { rejectUnauthorized: false }
          : undefined);

    // Optimized connection pool with better settings for performance
    // Pooler connections need different settings than direct connections
    pool = new Pool({
      connectionString,
      ssl: sslConfig,
      // Connection pool optimization
      max: isPooler ? 10 : 20, // Pooler has lower max connections
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
      // Statement timeout (prevent long-running queries)
      statement_timeout: 10000, // 10 seconds
    });
  }
  
  return pool;
}

export function getClient() {
  return getPool().connect();
}

export function query<T extends Record<string, any> = Record<string, any>>(text: string, params?: any[]): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params);
}


