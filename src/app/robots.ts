import type { MetadataRoute } from 'next';
import { getAppUrl } from '@/lib/config/app-url';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getAppUrl();
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

