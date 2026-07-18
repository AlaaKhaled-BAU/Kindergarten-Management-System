import fs from "fs/promises";
import path from "path";

export const LOG_TYPES = {
  receipt_created: "receipt_created",
  receipt_canceled: "receipt_canceled",
  login: "login",
  import: "import",
  export: "export",
  backup_created: "backup_created",
  error: "error",
  student_created: "student_created",
  payment_processed: "payment_processed",
} as const;

export type LogType = (typeof LOG_TYPES)[keyof typeof LOG_TYPES];

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

    const logPath = getLogPath();

    let entries: LogEntry[] = [];
    try {
      const existing = await fs.readFile(logPath, "utf-8");
      entries = JSON.parse(existing);
    } catch {
      entries = [];
    }

    entries.push(entry);
    await fs.writeFile(logPath, JSON.stringify(entries, null, 2), "utf-8");
  } catch {
    // Silently fail — logging must never break application flow
  }
}
