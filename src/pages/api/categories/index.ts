// src/pages/api/categories/index.ts
// GET /api/categories — list all categories

import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals }) => {
  const { DB } = (locals as any).runtime.env;
  try {
    const { results } = await DB.prepare(
      'SELECT id, name, slug, sort_order FROM categories ORDER BY sort_order ASC'
    ).all();
    return Response.json({ data: results });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
};
