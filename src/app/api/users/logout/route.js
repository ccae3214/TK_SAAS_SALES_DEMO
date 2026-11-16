import { NextResponse } from 'next/server';
import { clearedShopSessionCookie, isHttpsRequest } from '@/lib/shop-session';

// 商店示範帳號登出：清除登入憑證 cookie。
export async function POST(request) {
  const response = NextResponse.json({ success: true });
  response.cookies.set(clearedShopSessionCookie({ secure: isHttpsRequest(request) }));
  return response;
}
