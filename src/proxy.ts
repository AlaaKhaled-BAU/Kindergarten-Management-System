import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyRoleCookie } from "@/lib/auth";

export function proxy(request: NextRequest) {
  const role = verifyRoleCookie(request.cookies.get("auth_role")?.value);
  const path = request.nextUrl.pathname;

  if (path === "/login") {
    if (role) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!role) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // "/" is the financial KPI dashboard — Admin-only, same as /reports.
  if ((path === "/" || path.startsWith("/reports")) && role !== "admin") {
    return NextResponse.redirect(new URL("/students", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|fonts|favicon.ico).*)"],
};
