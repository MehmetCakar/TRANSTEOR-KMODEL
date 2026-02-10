// app/api/auth/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import { parseJWT } from "@/lib/jwt";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;

  if (!token) {
    return NextResponse.json({ error: "no auth" }, { status: 401 });
  }

  try {
    const email = String(parseJWT(token)).trim().toLowerCase();
    return NextResponse.json({ email });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "invalid token" }, { status: 401 });
  }
}