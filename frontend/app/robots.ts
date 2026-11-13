import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://vidyaloans.in').replace(/\/$/, '');

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/bank/*',
          '/bank-reviews',
        ],
        disallow: [
          '/dashboard',
          '/document-vault',
          '/profile',
          '/support-tickets',
          '/user-details',
          '/staff/',
          '/admin/',
          '/agent/',
          '/it/',
          '/api/',
          '/webmail/',
          // Exact internal bank portal routes (keeps public /bank/[slug] and /bank-reviews indexable)
          '/bank/dashboard',
          '/bank/login',
          '/bank/applications',
          '/bank/analytics',
          '/bank/assignment',
          '/bank/calendar',
          '/bank/chat',
          '/bank/decisions',
          '/bank/disbursements',
          '/bank/documents',
          '/bank/fees',
          '/bank/incoming',
          '/bank/settings',
          '/bank/support-tickets',
          '/bank/tasks',
          '/bank/team-dashboard',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
