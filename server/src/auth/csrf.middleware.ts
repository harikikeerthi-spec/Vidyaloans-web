import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { doubleCsrfProtection } from './csrf.service';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private static readonly EXEMPT_EXACT_ROUTES = new Set([
    '/api/csrf-token',
    '/api/auth/csrf-token',
    '/api/documents/upload',
    '/api/documents/complete-upload',
    '/api/auth/upload-document',
    '/api/statements/upload',
    '/api/upload-statement',
    '/api/auth/send-otp',
    '/api/auth/verify-otp',
    '/api/auth/request-otp',
    '/api/auth/check-bank-officer',
    '/api/auth/firebase',
    '/api/auth/landing-page-submit',
    '/api/auth/refresh',
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/dashboard',
    '/api/auth/dashboard-data',
    '/api/auth/user-details',
    '/api/digilocker/callback',
    // Fallback for paths without /api prefix
    '/csrf-token',
    '/auth/csrf-token',
    '/documents/upload',
    '/documents/complete-upload',
    '/auth/upload-document',
    '/statements/upload',
    '/upload-statement',
    '/auth/send-otp',
    '/auth/verify-otp',
    '/auth/request-otp',
    '/auth/check-bank-officer',
    '/auth/firebase',
    '/auth/landing-page-submit',
    '/auth/refresh',
    '/auth/login',
    '/auth/logout',
    '/auth/dashboard',
    '/auth/dashboard-data',
    '/auth/user-details',
    '/digilocker/callback',
  ]);

  private static readonly EXEMPT_PREFIXES = [
    '/api/webhook',
    '/webhook',
    '/api/integration/whatsapp',
    '/integration/whatsapp',
    '/api/statements/',
    '/statements/',
    '/api/webmail/',
    '/webmail/',
    '/api/webmail',
    '/webmail',
  ];

  private isExemptPath(url: string): boolean {
    const cleanPath = (url || '').split('?')[0].toLowerCase();
    if (CsrfMiddleware.EXEMPT_EXACT_ROUTES.has(cleanPath)) {
      return true;
    }
    return CsrfMiddleware.EXEMPT_PREFIXES.some(prefix => cleanPath.startsWith(prefix));
  }

  use(req: Request, res: Response, next: NextFunction) {
    // Exempt GET, HEAD, OPTIONS, exempted public auth/webhook/callback paths,
    // and requests with Bearer tokens (immune to CSRF attacks)
    const hasBearerAuth = req.headers['authorization']?.startsWith('Bearer ');
    if (
      ['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase()) ||
      this.isExemptPath(req.originalUrl || req.url) ||
      hasBearerAuth
    ) {
      return next();
    }

    doubleCsrfProtection(req, res, (err: any) => {
      if (err) {
        throw new ForbiddenException(
          err.message || 'CSRF Validation Failed: Missing or invalid CSRF token header (X-CSRF-Token)'
        );
      }
      next();
    });
  }
}
