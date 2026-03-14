/// <reference types="astro/client" />
/// <reference types="@astrojs/cloudflare/types" />

// Declare the cloudflare:workers virtual module (runtime-provided by workerd)
// Using broad typing here — actual runtime types are enforced by the Cloudflare adapter
declare module 'cloudflare:workers' {
  export const env: Record<string, any>;
  export const ctx: {
    waitUntil(promise: Promise<any>): void;
    passThroughOnException(): void;
  };
}
