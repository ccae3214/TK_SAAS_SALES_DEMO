import { NextResponse } from 'next/server';
import pool, { query, run } from '@/lib/db';
import { requireUser, requireCsrf } from '@/lib/security';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (email) {
      const orders = await query('SELECT * FROM orders WHERE id IN (SELECT order_id FROM order_items WHERE user_email = $1) ORDER BY created_at DESC', [email]);
      return NextResponse.json(orders || []);
    }

    const orders = await query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 100');
    return NextResponse.json(orders || []);
  } catch (error) {
    console.error('Orders fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    // CSRF/Content-Type sanity check
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return NextResponse.json({ error: 'Invalid content-type' }, { status: 415 });
    }

    if (!requireCsrf(request)) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const userCheck = await requireUser();
    if (!userCheck.authorized) {
      return userCheck.response;
    }

    const userEmail = userCheck.session.user.email.toLowerCase();
    const payload = await request.json();
    const email = payload.email?.toLowerCase();
    const items = payload.items;
    const address = payload.address || '';
    const couponCode = payload.couponCode || null;

    if (!email || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Email and items are required' }, { status: 400 });
    }

    if (email !== userEmail) {
      return NextResponse.json({ error: 'Unauthorized email' }, { status: 403 });
    }

    // Server-side total calc from current prices
    let calculatedTotal = 0;
    const normalizedItems = [];

    for (const item of items) {
      const productId = Number(item.product_id ?? item.id);
      const quantity = Number(item.quantity);
      if (!productId || !Number.isInteger(quantity) || quantity <= 0) {
        return NextResponse.json({ error: 'Invalid item payload' }, { status: 400 });
      }

      const p = await query('SELECT id, product_name, price FROM products WHERE id = $1', [productId]);
      const product = p?.[0];
      if (!product) {
        return NextResponse.json({ error: `Product not found: ${productId}` }, { status: 400 });
      }

      const price = Number(product.price);
      if (!Number.isFinite(price) || price < 0) {
        return NextResponse.json({ error: 'Invalid product price' }, { status: 400 });
      }

      calculatedTotal += price * quantity;
      normalizedItems.push({
        product_id: productId,
        product_name: product.product_name || item.product_name || '',
        size: item.size || 'M',
        quantity,
        price,
      });
    }

    const orderTotal = Number(calculatedTotal.toFixed(2));
    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'INSERT INTO orders (id, total, created_at) VALUES ($1, $2, CURRENT_TIMESTAMP)',
        [orderId, orderTotal]
      );

      for (const item of normalizedItems) {
        await client.query(
          'INSERT INTO order_items (order_id, product_id, product_name, size, quantity, price, user_email) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [orderId, item.product_id, item.product_name, item.size, item.quantity, item.price, userEmail]
        );
      }

      await client.query('DELETE FROM shopping_carts WHERE user_email = $1', [userEmail]);
      await client.query('COMMIT');
    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }

    const orderData = await query('SELECT * FROM orders WHERE id = $1', [orderId]);
    const orderItems = await query('SELECT * FROM order_items WHERE order_id = $1', [orderId]);

    return NextResponse.json({
      success: true,
      order: {
        ...orderData[0],
        items: orderItems,
        address,
        couponCode,
      }
    });
  } catch (error) {
    console.error('Order creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
