"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { exportStudentBalances } from "@/app/actions/export-actions";
import { triggerDownload } from "@/lib/download-utils";
import { errorMessage } from "@/lib/utils";
import { Download } from "lucide-react";

export function ExportBalancesButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setError(null);
    setPending(true);
    try {
      const result = await exportStudentBalances();
      triggerDownload(result.base64, result.filename);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <Button variant="outline" onClick={handleExport} disabled={pending}>
        <Download className="me-2 size-4" />
        {pending ? "جارٍ التصدير..." : "تصدير الأرصدة"}
      </Button>
    </div>
  );
}
