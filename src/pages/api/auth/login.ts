// src/pages/api/auth/login.ts
// Astro 6: use cloudflare:workers env module

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

function generateToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export const POST: APIRoute = async ({ request }) => {
  const DB = (env as any).DB;
  const SESSION = (env as any).SESSION;
  try {
    const { email, password } = await request.json() as any;
    if (!email || !password) return Response.json({ error: 'email and password required' }, { status: 400 });

    const author = await DB.prepare(
      'SELECT id, name, email, role, password_hash FROM authors WHERE email = ?'
    ).bind(email).first() as any;

    const hash = await sha256Hex(password);
    if (!author || author.password_hash !== hash) return Response.json({ error: 'Invalid credentials' }, { status: 401 });

    const token = generateToken();
    const sessionData = JSON.stringify({ id: author.id, name: author.name, email: author.email, role: author.role });
    await SESSION.put(`session:${token}`, sessionData, { expirationTtl: 86400 });

    return Response.json({ token, user: { id: author.id, name: author.name, email: author.email, role: author.role } });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  const SESSION = (env as any).SESSION;
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (token) await SESSION.delete(`session:${token}`);
  return Response.json({ success: true });
};
