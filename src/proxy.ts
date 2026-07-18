import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const role = request.cookies.get("auth_role")?.value;
  const path = request.nextUrl.pathname;

  if (path === "/login") {
    if (role) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!role || (role !== "admin" && role !== "teacher")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (path.startsWith("/reports") && role !== "admin") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|fonts|favicon.ico).*)"],
};
