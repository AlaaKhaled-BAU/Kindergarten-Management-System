"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createBackup } from "@/app/actions/backup-actions";
import { HardDrive } from "lucide-react";

function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

export function BackupButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function handleBackup() {
    setLoading(true);
    setMessage(null);

    try {
      const result = await createBackup();
      if (result.success && result.download) {
        const blob = result.download.base64
          ? base64ToBlob(result.download.base64, result.download.mime)
          : new Blob([result.download.text ?? ""], {
              type: result.download.mime,
            });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.fileName ?? "backup";
        a.click();
        URL.revokeObjectURL(url);
        setMessage({
          type: "success",
          text: `تم إنشاء النسخة الاحتياطية وبدء التحميل: ${result.fileName}`,
        });
      } else {
        setMessage({
          type: "error",
          text: result.error ?? "فشل إنشاء النسخة الاحتياطية",
        });
      }
    } catch {
      setMessage({
        type: "error",
        text: "فشل إنشاء النسخة الاحتياطية",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-2">
      <Button
        variant="ghost"
        className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
        onClick={handleBackup}
        disabled={loading}
      >
        <HardDrive className="size-4" />
        {loading ? "جاري النسخ..." : "نسخ احتياطي"}
      </Button>
      {message && (
        <p
          className={
            message.type === "success"
              ? "px-2 pt-1 text-xs text-green-600"
              : "px-2 pt-1 text-xs text-destructive"
          }
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
