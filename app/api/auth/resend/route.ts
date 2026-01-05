import { NextRequest, NextResponse } from 'next/server';
import { resendVerification } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = body?.email?.toString().trim();

  if (!email) {
    return NextResponse.json(
      { error: 'email required' },
      { status: 400 }
    );
  }

  try {
    await resendVerification(email);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: 'could not resend code' },
      { status: 400 }
    );
  }
}