import { NextResponse } from 'next/server';
import { requireCsrf, requireOwnerOrAdmin } from '@/lib/security';

const carts = new Map();

export async function GET(request, { params }) {
  try {
    const access = await requireOwnerOrAdmin(request, decodeURIComponent(params.email || ''));
    if (!access.authorized) return access.response;
    const cart = carts.get(access.email) || [];
    return NextResponse.json(cart);
  } catch (error) {
    console.error('Cart fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch cart' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    if (!requireCsrf(request)) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }
    const access = await requireOwnerOrAdmin(request, decodeURIComponent(params.email || ''));
    if (!access.authorized) return access.response;
    const { items } = await request.json();
    if (Array.isArray(items)) {
      carts.set(access.email, items);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cart update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
