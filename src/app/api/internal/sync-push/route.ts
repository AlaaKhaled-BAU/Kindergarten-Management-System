import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { logEvent } from "@/lib/logger";
import { readSyncState, writeSyncState } from "@/lib/sync-state";

/**
 * Called only by main.js's own before-quit handler (Authorization checked
 * against INTERNAL_SYNC_TOKEN, a random secret generated per launch and
 * passed to this process's env -- never reaches a browser or another
 * device). Runs here, inside the server process, rather than in main.js
 * directly, so it can reuse the live `prisma` connection for VACUUM INTO --
 * same atomic-snapshot technique as createBackup() in backup-actions.ts.
 */
export async function POST(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.INTERNAL_SYNC_TOKEN}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const state = readSyncState();
  if (!state.workerUrl || !state.token) {
    return NextResponse.json({ skipped: "not configured" });
  }

  const snapshotPath = path.join(
    process.env.KG_DATA_DIR ?? process.cwd(),
    "sync-push.tmp.db"
  );

  try {
    await prisma.$executeRawUnsafe(`VACUUM INTO ?`, snapshotPath);
    const body = await fs.readFile(snapshotPath);

    const res = await fetch(state.workerUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${state.token}`,
        ...(state.lastEtag ? { "If-Match": state.lastEtag } : {}),
      },
      body,
      signal: AbortSignal.timeout(15_000),
    });

    if (res.status === 412) {
      await logEvent("sync_push_conflict", {});
      return NextResponse.json({ skipped: "remote changed since last pull" });
    }
    if (!res.ok) {
      throw new Error(`push failed: ${res.status}`);
    }

    const { etag } = await res.json();
    writeSyncState({ lastEtag: etag });
    await logEvent("sync_push_success", {});
    return NextResponse.json({ success: true });
  } catch (error) {
    await logEvent("error", {
      action: "syncPush",
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "push failed" }, { status: 500 });
  } finally {
    await fs.unlink(snapshotPath).catch(() => {});
  }
}
