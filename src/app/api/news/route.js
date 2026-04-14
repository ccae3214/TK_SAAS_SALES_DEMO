import { NextResponse } from 'next/server';
import { query, run } from '@/lib/db';
import { requireAdmin } from '@/lib/security';

export async function GET() {
  try {
    const news = await query('SELECT * FROM news ORDER BY date DESC');
    return NextResponse.json(news);
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
    const { title, content, date, tag } = payload;

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    const result = await run(
      'INSERT INTO news (title, content, date, tag) VALUES ($1, $2, $3, $4) RETURNING id',
      [title, content, date || new Date().toISOString(), tag || 'General']
    );

    return NextResponse.json({ success: true, id: result.id });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
