import { NextResponse } from 'next/server';
import { query, run } from '@/lib/db';

// POST /api/cart - Save/sync cart to database
export async function POST(request) {
  try {
    if (!requireCsrf(request)) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const { email, cart } = await request.json();
    
    console.log('[Cart API] POST received:', { email, cartLength: cart?.length, cartItems: JSON.stringify(cart) });
    
    if (!email || !cart) {
      return NextResponse.json({ error: 'Missing email or cart' }, { status: 400 });
    }

    // Clear existing cart items for this user
    await run('DELETE FROM shopping_carts WHERE user_email = $1', [email]);

    // Insert new cart items
    for (const item of cart) {
      console.log('[Cart API] Processing item:', { 
        originalId: item.id, 
        idType: typeof item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        size: item.size 
      });
      
      // Extract numeric product_id from string like "3-S" if needed
      let productId = item.id;
      if (typeof item.id === 'string') {
        const parts = item.id.split('-');
        productId = parseInt(parts[0]);
        console.log('[Cart API] Extracted product ID:', { original: item.id, extracted: productId, parts });
      }
      
      console.log('[Cart API] Inserting with productId:', productId, 'Type:', typeof productId);
      
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
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// GET /api/cart?email=user@example.com - Get cart from database
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const cartItems = await query(
      `SELECT id, product_id as id, product_name as name, price, quantity, size, img 
       FROM shopping_carts 
       WHERE user_email = $1 
       ORDER BY updated_at DESC`,
      [email]
    );

    return NextResponse.json(cartItems);
  } catch (error) {
    console.error('Cart fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch cart' }, { status: 500 });
  }
}
