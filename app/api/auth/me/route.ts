import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { parseJWT } from '@/lib/auth';

export async function GET(_req: NextRequest) {
  const cookieStore = cookies();
  const token = cookieStore.get('access_token')?.value;

  if (!token) {
    return NextResponse.json(
      { error: 'no auth' },
      { status: 401 }
    );
  }

  try {
    const email = parseJWT(token);
    return NextResponse.json({ email });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: 'invalid token' },
      { status: 401 }
    );
  }
}