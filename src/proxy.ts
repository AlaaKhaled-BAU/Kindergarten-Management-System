import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyRoleCookie } from "@/lib/auth";
import { hasSetting } from "@/lib/settings";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // First boot: no admin password has been set yet anywhere (nothing to
  // check it against, since it now lives in the database, not a build-time
  // env var). Force the setup screen before anything else is reachable.
  const configured = await hasSetting("adminPasswordHash");
  if (path === "/setup") {
    if (configured) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }
  if (!configured) {
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  const role = await verifyRoleCookie(request.cookies.get("auth_role")?.value);

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
