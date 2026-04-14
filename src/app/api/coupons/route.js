import { NextResponse } from 'next/server';
import { query, run } from '@/lib/db';
import { requireAdmin } from '@/lib/security';

export async function GET() {
  try {
    const adminCheck = await requireAdmin();
    if (!adminCheck.authorized) {
      return adminCheck.response;
    }
    const coupons = await query('SELECT * FROM coupons ORDER BY id DESC');
    return NextResponse.json(coupons);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const adminCheck = await requireAdmin();
    if (!adminCheck.authorized) {
      return adminCheck.response;
    }

    const payload = await request.json();
    const { code, discount, type, expiry } = payload;

    if (!code || !discount || !type) {
      return NextResponse.json({ error: 'Code, discount and type are required' }, { status: 400 });
    }

    const result = await run(
      'INSERT INTO coupons (code, discount, type, expiry) VALUES ($1, $2, $3, $4) RETURNING id',
      [code, discount, type, expiry || null]
    );

    return NextResponse.json({ success: true, id: result.id });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
