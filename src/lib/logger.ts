import fs from "fs/promises";
import path from "path";

interface LogEntry {
  timestamp: string;
  type: string;
  details: Record<string, unknown>;
}

// KG_DATA_DIR (set by main.js to app.getPath("userData")) keeps runtime
// data out of the install directory, which is read-only for a normal user
// under "C:\Program Files". Falls back to cwd for `next dev`.
function getLogsDir(): string {
  return path.join(process.env.KG_DATA_DIR ?? process.cwd(), "Logs");
}

function getLogPath(): string {
  const today = new Date().toISOString().slice(0, 10);
  return path.join(getLogsDir(), `log_${today}.json`);
}

/**
 * Appends one JSON object per line (JSON Lines) rather than reading the
 * whole file into an array and rewriting it. A read-modify-write on a
 * single JSON array is a real race under concurrent requests: two
 * overlapping calls can both read the same stale content, and the later
 * write silently clobbers the earlier entry. fs.appendFile is atomic
 * enough for these small writes and removes that race outright.
 */
export async function logEvent(
  type: string,
  details: Record<string, unknown>
): Promise<void> {
  try {
    await fs.mkdir(getLogsDir(), { recursive: true });

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      type,
      details,
    };

    await fs.appendFile(getLogPath(), JSON.stringify(entry) + "\n", "utf-8");
  } catch {
    // Silently fail -- logging must never break application flow
  }
}
