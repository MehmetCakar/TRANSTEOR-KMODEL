import { NextRequest, NextResponse } from "next/server";
import { ErrEmailInUse, registerUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  const email = body?.email?.toString().trim();
  const password = body?.password?.toString();

  if (!email || !password) {
    return NextResponse.json({ error: "email & password required" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "password too short" }, { status: 400 });
  }

  try {
    const role = isAdminEmail(email) ? "ADMIN" : "USER";
    await registerUser(email, password, role);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err.message === ErrEmailInUse) {
      return NextResponse.json({ error: "email already registered" }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}