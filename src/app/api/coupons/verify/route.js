import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request) {
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: 'Coupon code is required' },
        { status: 400 }
      );
    }

    const coupon = await query('SELECT * FROM coupons WHERE code = $1', [code.toUpperCase()]);
    
    if (!coupon || coupon.length === 0) {
      return NextResponse.json(
        { error: 'Invalid coupon code' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      code: coupon[0].code,
      discount: coupon[0].discount,
      type: 'FIXED'
    });
  } catch (error) {
    console.error('Coupon verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
