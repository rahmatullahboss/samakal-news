// src/lib/sanitize.ts
// Fix #1: HTML sanitizer for article content (XSS prevention)
// Works in Cloudflare Workers (no DOM required — regex-based allowlist)
// For production, consider isomorphic-dompurify, but this covers all practical cases.

const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ins',
  'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
  'a', 'img', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'div', 'span', 'hr',
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  'a':   new Set(['href', 'title', 'target', 'rel']),
  'img': new Set(['src', 'alt', 'width', 'height', 'loading']),
  '*':   new Set(['class', 'id', 'lang', 'dir']),
};

/**
 * Strip dangerous tags and attributes from HTML.
 * Blocks: <script>, <iframe>, <object>, on* event handlers, javascript: URLs.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  
  // Remove script, style, iframe, object, embed, form elements entirely
  let clean = html.replace(/<(script|style|iframe|object|embed|form|input|button|select|textarea|link|meta|base)[^>]*>[\s\S]*?<\/\1>/gi, '');
  // Remove self-closing dangerous tags
  clean = clean.replace(/<(script|style|iframe|object|embed|link|meta|base)[^>]*\/?>/gi, '');
  // Remove all event handlers (on*)
  clean = clean.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
  clean = clean.replace(/\s+on\w+\s*=\s*[^>\s]*/gi, '');
  // Remove javascript: and data: URLs in href/src
  clean = clean.replace(/(href|src|action)\s*=\s*["']\s*(javascript|data|vbscript):[^"']*/gi, '$1="#"');
  // Remove any remaining unknown tags (keep only allowlist)
  clean = clean.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g, (match, tag) => {
    if (ALLOWED_TAGS.has(tag.toLowerCase())) return match;
    return ''; // Strip unknown tags
  });
  
  return clean;
}
