// src/lib/config/app-url.ts
// Server-safe canonical origin resolver supporting Vercel production/preview URLs cleanly.

export function getAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  const prodHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (prodHost) {
    return `https://${prodHost.replace(/^https?:\/\//i, '').replace(/\/+$/, '')}`;
  }

  const previewHost = process.env.VERCEL_URL?.trim();
  if (previewHost) {
    return `https://${previewHost.replace(/^https?:\/\//i, '').replace(/\/+$/, '')}`;
  }

  return 'http://localhost:3000';
}

export function getAppUrlHost(): string {
  try {
    return new URL(getAppUrl()).host;
  } catch {
    return 'localhost:3000';
  }
}
