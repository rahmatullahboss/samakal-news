// src/pages/api/articles/[id].ts
// GET / PUT / DELETE  /api/articles/:id

import type { APIRoute } from 'astro';

async function requireAuth(request: Request, SESSION: any): Promise<string | null> {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  return SESSION.get(`session:${token}`);
}

export const GET: APIRoute = async ({ params, locals }) => {
  const { DB } = (locals as any).runtime.env;
  try {
    const article = await DB.prepare(
      `SELECT a.*, c.name AS category_name, c.slug AS category_slug, au.name AS author_name, au.slug AS author_slug
       FROM articles a
       LEFT JOIN categories c ON a.category_id = c.id
       LEFT JOIN authors au   ON a.author_id   = au.id
       WHERE a.id = ?`
    ).bind(params.id).first();

    if (!article) return Response.json({ error: 'Not found' }, { status: 404 });
    DB.prepare('UPDATE articles SET view_count = view_count + 1 WHERE id = ?').bind(params.id).run();
    return Response.json({ data: article });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
};

export const PUT: APIRoute = async ({ params, request, locals }) => {
  const { DB, SESSION } = (locals as any).runtime.env;
  const session = await requireAuth(request, SESSION);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json() as Record<string, any>;
    const fields = ['title','slug','excerpt','content','featured_image','category_id','author_id','status','is_featured','is_breaking','published_at'];
    const updates = fields.filter(f => f in body);
    if (!updates.length) return Response.json({ error: 'No fields to update' }, { status: 400 });

    const setClause = updates.map(f => `${f} = ?`).join(', ');
    const values = updates.map(f => body[f]);
    await DB.prepare(`UPDATE articles SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(...values, params.id).run();
    return Response.json({ success: true });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const { DB, SESSION } = (locals as any).runtime.env;
  const session = await requireAuth(request, SESSION);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await DB.prepare('DELETE FROM articles WHERE id = ?').bind(params.id).run();
    return Response.json({ success: true });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
};
