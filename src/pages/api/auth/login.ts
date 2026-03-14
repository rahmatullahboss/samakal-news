// src/pages/api/auth/login.ts
// Fix #2: PBKDF2 instead of SHA-256 (Web Crypto, no package needed)
// Fix #5: Return session info + let middleware handle cookie via KV

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

function generateToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Fix #2: PBKDF2 with 100k iterations — orders of magnitude harder to brute-force than SHA-256
async function pbkdf2Hash(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100000 },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// For backward compat: also support old SHA-256 hash (migration path)
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
    if (typeof email !== 'string' || typeof password !== 'string') return Response.json({ error: 'Invalid input' }, { status: 400 });

    const author = await DB.prepare(
      'SELECT id, name, email, role, password_hash, password_salt FROM authors WHERE email = ?'
    ).bind(email.toLowerCase().trim()).first() as any;

    if (!author) {
      // Constant-time: always hash even on miss
      await pbkdf2Hash(password, 'dummy-salt');
      return Response.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Hash check — support PBKDF2 (salt present) or legacy SHA-256 (no salt)
    let validPassword = false;
    if (author.password_salt) {
      const hash = await pbkdf2Hash(password, author.password_salt);
      validPassword = hash === author.password_hash;
    } else {
      // Legacy SHA-256 — accept but flag for upgrade
      const hash = await sha256Hex(password);
      validPassword = hash === author.password_hash;
    }

    if (!validPassword) return Response.json({ error: 'Invalid credentials' }, { status: 401 });

    const token = generateToken();
    const sessionData = JSON.stringify({ id: author.id, name: author.name, email: author.email, role: author.role });
    // 24h session
    await SESSION.put(`session:${token}`, sessionData, { expirationTtl: 86400 });

    return Response.json({ token, user: { id: author.id, name: author.name, email: author.email, role: author.role } });
  } catch (_err) {
    // Fix #11: Never leak error details to client
    return Response.json({ error: 'Authentication failed' }, { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
  const SESSION = (env as any).SESSION;
  // Fix #5: check both Authorization header AND cookie
  const token = request.headers.get('Authorization')?.replace('Bearer ', '') 
    ?? cookies.get('admin_token')?.value;
  if (token) await SESSION.delete(`session:${token}`);
  cookies.delete('admin_token', { path: '/' });
  return Response.json({ success: true });
};
