import { NextResponse } from 'next/server';
import { get } from '@/lib/db';
import { isLoginLocked, recordLoginFailure, clearLoginFailures, LOGIN_LOCK_MINUTES } from '@/lib/login-rate-limit';
import { createShopSessionToken, shopSessionCookie, isHttpsRequest } from '@/lib/shop-session';

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const lockKey = `shop:${String(email).trim().toLowerCase()}`;
    if (isLoginLocked(lockKey)) {
      return NextResponse.json(
        { error: `Too many failed attempts. Try again in ${LOGIN_LOCK_MINUTES} minutes.` },
        { status: 429 }
      );
    }

    const user = await get('SELECT * FROM users WHERE email = $1', [email]);
    
    if (!user) {
      recordLoginFailure(lockKey);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      );
    }

    try {
      if (user.password !== password) {
        recordLoginFailure(lockKey);
        return NextResponse.json(
          { error: 'Invalid password' },
          { status: 401 }
        );
      }
    } catch (err) {
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }

    clearLoginFailures(lockKey);
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        points: user.points || 0,
        spending: user.spending || 0
      }
    });
    // 發登入憑證，之後訂單／購物車／願望清單 API 靠它確認是本人。
    const token = createShopSessionToken(user.email);
    if (token) response.cookies.set(shopSessionCookie(token, { secure: isHttpsRequest(request) }));
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
