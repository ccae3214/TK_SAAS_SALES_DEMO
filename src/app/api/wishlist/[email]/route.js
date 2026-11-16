import { NextResponse } from 'next/server';
import { requireCsrf, requireOwnerOrAdmin } from '@/lib/security';

const wishlists = new Map();

export async function GET(request, { params }) {
  try {
    const access = await requireOwnerOrAdmin(request, decodeURIComponent(params.email || ''));
    if (!access.authorized) return access.response;
    const wishlist = wishlists.get(access.email) || [];
    return NextResponse.json(wishlist);
  } catch (error) {
    console.error('Wishlist fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch wishlist' }, { status: 500 });
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
      wishlists.set(access.email, items);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Wishlist update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
