// src/pages/api/media/upload.ts
// POST /api/media/upload — upload image to R2

import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals }) => {
  const { MEDIA, SESSION } = (locals as any).runtime.env;

  // Auth check
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const session = await SESSION.get(`session:${token}`);
  if (!session) return Response.json({ error: 'Invalid session' }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) return Response.json({ error: 'file is required' }, { status: 400 });

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) return Response.json({ error: 'File too large (max 5MB)' }, { status: 413 });

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      return Response.json({ error: 'Only JPEG, PNG, WebP, GIF allowed' }, { status: 415 });
    }

    // Generate unique key: media/YYYY/MM/timestamp-filename.ext
    const now = new Date();
    const ext = file.name.split('.').pop() ?? 'jpg';
    const key = `media/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, '-')}`;

    const buffer = await file.arrayBuffer();
    await MEDIA.put(key, buffer, { httpMetadata: { contentType: file.type } });

    return Response.json({ key, url: `/media/${key}` }, { status: 201 });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
};
