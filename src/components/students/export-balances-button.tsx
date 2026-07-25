"use client";

import { Button } from "@/components/ui/button";
import { exportStudentBalances } from "@/app/actions/export-actions";
import { triggerDownload } from "@/lib/download-utils";
import { Download } from "lucide-react";

export function ExportBalancesButton() {
  async function handleExport() {
    const result = await exportStudentBalances();
    triggerDownload(result.base64, result.filename);
  }

  return (
    <Button variant="outline" onClick={handleExport}>
      <Download className="me-2 size-4" />
      تصدير الأرصدة
    </Button>
  );
}
