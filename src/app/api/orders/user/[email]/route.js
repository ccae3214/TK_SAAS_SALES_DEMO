import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireOwnerOrAdmin } from '@/lib/security';

export async function GET(request, { params }) {
  try {
    const { email } = params;
    const access = await requireOwnerOrAdmin(request, decodeURIComponent(email || ''));
    if (!access.authorized) return access.response;

    // Get all orders for this user
    const orders = await query(
      'SELECT DISTINCT o.* FROM orders o INNER JOIN order_items oi ON o.id = oi.order_id WHERE lower(oi.user_email) = $1 ORDER BY o.created_at DESC',
      [access.email]
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
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}
