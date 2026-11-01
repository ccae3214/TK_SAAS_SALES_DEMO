import { NextResponse } from 'next/server';
import { get, run } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/passwords';

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await get('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      );
    }

    const isHashed = user.password.startsWith('scrypt$');
    const validPassword = isHashed
      ? await verifyPassword(password, user.password)
      : user.password === password;
    if (!validPassword) return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    if (!isHashed) {
      await run('UPDATE users SET password = $1 WHERE id = $2', [await hashPassword(password), user.id]);
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        points: user.points || 0,
        spending: user.spending || 0
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
