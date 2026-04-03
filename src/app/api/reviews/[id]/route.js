import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request, { params }) {
  try {
    const { id } = params;
    const reviews = await query('SELECT * FROM reviews WHERE product_id = $1 ORDER BY id DESC', [parseInt(id)]);
    return NextResponse.json(reviews || []);
  } catch (error) {
    console.error('Reviews fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }
}
