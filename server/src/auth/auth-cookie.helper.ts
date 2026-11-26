import { Response, CookieOptions } from 'express';

export interface SetAuthCookiesOptions {
  accessToken: string;
  refreshToken?: string;
  role?: string;
}

export function getCookieOptions(maxAgeMs?: number): CookieOptions {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    ...(maxAgeMs !== undefined ? { maxAge: maxAgeMs } : {}),
  };
}

export const AUTH_COOKIE_NAMES = [
  'accessToken',
  'token',
  'refreshToken',
  'adminAccessToken',
  'adminRefreshToken',
  'superAdminAccessToken',
  'itAccessToken',
  'itRefreshToken',
  'staffAccessToken',
  'staffRefreshToken',
  'bankAccessToken',
  'bankRefreshToken',
  'agentAccessToken',
  'agentRefreshToken',
  'analystAccessToken',
  'analystRefreshToken',
  'jwt',
  'auth_token',
] as const;

export function setAuthCookies(res: Response, options: SetAuthCookiesOptions): void {
  if (!res || typeof res.cookie !== 'function') return;

  const role = (options.role || '').toLowerCase();
  const isStaffOrAdmin = ['admin', 'super_admin', 'staff', 'staff_admin', 'it', 'it_admin'].includes(role);

  // 24 hours for staff/admin/IT; standard max age for access tokens
  const accessMaxAge = (isStaffOrAdmin ? 24 : 24) * 60 * 60 * 1000;
  const refreshMaxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

  const accessCookieOpts = getCookieOptions(accessMaxAge);
  const refreshCookieOpts = getCookieOptions(refreshMaxAge);

  // 1. Always set generic HttpOnly access and refresh tokens
  res.cookie('accessToken', options.accessToken, accessCookieOpts);
  res.cookie('token', options.accessToken, accessCookieOpts);

  if (options.refreshToken) {
    res.cookie('refreshToken', options.refreshToken, refreshCookieOpts);
  }

  // 2. Set portal-specific cookies based on role
  if (role === 'admin' || role === 'super_admin') {
    res.cookie('adminAccessToken', options.accessToken, accessCookieOpts);
    if (options.refreshToken) {
      res.cookie('adminRefreshToken', options.refreshToken, refreshCookieOpts);
    }
  }

  if (role === 'it' || role === 'it_admin') {
    res.cookie('itAccessToken', options.accessToken, accessCookieOpts);
    res.cookie('staffAccessToken', options.accessToken, accessCookieOpts);
    if (options.refreshToken) {
      res.cookie('itRefreshToken', options.refreshToken, refreshCookieOpts);
      res.cookie('staffRefreshToken', options.refreshToken, refreshCookieOpts);
    }
  }

  if (role === 'bank' || role === 'partner_bank') {
    res.cookie('bankAccessToken', options.accessToken, accessCookieOpts);
    if (options.refreshToken) {
      res.cookie('bankRefreshToken', options.refreshToken, refreshCookieOpts);
    }
  }

  if (role === 'staff' || role === 'staff_admin') {
    res.cookie('staffAccessToken', options.accessToken, accessCookieOpts);
    if (options.refreshToken) {
      res.cookie('staffRefreshToken', options.refreshToken, refreshCookieOpts);
    }
  }

  if (role === 'agent' || role === 'partner_agent') {
    res.cookie('agentAccessToken', options.accessToken, accessCookieOpts);
    if (options.refreshToken) {
      res.cookie('agentRefreshToken', options.refreshToken, refreshCookieOpts);
    }
  }
}

export function clearAuthCookies(res: Response): void {
  if (!res || typeof res.clearCookie !== 'function') return;

  const clearOptions = getCookieOptions(0);
  for (const cookieName of AUTH_COOKIE_NAMES) {
    res.clearCookie(cookieName, clearOptions);
  }
}
