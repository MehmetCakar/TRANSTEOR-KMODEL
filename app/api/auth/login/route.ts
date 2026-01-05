import { NextRequest, NextResponse } from 'next/server';
import {
  ErrInvalidCredentials,
  ErrNotVerified,
  issueJWT,
  loginUser,
} from '@/lib/auth';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  const email = body?.email?.toString().trim();
  const password = body?.password?.toString();

  if (!email || !password) {
    return NextResponse.json(
      { error: 'email & password required' },
      { status: 400 }
    );
  }

  try {
    await loginUser(email, password);

    const ttlMs = 30 * 24 * 60 * 60 * 1000; // 30 gün
    const token = issueJWT(email, ttlMs);

    const res = NextResponse.json({ ok: true });

    res.cookies.set('access_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: ttlMs / 1000,
      path: '/',
      sameSite: 'lax',
    });

    return res;
  } catch (err: any) {
    if (err.message === ErrInvalidCredentials) {
      return NextResponse.json(
        { error: 'invalid email or password' },
        { status: 401 }
      );
    }
    if (err.message === ErrNotVerified) {
      return NextResponse.json(
        { error: 'account not verified' },
        { status: 409 }
      );
    }
    console.error(err);
    return NextResponse.json(
      { error: 'internal error' },
      { status: 500 }
    );
  }
}