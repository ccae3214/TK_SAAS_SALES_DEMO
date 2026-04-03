import { NextResponse } from 'next/server';

const wishlists = new Map();

export async function GET(request, { params }) {
  try {
    const { email } = params;
    const wishlist = wishlists.get(email) || [];
    return NextResponse.json(wishlist);
  } catch (error) {
    console.error('Wishlist fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch wishlist' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { email } = params;
    const { items } = await request.json();
    if (email && items) {
      wishlists.set(email, items);
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
