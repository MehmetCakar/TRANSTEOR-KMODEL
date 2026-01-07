// app/api/logout/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  // access_token çerezini sil
  const res = NextResponse.json({ ok: true });
  res.cookies.set("access_token", "", {
    httpOnly: true,
    path: "/",
    expires: new Date(0), // geçmiş bir tarih -> tarayıcı siler
  });
  return res;
}