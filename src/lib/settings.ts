import { getCloudflareContext } from "@opennextjs/cloudflare";
import { prisma } from "./prisma";
import { ensureDatabaseReady } from "./db-init";

function isOnCloudflare(): boolean {
  try {
    const env = getCloudflareContext().env as unknown as {
      HYPERDRIVE?: { connectionString?: string };
    };
    return !!env?.HYPERDRIVE?.connectionString;
  } catch {
    return false;
  }
}

/**
 * In-memory settings cache — and on Electron/local the choke point that
 * guarantees the database schema exists before anything queries it (see
 * refresh()). Cloudflare skips fee seeding here; deploy seed handles Postgres.
 *
 * Next.js compiles proxy.ts (middleware) into a separate bundle from
 * server actions, each with its OWN module instance and therefore its own
 * copy of `cache` -- a value written via setSetting() in one does not
 * appear in the other's memory. So a cache miss re-reads the database once
 * before concluding a key is really absent, rather than trusting "absent"
 * forever. Once a key has a value, every bundle's cache hits it from
 * memory with no further database round-trips -- the miss path only
 * costs anything for keys that are legitimately never configured.
 */
let cache: Record<string, string> = {};
let migrated = false;

async function refresh(): Promise<void> {
  if (!migrated && !isOnCloudflare()) {
    await ensureDatabaseReady();
    migrated = true;
  }
  const rows = await prisma.setting.findMany();
  cache = Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

let initialized = false;

export async function getSetting(key: string): Promise<string | undefined> {
  if (!initialized) {
    await refresh();
    initialized = true;
  }
  if (cache[key] === undefined) {
    await refresh();
  }
  return cache[key];
}

export async function setSetting(key: string, value: string): Promise<void> {
  await getSetting(key); // ensures refresh()/migration has run at least once
  await prisma.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
  cache[key] = value;
}

export async function hasSetting(key: string): Promise<boolean> {
  return (await getSetting(key)) !== undefined;
}
