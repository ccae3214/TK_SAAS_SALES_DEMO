import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  const lineUserId = session?.user?.lineUserId;
  if (!lineUserId) {
    return NextResponse.json({ error: 'Sign in with LINE first' }, { status: 401 });
  }
  return NextResponse.json({ lineUserId });
}
