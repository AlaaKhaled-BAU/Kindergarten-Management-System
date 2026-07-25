"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { logout } from "@/app/actions/auth-actions";
import {
  LayoutDashboard,
  Users,
  Banknote,
  TrendingUp,
  Receipt,
  Wallet,
  FileText,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { BackupButton } from "@/components/layout/backup-button";
import { useState } from "react";

const navigation = [
  { name: "لوحة القيادة", href: "/", icon: LayoutDashboard, role: "admin" },
  { name: "الطلاب", href: "/students", icon: Users, role: "all" },
  { name: "المدفوعات والإيصالات", href: "/payments", icon: Banknote, role: "all" },
  { name: "الإيرادات", href: "/revenues", icon: TrendingUp, role: "all" },
  { name: "المصروفات", href: "/expenses", icon: Receipt, role: "all" },
  { name: "الرسوم الدراسية", href: "/fees", icon: Wallet, role: "admin" },
  { name: "التقارير", href: "/reports", icon: FileText, role: "admin" },
];

interface SidebarProps {
  role: string;
}

function NavLinks({
  role,
  pathname,
  onNavigate,
}: {
  role: string;
  pathname: string;
  onNavigate: () => void;
}) {
  const filteredNav = navigation.filter(
    (item) => item.role === "all" || role === "admin"
  );

  return (
    <nav className="flex flex-col gap-1 px-2">
      {filteredNav.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <item.icon className="size-4 shrink-0" />
            {item.name}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile header */}
      <div className="flex items-center justify-between border-b px-4 py-3 lg:hidden">
        <span className="text-lg font-bold">إدارة الروضة</span>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <Button variant="ghost" size="icon" aria-label="فتح القائمة">
                <Menu className="size-5" />
              </Button>
            }
          />
          <SheetContent side="right" className="w-64 p-0" showCloseButton={false}>
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span className="text-lg font-bold">إدارة الروضة</span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="إغلاق القائمة"
                onClick={() => setOpen(false)}
              >
                <X className="size-5" />
              </Button>
            </div>
            <div className="py-4">
              <NavLinks
                role={role}
                pathname={pathname}
                onNavigate={() => setOpen(false)}
              />
            </div>
            <div className="border-t p-2">
              <BackupButton />
              <form action={logout}>
                <Button
                  type="submit"
                  variant="ghost"
                  className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
                  onClick={() => setOpen(false)}
                >
                  <LogOut className="size-4" />
                  تسجيل الخروج
                </Button>
              </form>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-e bg-card h-screen sticky top-0">
        <div className="flex items-center gap-2 border-b px-4 py-4">
          <LayoutDashboard className="size-5 text-primary shrink-0" />
          <span className="text-lg font-bold truncate">إدارة الروضة</span>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <NavLinks
            role={role}
            pathname={pathname}
            onNavigate={() => {}}
          />
        </div>
        <div className="border-t p-2">
          <BackupButton />
          <form action={logout}>
            <Button
              type="submit"
              variant="ghost"
              className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
            >
              <LogOut className="size-4" />
              تسجيل الخروج
            </Button>
          </form>
        </div>
      </aside>
    </>
  );
}
