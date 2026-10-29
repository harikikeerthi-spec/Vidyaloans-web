import { Injectable } from '@nestjs/common';
import { doubleCsrf, DoubleCsrfUtilities } from 'csrf-csrf';
import { Request, Response } from 'express';

const csrfSecret = process.env.CSRF_SECRET;

export const doubleCsrfUtilities: DoubleCsrfUtilities = doubleCsrf({
  getSecret: () => csrfSecret,
  getSessionIdentifier: () => 'vidyaloans_global_csrf_session',
  cookieName: 'x-csrf-token',
  cookieOptions: {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  },
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getCsrfTokenFromRequest: (req: Request) => {
    const header = req.headers['x-csrf-token'] || req.headers['X-CSRF-Token'];
    if (Array.isArray(header)) {
      return header[0];
    }
    return header || '';
  },
});

export const doubleCsrfProtection = doubleCsrfUtilities.doubleCsrfProtection;

@Injectable()
export class CsrfService {
  /**
   * Generates a CSRF token and sets the corresponding cookie on the response object
   */
  public generateCsrfToken(req: Request, res: Response): string {
    return doubleCsrfUtilities.generateCsrfToken(req, res);
  }

  /**
   * Validates an incoming request manually if needed
   */
  public isValidRequest(req: Request): boolean {
    return doubleCsrfUtilities.validateRequest(req);
  }
}
