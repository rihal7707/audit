import type { MetadataRoute } from 'next';
import { getAppUrl } from '@/lib/config/app-url';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getAppUrl();
  const routes = ['', '/audit', '/sample-report', '/how-we-inspect', '/privacy', '/terms'];
  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '' ? 'weekly' : 'monthly',
    priority: route === '' ? 1 : 0.7,
  }));
}

