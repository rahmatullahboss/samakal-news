// src/middleware.ts
// Astro 6 middleware — protect /admin/* routes

import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // Only protect /admin routes (except /admin/login)
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const SESSION = (env as any).SESSION;
    const token = context.cookies.get('admin_token')?.value;

    if (!token) return context.redirect('/admin/login');

    try {
      const sessionData = await SESSION.get(`session:${token}`);
      if (!sessionData) return context.redirect('/admin/login');

      const user = JSON.parse(sessionData);
      if (!['admin', 'editor'].includes(user.role)) return context.redirect('/admin/login');

      // Pass user to pages via locals
      (context.locals as any).user = user;
    } catch {
      return context.redirect('/admin/login');
    }
  }

  return next();
});
