import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center p-4">
      <h1 className="text-3xl font-bold">404</h1>
      <p className="text-muted-foreground">الصفحة المطلوبة غير موجودة</p>
      <Button render={<Link href="/">العودة إلى لوحة القيادة</Link>} />
    </div>
  );
}
