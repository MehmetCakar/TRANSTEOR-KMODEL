import { NextRequest, NextResponse } from 'next/server';

export async function POST(_req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('access_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
    sameSite: 'lax',
  });
  return res;
}