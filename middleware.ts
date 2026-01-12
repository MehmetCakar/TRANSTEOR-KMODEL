// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { parseJWT } from "@/lib/jwt";

function isAdminEmail(email: string) {
  const admin = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return !!admin && email.trim().toLowerCase() === admin;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/admin")) return NextResponse.next();

  const token = req.cookies.get("access_token")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const email = parseJWT(token);

    if (!isAdminEmail(email)) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/admin/:path*"],
};