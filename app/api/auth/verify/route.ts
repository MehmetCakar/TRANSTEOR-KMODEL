import { NextRequest, NextResponse } from 'next/server';
import { ErrCodeInvalid, verifyUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  const email = body?.email?.toString().trim();
  const code = body?.code?.toString().trim();

  if (!email || !code) {
    return NextResponse.json(
      { error: 'email & code required' },
      { status: 400 }
    );
  }

  try {
    await verifyUser(email, code);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err.message === ErrCodeInvalid) {
      return NextResponse.json(
        { error: 'invalid or expired code' },
        { status: 400 }
      );
    }
    console.error(err);
    return NextResponse.json(
      { error: 'internal error' },
      { status: 500 }
    );
  }
}

