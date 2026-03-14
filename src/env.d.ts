/// <reference types="astro/client" />
/// <reference types="@astrojs/cloudflare/types" />

// Fix #10: Properly typed cloudflare:workers env bindings (no more `env as any`)
// These match the binding names in wrangler.jsonc exactly.
declare module 'cloudflare:workers' {
  export const env: {
    /** D1 database — articles, categories, authors, tags */
    DB: {
      prepare(query: string): {
        bind(...values: any[]): {
          first<T = any>(): Promise<T | null>;
          all<T = any>(): Promise<{ results: T[] }>;
          run(): Promise<{ meta: { last_row_id: number; changes: number } }>;
        };
      };
    };
    /** KV namespace — admin session tokens (TTL: 24h) */
    SESSION: {
      get(key: string): Promise<string | null>;
      put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
      delete(key: string): Promise<void>;
    };
    /** KV namespace — page cache + view-count dedup */
    CACHE: {
      get(key: string): Promise<string | null>;
      put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
      delete(key: string): Promise<void>;
    };
    /** R2 bucket — uploaded media files */
    MEDIA: {
      put(key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType?: string } }): Promise<void>;
      get(key: string): Promise<{
        body: ReadableStream;
        httpEtag: string;
        writeHttpMetadata(headers: Headers): void;
      } | null>;
      delete(key: string): Promise<void>;
    };
    /** Static assets binding */
    ASSETS: { fetch(request: Request): Promise<Response> };
  };
  export const ctx: {
    waitUntil(promise: Promise<any>): void;
    passThroughOnException(): void;
  };
}
