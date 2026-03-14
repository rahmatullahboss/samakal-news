// src/pages/api/articles/index.ts
// Astro 6: use cloudflare:workers env module

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const GET: APIRoute = async ({ request }) => {
  const DB = (env as any).DB;
  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const status   = url.searchParams.get('status') ?? 'published';
  const limit    = Math.min(Number(url.searchParams.get('limit') ?? 20), 100);
  const page     = Math.max(Number(url.searchParams.get('page')  ?? 1), 1);
  const offset   = (page - 1) * limit;

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
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
};

export const POST: APIRoute = async ({ request }) => {
  const SESSION = (env as any).SESSION;
  const DB = (env as any).DB;
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const session = await SESSION.get(`session:${token}`);
  if (!session) return Response.json({ error: 'Invalid session' }, { status: 401 });

  try {
    const body = await request.json() as Record<string, any>;
    const { title, slug, excerpt, content, featured_image, category_id, author_id, status = 'draft', is_featured = 0, is_breaking = 0, published_at } = body;
    if (!title || !slug || !content) return Response.json({ error: 'title, slug, content required' }, { status: 400 });

    const result = await DB.prepare(
      `INSERT INTO articles (title, slug, excerpt, content, featured_image, category_id, author_id, status, is_featured, is_breaking, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(title, slug, excerpt ?? null, content, featured_image ?? null, category_id ?? null, author_id ?? null, status, is_featured, is_breaking, published_at ?? null).run();

    return Response.json({ id: (result as any).meta.last_row_id, slug }, { status: 201 });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) return Response.json({ error: 'Slug already exists' }, { status: 409 });
    return Response.json({ error: err.message }, { status: 500 });
  }
};
