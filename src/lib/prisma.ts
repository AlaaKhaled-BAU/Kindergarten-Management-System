import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getConnectionString(): string {
  try {
    const hd = (
      getCloudflareContext().env as unknown as {
        HYPERDRIVE?: { connectionString?: string };
      }
    ).HYPERDRIVE;
    if (hd?.connectionString) return hd.connectionString;
  } catch {
    // Not running on Cloudflare (local dev, Electron, standalone node).
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  return connectionString;
}

function createClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: getConnectionString(),
    // maxUses: 1 — Cloudflare recycles/freezes isolates and silently kills
    // idle sockets; a pooled connection reused across requests hangs forever
    // (verified 2026-08-01). Evict the client synchronously at release so
    // every request opens a fresh connection (cheap via Hyperdrive).
    max: 1,
    idleTimeoutMillis: 0,
    maxUses: 1,
    connectionTimeoutMillis: 10000,
    query_timeout: 30000,
  });
  return new PrismaClient({ adapter });
}

function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient();
  }
  return globalForPrisma.prisma;
}

// Lazy singleton. `next build` evaluates module top-level code for page-data
// collection (e.g. /api/internal/sync-push) with NO env/DATABASE_URL and NO
// Cloudflare context -- constructing eagerly there throws and fails CI
// builds. Defer real construction until the first property access (first
// query at runtime).
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
}) as PrismaClient;
