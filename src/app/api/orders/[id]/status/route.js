import { NextResponse } from 'next/server';
import { run } from '@/lib/db';
import { requireAdmin } from '@/lib/security';

export async function PUT(request, { params }) {
  try {
    const adminCheck = await requireAdmin();
    if (!adminCheck.authorized) {
      return adminCheck.response;
    }

    const { id } = params;
    const payload = await request.json();
    const { status } = payload;

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    await run('UPDATE orders SET status = $1 WHERE id = $2', [status, id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
