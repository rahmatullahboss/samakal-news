// src/pages/api/auth/logout.ts — clear admin_token cookie
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const POST: APIRoute = async ({ cookies, request }) => {
  const SESSION = (env as any).SESSION;
  const token = cookies.get('admin_token')?.value;
  if (token) {
    await SESSION.delete(`session:${token}`);
    cookies.delete('admin_token', { path: '/' });
  }
  return new Response(null, { status: 302, headers: { Location: '/admin/login' } });
};

// Also handle GET for safety
export const GET: APIRoute = async ({ cookies }) => {
  const SESSION = (env as any).SESSION;
  const token = cookies.get('admin_token')?.value;
  if (token) {
    await SESSION.delete(`session:${token}`);
    cookies.delete('admin_token', { path: '/' });
  }
  return new Response(null, { status: 302, headers: { Location: '/admin/login' } });
};
