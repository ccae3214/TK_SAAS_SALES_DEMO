import { NextResponse } from 'next/server';
import { run } from '@/lib/db';
import { requireAdmin, validateProductPayload } from '@/lib/security';

export async function DELETE(request, { params }) {
  try {
    const adminCheck = await requireAdmin();
    if (!adminCheck.authorized) {
      return adminCheck.response;
    }

    const { id } = params;
    await run('DELETE FROM products WHERE id = $1', [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const adminCheck = await requireAdmin();
    if (!adminCheck.authorized) {
      return adminCheck.response;
    }

    const { id } = params;
    const payload = await request.json();
    const validation = validateProductPayload(payload);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { name, price, category, tag, img } = validation.data;
    await run(
      'UPDATE products SET name = $1, price = $2, category = $3, tag = $4, img = $5 WHERE id = $6',
      [name, price, category, tag, img, id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
