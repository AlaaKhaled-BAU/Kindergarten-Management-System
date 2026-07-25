import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "إدارة الروضة",
  description: "نظام إدارة الروضة",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className="font-sans">
      <body className="min-h-screen bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
