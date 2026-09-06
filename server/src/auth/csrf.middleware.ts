import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { doubleCsrfProtection } from './csrf.service';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private isExemptPath(url: string): boolean {
    const cleanUrl = url.toLowerCase();
    return (
      cleanUrl.includes('/webhook') ||
      cleanUrl.includes('/integration/whatsapp') ||
      cleanUrl.includes('/csrf-token') ||
      cleanUrl.includes('/auth/csrf-token') ||
      cleanUrl.includes('/documents/upload') ||
      cleanUrl.includes('/documents/complete-upload') ||
      cleanUrl.includes('/auth/upload-document') ||
      cleanUrl.includes('/upload-statement') ||
      cleanUrl.includes('/auth/send-otp') ||
      cleanUrl.includes('/auth/send-otp/') ||
      cleanUrl.includes('/auth/verify-otp') ||
      cleanUrl.includes('/auth/request-otp') ||
      cleanUrl.includes('/auth/firebase') ||
      cleanUrl.includes('/auth/landing-page-submit') ||
      cleanUrl.includes('/auth/refresh') ||
      cleanUrl.includes('/auth/login') ||
      cleanUrl.includes('/auth/logout') ||
      cleanUrl.includes('/auth/dashboard') ||
      cleanUrl.includes('/auth/dashboard-data') ||
      cleanUrl.includes('/auth/user-details') ||
      cleanUrl.includes('/digilocker/callback')
    );
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
