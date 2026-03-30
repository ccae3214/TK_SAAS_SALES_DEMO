import { NextResponse } from 'next/server';
import { query, run } from '@/lib/db';
import { requireAdmin, validateProductPayload } from '@/lib/security';

export async function GET() {
  const products = await query('SELECT * FROM products');
  return NextResponse.json(products);
}

export async function POST(request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.authorized) {
    return adminCheck.response;
  }

  const payload = await request.json();
  const validation = validateProductPayload(payload);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { name, price, category, tag, img } = validation.data;
  const { id } = await run('INSERT INTO products (name, price, category, tag, img) VALUES (?, ?, ?, ?, ?)', [name, price, category, tag, img]);
  return NextResponse.json({ id });
}
