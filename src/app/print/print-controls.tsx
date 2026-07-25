"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";

/**
 * Triggers the browser's print dialog once webfonts have actually loaded --
 * Chromium can rasterize a print preview before a custom @font-face swap
 * finishes, silently falling back to a system font for Arabic glyphs.
 */
export function AutoPrint() {
  useEffect(() => {
    document.fonts.ready.then(() => {
      setTimeout(() => window.print(), 100);
    });
  }, []);
  return null;
}

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden fixed top-4 start-4 flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium shadow-lg"
    >
      <Printer className="size-4" />
      طباعة / حفظ كـ PDF
    </button>
  );
}
