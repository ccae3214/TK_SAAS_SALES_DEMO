import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request, { params }) {
  try {
    const { email } = params;
    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    // Get all orders for this user
    const orders = await query(
      'SELECT DISTINCT o.* FROM orders o INNER JOIN order_items oi ON o.id = oi.order_id WHERE oi.user_email = $1 ORDER BY o.created_at DESC',
      [email]
    );

    // Get items for each order
    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const items = await query(
          'SELECT * FROM order_items WHERE order_id = $1',
          [order.id]
        );
        return {
          ...order,
          items: items || []
        };
      })
    );

    return NextResponse.json(ordersWithItems || []);
  } catch (error) {
    console.error('User orders fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch orders', details: error.message }, { status: 500 });
  }
}
