"use client";

import { Button } from "@/components/ui/button";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <h2 className="text-xl font-bold">حدث خطأ غير متوقع</h2>
      <p className="text-muted-foreground">
        تعذّر إتمام العملية. يمكنك المحاولة مرة أخرى.
      </p>
      <Button onClick={reset}>إعادة المحاولة</Button>
    </div>
  );
}
