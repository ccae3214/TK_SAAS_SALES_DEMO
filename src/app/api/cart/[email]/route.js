import { NextResponse } from 'next/server';

const carts = new Map();

export async function GET(request, { params }) {
  try {
    const { email } = params;
    const cart = carts.get(email) || [];
    return NextResponse.json(cart);
  } catch (error) {
    console.error('Cart fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch cart' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { email } = params;
    const { items } = await request.json();
    if (email && items) {
      carts.set(email, items);
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
