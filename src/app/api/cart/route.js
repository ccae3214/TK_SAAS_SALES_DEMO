import { NextResponse } from 'next/server';
import { query, run } from '@/lib/db';
import { requireCsrf, requireOwnerOrAdmin } from '@/lib/security';

// POST /api/cart - Save/sync cart to database
export async function POST(request) {
  try {
    if (!requireCsrf(request)) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const { email: rawEmail, cart } = await request.json();

    if (!rawEmail || !Array.isArray(cart)) {
      return NextResponse.json({ error: 'Missing email or cart' }, { status: 400 });
    }

    const access = await requireOwnerOrAdmin(request, rawEmail);
    if (!access.authorized) return access.response;
    const email = access.email;

    // Clear existing cart items for this user
    await run('DELETE FROM shopping_carts WHERE lower(user_email) = $1', [email]);

    // Insert new cart items
    for (const item of cart) {
      
      // Extract numeric product_id from string like "3-S" if needed
      let productId = item.id;
      if (typeof item.id === 'string') {
        const parts = item.id.split('-');
        productId = parseInt(parts[0]);
      }
      
      
      await run(
        `INSERT INTO shopping_carts 
         (user_email, product_id, product_name, price, quantity, size, img) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [email, productId, item.name, item.price, item.quantity, item.size || 'M', item.img]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cart sync error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/cart?email=user@example.com - Get cart from database
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const access = await requireOwnerOrAdmin(request, searchParams.get('email'));
    if (!access.authorized) return access.response;
    const email = access.email;

    const cartItems = await query(
      `SELECT id, product_id as id, product_name as name, price, quantity, size, img 
       FROM shopping_carts 
       WHERE lower(user_email) = $1 
       ORDER BY updated_at DESC`,
      [email]
    );

    return NextResponse.json(cartItems);
  } catch (error) {
    console.error('Cart fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch cart' }, { status: 500 });
  }
}
