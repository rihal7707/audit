import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/audit', '/sample-report', '/how-we-inspect', '/privacy', '/terms'],
        disallow: ['/report/', '/audit/progress/', '/admin/', '/api/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

