import fs from "fs/promises";
import path from "path";

interface LogEntry {
  timestamp: string;
  type: string;
  details: Record<string, unknown>;
}

function getLogPath(): string {
  const logsDir = path.join(process.cwd(), "Logs");
  const today = new Date().toISOString().slice(0, 10);
  return path.join(logsDir, `log_${today}.json`);
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
    const logsDir = path.join(process.cwd(), "Logs");
    await fs.mkdir(logsDir, { recursive: true });

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
