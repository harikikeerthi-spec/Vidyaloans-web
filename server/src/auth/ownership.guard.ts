import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class OwnershipOrStaffGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
    private supabase: SupabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    let user = request.user;

    const staffRoles = [
      'staff',
      'admin',
      'super_admin',
      'superadmin',
      'support',
      'agent',
      'partner_agent',
      'analyst',
      'marketing',
      'it',
      'bank',
      'partner_bank',
    ];

    // 1. If user is not yet set by previous guard, attempt to authenticate
    if (!user) {
      const authHeader = request.headers.authorization;
      const candidateTokens: string[] = [];

      // A. Authorization header Bearer token
      if (authHeader) {
        const [type, tokenStr] = authHeader.split(' ');
        if (type === 'Bearer' && tokenStr) {
          candidateTokens.push(tokenStr);
        }
      }

      // B. Query parameter token (for downloads, exports, zip, view, preview)
      if (request.query && request.query.token) {
        const path = ((request.baseUrl || '') + (request.path || request.url || '')).toLowerCase();
        const isDownloadOrView =
          path.includes('/download') ||
          path.includes('/export') ||
          path.includes('/zip') ||
          path.includes('/view');
        if (isDownloadOrView && typeof request.query.token === 'string') {
          candidateTokens.push(request.query.token);
        }
      }

      // C. Cookie candidates in priority order (staff & admin tokens FIRST)
      const priorityCookieKeys = [
        'staffAccessToken',
        'adminAccessToken',
        'itAccessToken',
        'bankAccessToken',
        'agentAccessToken',
        'accessToken',
        'token',
        'jwt',
        'auth_token',
      ];

      if (request.cookies) {
        for (const key of priorityCookieKeys) {
          if (request.cookies[key] && !candidateTokens.includes(request.cookies[key])) {
            candidateTokens.push(request.cookies[key]);
          }
        }
      }

      if (request.headers.cookie) {
        const rawCookies = request.headers.cookie.split(';');
        const cookieMap = new Map<string, string>();
        for (const c of rawCookies) {
          const eqIdx = c.indexOf('=');
          if (eqIdx !== -1) {
            const k = c.slice(0, eqIdx).trim();
            const v = c.slice(eqIdx + 1).trim();
            if (k && v) {
              cookieMap.set(k, decodeURIComponent(v));
            }
          }
        }
        for (const key of priorityCookieKeys) {
          const val = cookieMap.get(key);
          if (val && !candidateTokens.includes(val)) {
            candidateTokens.push(val);
          }
        }
      }

      if (candidateTokens.length === 0) {
        throw new UnauthorizedException('Authentication required');
      }

      // Try verifying each candidate token in priority order
      let verifiedPayload: any = null;

      for (const t of candidateTokens) {
        try {
          verifiedPayload = await this.jwtService.verifyAsync(t);
          if (verifiedPayload) break;
        } catch (err: any) {
          if (err.name === 'TokenExpiredError') {
            try {
              const expPayload = await this.jwtService.verifyAsync(t, { ignoreExpiration: true });
              const r = (expPayload.role || '').toLowerCase();
              if (staffRoles.includes(r)) {
                verifiedPayload = expPayload;
                break;
              }
            } catch (_) { }
          }
        }
      }

      if (!verifiedPayload) {
        throw new UnauthorizedException('Invalid or expired authentication token');
      }

      user = {
        id: verifiedPayload.sub || verifiedPayload.id,
        email: verifiedPayload.email,
        role: verifiedPayload.role || 'user',
        firstName: verifiedPayload.firstName,
        lastName: verifiedPayload.lastName,
        bankId: verifiedPayload.bankId,
      };
      request.user = user;
    }

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const role = (user.role || '').toLowerCase();

    // 2. Staff and Administrator roles have full access
    if (staffRoles.includes(role)) {
      return true;
    }

    // 3. Extract target userId or email from route params, query, or body
    const targetUserId =
      request.params?.userId ||
      request.query?.userId ||
      request.body?.userId ||
      request.body?.email ||
      request.params?.email ||
      request.query?.email;

    // 4. Bank Role: Check student consent
    if (['bank', 'partner_bank'].includes(role)) {
      const bankId = user.bankId || user.id || request.query?.bankId;
      if (!targetUserId) {
        return true;
      }
      if (!bankId) {
        throw new ForbiddenException('Bank identifier missing from request context');
      }

      const { data: consent } = await this.supabase.client
        .from('StudentBankConsent')
        .select('isGranted')
        .eq('studentId', targetUserId)
        .eq('bankId', bankId)
        .maybeSingle();

      if (!consent?.isGranted) {
        throw new ForbiddenException(
          'Access denied: Student consent is required for this bank to access this resource.',
        );
      }
      return true;
    }

    // 5. Standard Student / User Role: Enforce Ownership
    if (targetUserId) {
      const isOwner =
        user.id === targetUserId ||
        (user.email && user.email.toLowerCase() === targetUserId.toLowerCase());

      if (!isOwner) {
        throw new ForbiddenException(
          'Access denied: You do not have permission to access or modify another user\'s resources.',
        );
      }
    }

    return true;
  }
}
