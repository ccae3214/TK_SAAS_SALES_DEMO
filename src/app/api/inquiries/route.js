import { NextResponse } from 'next/server';
import { run } from '@/lib/db';

export async function POST(request) {
  try {
    const payload = await request.json();
    const { name, email, message, type } = payload;

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Name, email and message are required' }, { status: 400 });
    }

    const result = await run(
      'INSERT INTO inquiries (name, email, message, type, createdAt) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) RETURNING id',
      [name, email, message, type || 'General']
    );

    return NextResponse.json({ success: true, id: result.id });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
