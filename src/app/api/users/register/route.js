import { NextResponse } from 'next/server';
import { query, run, get } from '@/lib/db';

export async function POST(request) {
  try {
    const { name, email, password } = await request.json();

    // Validate input
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email, and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await get('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      );
    }

    // Insert user
    const result = await run(
      'INSERT INTO users (name, email, password, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) RETURNING id, name, email, created_at',
      [name, email, password]
    );

    const user = result[0] || { id: result.id, name, email };

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
