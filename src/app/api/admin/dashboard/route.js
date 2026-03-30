import { NextResponse } from 'next/server';
import { query, get } from '@/lib/db';
import { requireAdmin } from '@/lib/security';

export async function GET() {
  try {
    const adminCheck = await requireAdmin();
    if (!adminCheck.authorized) {
      return adminCheck.response;
    }

    const queries = {
      revenue: "SELECT SUM(total) as total FROM orders",
      ordersCount: "SELECT COUNT(*) as count FROM orders",
      usersCount: "SELECT COUNT(*) as count FROM users",
      newsletterCount: "SELECT COUNT(*) as count FROM newsletter",
      recentOrders: "SELECT * FROM orders ORDER BY createdAt DESC LIMIT 10",
      orderItems: "SELECT oi.*, p.name FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id IN (SELECT id FROM orders ORDER BY createdAt DESC LIMIT 10)",
      recentInquiries: "SELECT * FROM inquiries ORDER BY createdAt DESC LIMIT 10",
      allProducts: "SELECT * FROM products ORDER BY id DESC",
      allUsers: "SELECT * FROM users ORDER BY createdAt DESC",
      allNews: "SELECT * FROM news ORDER BY date DESC",
      allCoupons: "SELECT * FROM coupons ORDER BY id DESC",
      allNewsletter: "SELECT * FROM newsletter ORDER BY date DESC",
      allReviews: "SELECT reviews.*, products.name as productName FROM reviews JOIN products ON reviews.productId = products.id ORDER BY reviews.date DESC",
      chartData: "SELECT date(createdAt) as date, count(*) as count FROM users GROUP BY date(createdAt) ORDER BY date DESC LIMIT 14"
    };

    const results = {};
    for (const [key, sql] of Object.entries(queries)) {
      if (key === 'revenue') {
          const row = await get(sql);
          results[key] = row?.total || 0;
      } else if (key.endsWith('Count')) {
          const row = await get(sql);
          results[key] = row?.count || 0;
      } else {
          results[key] = await query(sql);
      }
    }

    return NextResponse.json({
      ...results,
      chartData: (results.chartData || []).reverse()
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
