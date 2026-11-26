import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PORTAL_CONFIGS = [
  {
    prefix: '/admin',
    loginPath: '/admin/login',
    cookieKeys: ['adminAccessToken', 'superAdminAccessToken', 'accessToken', 'token'],
    allowedRoles: ['admin', 'super_admin', 'staff_admin'],
  },
  {
    prefix: '/staff',
    loginPath: '/staff/login',
    cookieKeys: ['staffAccessToken', 'adminAccessToken', 'superAdminAccessToken', 'accessToken', 'token'],
    allowedRoles: ['staff', 'support', 'admin', 'super_admin', 'staff_admin'],
  },
  {
    prefix: '/bank',
    loginPath: '/bank/login',
    cookieKeys: ['bankAccessToken', 'adminAccessToken', 'superAdminAccessToken', 'accessToken', 'token'],
    allowedRoles: ['bank', 'partner_bank', 'admin', 'super_admin', 'staff_admin'],
  },
  {
    prefix: '/it',
    loginPath: '/it/login',
    cookieKeys: ['itAccessToken', 'adminAccessToken', 'superAdminAccessToken', 'accessToken', 'token'],
    allowedRoles: ['it', 'it_admin', 'admin', 'super_admin', 'staff_admin'],
  },
  {
    prefix: '/agent',
    loginPath: '/agent/login',
    cookieKeys: ['agentAccessToken', 'adminAccessToken', 'superAdminAccessToken', 'accessToken', 'token'],
    allowedRoles: ['agent', 'partner_agent', 'admin', 'super_admin', 'staff_admin'],
  },
  {
    prefix: '/analyst',
    loginPath: '/analyst/login',
    cookieKeys: ['analystAccessToken', 'adminAccessToken', 'superAdminAccessToken', 'accessToken', 'token'],
    allowedRoles: ['analyst', 'admin', 'super_admin', 'staff_admin'],
  },
  {
    prefix: '/marketing',
    loginPath: '/marketing/login',
    cookieKeys: ['marketingAccessToken', 'adminAccessToken', 'superAdminAccessToken', 'accessToken', 'token'],
    allowedRoles: ['marketing', 'admin', 'super_admin', 'staff_admin'],
  },
];

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    const payload = JSON.parse(json);
    if (!payload || typeof payload !== 'object') return null;
    if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function isRoleAllowedForPortal(role: string, allowedRoles: string[], prefix: string): boolean {
  const normalized = role.toLowerCase();
  if (allowedRoles.includes(normalized)) return true;
  if (prefix === '/bank' && normalized.startsWith('bank_')) return true;
  return false;
}

export function proxy(request: NextRequest) {
  const url = new URL(request.url);
  const { pathname } = url;

  // 1. Server-side protection for back-office portal routes
  const matchedPortal = PORTAL_CONFIGS.find(
    (p) => pathname === p.prefix || pathname.startsWith(`${p.prefix}/`),
  );

  if (matchedPortal && pathname !== matchedPortal.loginPath && !pathname.startsWith(`${matchedPortal.loginPath}/`)) {
    let authorized = false;

    for (const key of matchedPortal.cookieKeys) {
      const token = request.cookies.get(key)?.value;
      if (!token) continue;
      const payload = decodeJwtPayload(token);
      if (!payload) continue;
      const role = typeof payload.role === 'string' ? payload.role : '';
      if (isRoleAllowedForPortal(role, matchedPortal.allowedRoles, matchedPortal.prefix)) {
        authorized = true;
        break;
      }
    }

    if (!authorized) {
      const loginUrl = new URL(matchedPortal.loginPath, request.url);
      loginUrl.searchParams.set('redirect', pathname + url.search);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 2. Referral code cookie capture on public landing pages
  const ref = url.searchParams.get('ref');
  if (ref) {
    const targetPages = ['/', '/apply-loan', '/loan-eligibility'];
    if (targetPages.includes(pathname)) {
      const existingCookie = request.cookies.get('referral_code');
      if (!existingCookie) {
        const response = NextResponse.next();
        response.cookies.set('referral_code', ref, {
          maxAge: 30 * 24 * 60 * 60, // 30 days
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
        });
        return response;
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/apply-loan',
    '/loan-eligibility',
    '/admin/:path*',
    '/staff/:path*',
    '/bank/:path*',
    '/it/:path*',
    '/agent/:path*',
    '/analyst/:path*',
    '/marketing/:path*',
  ],
};
