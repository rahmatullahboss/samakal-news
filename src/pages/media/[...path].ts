// src/pages/media/[...path].ts
// Fix #4: Serve R2 files at /media/* — without this, all uploaded images 404

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const MEDIA = (env as any).MEDIA;
  const path = params.path;
  if (!path) return new Response('Not found', { status: 404 });

  // Prevent path traversal
  const safePath = path.replace(/\.\./g, '').replace(/^\/+/, '');
  const key = `media/${safePath}`;

  try {
    const object = await MEDIA.get(key);
    if (!object) return new Response('Not found', { status: 404 });

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    // Long cache — R2 objects are content-addressed (immutable by timestamp key)
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');

    return new Response(object.body, { headers });
  } catch (_err) {
    return new Response('Error serving file', { status: 500 });
  }
};
