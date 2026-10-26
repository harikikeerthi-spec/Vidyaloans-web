import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://www.vidyaloans.in';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard',
          '/document-vault',
          '/profile',
          '/support-tickets',
          '/user-details',
          '/staff',
          '/admin',
          '/bank',
          '/agent',
          '/it',
          '/api',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
