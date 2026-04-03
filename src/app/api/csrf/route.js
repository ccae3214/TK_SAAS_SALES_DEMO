import crypto from 'crypto';
import { NextResponse } from 'next/server';

export async function GET() {
  const csrfToken = crypto.randomBytes(32).toString('hex');

  const res = NextResponse.json({ csrfToken });
  res.cookies.set('csrf-token', csrfToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60, // 1 hour
  });

  return res;
}
