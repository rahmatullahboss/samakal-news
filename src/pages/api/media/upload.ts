// src/pages/api/media/upload.ts
// Fix #4: Return full R2 public URL (served via /media/[...path].ts)
// Fix #6: Use cloudflare:workers env module (not locals.runtime.env)

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const POST: APIRoute = async ({ request, cookies }) => {
  // Fix #5: read auth from httpOnly cookie OR Authorization header
  const MEDIA = (env as any).MEDIA;
  const SESSION = (env as any).SESSION;

  const token = cookies.get('admin_token')?.value 
    ?? request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const session = await SESSION.get(`session:${token}`);
  if (!session) return Response.json({ error: 'Invalid session' }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) return Response.json({ error: 'file is required' }, { status: 400 });

    // Fix #12: strict validation
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) return Response.json({ error: 'File too large (max 5MB)' }, { status: 413 });
    if (file.size === 0) return Response.json({ error: 'Empty file' }, { status: 400 });

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
    if (!allowed.includes(file.type)) {
      return Response.json({ error: 'Only JPEG, PNG, WebP, GIF, AVIF allowed' }, { status: 415 });
    }

    // Sanitize filename — no path traversal
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 100);
    const extMap: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' };
    const ext = extMap[file.type] ?? 'jpg';
    const now = new Date();
    const key = `media/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${Date.now()}-${safeName}.${ext}`;

    const buffer = await file.arrayBuffer();
    await MEDIA.put(key, buffer, { httpMetadata: { contentType: file.type } });

    // Fix #4: return URL that maps to our /media/[...path].ts serve route
    const url = `/media/${key}`;
    return Response.json({ key, url }, { status: 201 });
  } catch (_err) {
    // Fix #11: sanitized error
    return Response.json({ error: 'Upload failed' }, { status: 500 });
  }
};
