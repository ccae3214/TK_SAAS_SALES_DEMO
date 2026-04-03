import { NextResponse } from 'next/server';
import { query, run } from '@/lib/db';

export async function GET(request, { params }) {
  try {
    const { id } = params;
    if (!id) {
      const reviews = await query('SELECT * FROM reviews ORDER BY id DESC LIMIT 50');
      return NextResponse.json(reviews || []);
    }
    
    const reviews = await query('SELECT * FROM reviews WHERE product_id = $1 ORDER BY id DESC', [parseInt(id)]);
    return NextResponse.json(reviews || []);
  } catch (error) {
    console.error('Reviews fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { productId, userName, rating, comment } = await request.json();

    if (!productId || !rating) {
      return NextResponse.json(
        { error: 'Product ID and rating are required' },
        { status: 400 }
      );
    }

    await run(
      'INSERT INTO reviews (product_id, rating, comment, date) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)',
      [productId, rating, comment || '']
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Review creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
