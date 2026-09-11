import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

// Allow running in demo mode without a database URL
const isDemoMode = !databaseUrl;

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

// Create a dummy pool if in demo mode to prevent crashing
export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  (isDemoMode 
    ? ({} as Pool) 
    : new Pool({ connectionString: databaseUrl }));

if (process.env.NODE_ENV !== "production" && !isDemoMode) {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = isDemoMode ? ({} as any) : drizzle(pool);
