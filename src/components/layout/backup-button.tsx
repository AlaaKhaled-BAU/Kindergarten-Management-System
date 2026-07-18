"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createBackup } from "@/app/actions/backup-actions";
import { HardDrive } from "lucide-react";

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
      if (result.success) {
        setMessage({
          type: "success",
          text: `تم إنشاء النسخة الاحتياطية: ${result.filePath}`,
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
