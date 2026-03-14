// src/pages/api/articles/[id].ts
// Fix #5: cookie auth  Fix #9: dedup view_count  Fix #11: sanitized errors

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

async function requireAuth(request: Request, cookies: any): Promise<string | null> {
  const SESSION = (env as any).SESSION;
  // Fix #5: read httpOnly cookie first, fallback to Authorization header
  const token = cookies?.get?.('admin_token')?.value 
    ?? request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  return SESSION.get(`session:${token}`);
}

export const GET: APIRoute = async ({ params, request }) => {
  const DB = (env as any).DB;
  const CACHE = (env as any).CACHE;
  try {
    const article = await DB.prepare(
      `SELECT a.*, c.name AS category_name, c.slug AS category_slug, au.name AS author_name, au.slug AS author_slug
       FROM articles a
       LEFT JOIN categories c ON a.category_id = c.id
       LEFT JOIN authors au   ON a.author_id   = au.id
       WHERE a.id = ?`
    ).bind(params.id).first();

    if (!article) return Response.json({ error: 'Not found' }, { status: 404 });

    // Fix #9: deduplicate view_count using KV with 1h TTL per IP
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const viewKey = `view:${params.id}:${ip}`;
    const alreadyViewed = await CACHE?.get(viewKey);
    if (!alreadyViewed) {
      DB.prepare('UPDATE articles SET view_count = view_count + 1 WHERE id = ?').bind(params.id).run();
      CACHE?.put(viewKey, '1', { expirationTtl: 3600 }); // 1h dedup window
    }

    return Response.json({ data: article }, { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' } });
  } catch (_err) {
    return Response.json({ error: 'Failed to fetch article' }, { status: 500 });
  }
};

export const PUT: APIRoute = async ({ params, request, cookies }) => {
  const DB = (env as any).DB;
  const session = await requireAuth(request, cookies);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json() as Record<string, any>;
    const allowedFields = ['title','slug','excerpt','content','featured_image','category_id','status','is_featured','is_breaking','published_at'];
    // Fix #12: only update whitelisted fields
    const updates = allowedFields.filter(f => f in body);
    if (!updates.length) return Response.json({ error: 'No fields to update' }, { status: 400 });

    // Validate slug if being updated
    if (body.slug && !/^[a-z0-9\u0980-\u09FF-]+$/.test(body.slug)) {
      return Response.json({ error: 'Invalid slug format' }, { status: 400 });
    }

    const setClause = updates.map(f => `${f} = ?`).join(', ');
    const values = updates.map(f => body[f]);
    await DB.prepare(`UPDATE articles SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(...values, params.id).run();
    return Response.json({ success: true });
  } catch (_err) {
    return Response.json({ error: 'Failed to update article' }, { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ params, request, cookies }) => {
  const DB = (env as any).DB;
  const session = await requireAuth(request, cookies);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await DB.prepare('DELETE FROM articles WHERE id = ?').bind(params.id).run();
    return Response.json({ success: true });
  } catch (_err) {
    return Response.json({ error: 'Failed to delete article' }, { status: 500 });
  }
};
