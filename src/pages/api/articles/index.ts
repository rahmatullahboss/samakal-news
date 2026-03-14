// src/pages/api/articles/index.ts
// Fix #11: sanitized errors  Fix #12: input validation  Fix #5: cookie-based auth

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const GET: APIRoute = async ({ request }) => {
  const DB = (env as any).DB;
  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const status   = url.searchParams.get('status') ?? 'published';
  // Fix #12: whitelist status values
  const allowedStatus = ['published', 'draft', 'archived'];
  if (!allowedStatus.includes(status)) return Response.json({ error: 'Invalid status' }, { status: 400 });
  const limit  = Math.min(Number(url.searchParams.get('limit') ?? 20), 100);
  const page   = Math.max(Number(url.searchParams.get('page')  ?? 1), 1);
  const offset = (page - 1) * limit;

  try {
    let query = `
      SELECT a.id, a.title, a.slug, a.excerpt, a.featured_image,
             a.is_featured, a.is_breaking, a.view_count, a.published_at,
             c.name AS category_name, c.slug AS category_slug,
             au.name AS author_name, au.slug AS author_slug
      FROM articles a
      LEFT JOIN categories c  ON a.category_id = c.id
      LEFT JOIN authors au    ON a.author_id   = au.id
      WHERE a.status = ?`;
    const binds: (string | number)[] = [status];

    if (category) { query += ` AND c.slug = ?`; binds.push(category); }
    query += ` ORDER BY a.published_at DESC LIMIT ? OFFSET ?`;
    binds.push(limit, offset);

    const { results } = await DB.prepare(query).bind(...binds).all();

    let countQ = `SELECT COUNT(*) as total FROM articles a LEFT JOIN categories c ON a.category_id = c.id WHERE a.status = ?`;
    const countB: (string | number)[] = [status];
    if (category) { countQ += ` AND c.slug = ?`; countB.push(category); }
    const countRow = await DB.prepare(countQ).bind(...countB).first();
    const total = (countRow as any)?.total ?? 0;

    return Response.json(
      { data: results, meta: { total, page, limit, pages: Math.ceil(total / limit) } },
      { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } }
    );
  } catch (_err) {
    return Response.json({ error: 'Failed to fetch articles' }, { status: 500 });
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const SESSION = (env as any).SESSION;
  const DB = (env as any).DB;
  // Fix #5: read from httpOnly cookie first, fallback to Authorization header
  const token = cookies.get('admin_token')?.value 
    ?? request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const sessionJson = await SESSION.get(`session:${token}`);
  if (!sessionJson) return Response.json({ error: 'Invalid session' }, { status: 401 });
  const user = JSON.parse(sessionJson);

  try {
    const body = await request.json() as Record<string, any>;
    const { title, slug, excerpt, content, featured_image, category_id, status = 'draft', is_featured = 0, is_breaking = 0, published_at } = body;

    // Fix #12: strict validation
    if (!title || !slug || !content) return Response.json({ error: 'title, slug, content required' }, { status: 400 });
    if (typeof title !== 'string' || title.length > 500) return Response.json({ error: 'Invalid title' }, { status: 400 });
    if (!/^[a-z0-9\u0980-\u09FF-]+$/.test(slug)) return Response.json({ error: 'Invalid slug format' }, { status: 400 });
    if (content.length > 500_000) return Response.json({ error: 'Content too large' }, { status: 413 });
    const allowedStatus = ['published', 'draft', 'archived'];
    if (!allowedStatus.includes(status)) return Response.json({ error: 'Invalid status' }, { status: 400 });

    // Fix #8: always set author_id from session
    const authorId = user.id;

    const result = await DB.prepare(
      `INSERT INTO articles (title, slug, excerpt, content, featured_image, category_id, author_id, status, is_featured, is_breaking, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(title, slug, excerpt ?? null, content, featured_image ?? null, category_id ?? null, authorId, status, is_featured ? 1 : 0, is_breaking ? 1 : 0, published_at ?? null).run();

    return Response.json({ id: (result as any).meta.last_row_id, slug }, { status: 201 });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) return Response.json({ error: 'Slug already exists' }, { status: 409 });
    return Response.json({ error: 'Failed to create article' }, { status: 500 });
  }
};
