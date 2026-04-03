import { NextResponse } from 'next/server';
import { get } from '@/lib/db';
import { decrypt } from '@root/crypto_utils.js';

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const user = await get('SELECT * FROM users WHERE email = $1', [email]);
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      );
    }

    try {
      const decryptedPassword = decrypt(user.password);
      if (decryptedPassword !== password) {
        return NextResponse.json(
          { error: 'Invalid password' },
          { status: 401 }
        );
      }
    } catch (err) {
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
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
