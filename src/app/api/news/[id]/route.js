import { NextResponse } from 'next/server';
import { run } from '@/lib/db';
import { requireAdmin } from '@/lib/security';

export async function DELETE(request, { params }) {
  try {
    const adminCheck = await requireAdmin();
    if (!adminCheck.authorized) {
      return adminCheck.response;
    }

    const { id } = params;
    await run('DELETE FROM news WHERE id = $1', [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
