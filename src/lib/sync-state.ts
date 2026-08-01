import fs from "fs";
import path from "path";

export interface SyncState {
  workerUrl?: string;
  token?: string;
  lastEtag?: string;
}

/**
 * Deliberately a plain file next to the db, not a Setting row: main.js reads
 * this before Prisma/the server exist (to pull pre-start, before anything
 * has the db file open), and it must survive the db file itself being
 * replaced wholesale by a pull.
 */
function statePath(): string {
  return path.join(process.env.KG_DATA_DIR ?? process.cwd(), "sync-state.json");
}

export function readSyncState(): SyncState {
  try {
    return JSON.parse(fs.readFileSync(statePath(), "utf-8"));
  } catch {
    return {};
  }
}

export function writeSyncState(patch: Partial<SyncState>): void {
  const next = { ...readSyncState(), ...patch };
  fs.writeFileSync(statePath(), JSON.stringify(next, null, 2));
}
