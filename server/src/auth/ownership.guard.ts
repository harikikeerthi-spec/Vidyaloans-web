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

    // 1. If user is not yet set by previous guard, attempt to authenticate
    if (!user) {
      const authHeader = request.headers.authorization;
      let token: string | undefined;

      if (authHeader) {
        const [type, tokenStr] = authHeader.split(' ');
        if (type === 'Bearer' && tokenStr) {
          token = tokenStr;
        }
      } else if (request.query && request.query.token) {
        const path = (request.baseUrl || '') + (request.path || request.url || '');
        const isDownloadOrView =
          path.includes('/download') ||
          path.includes('/export') ||
          path.includes('/zip') ||
          path.includes('/view');
        if (isDownloadOrView) {
          token = request.query.token as string;
        }
      } else if (request.cookies) {
        token =
          request.cookies.accessToken ||
          request.cookies.token ||
          request.cookies.staffAccessToken ||
          request.cookies.adminAccessToken;
      }

      if (!token) {
        throw new UnauthorizedException('Authentication required');
      }

      try {
        const payload = await this.jwtService.verifyAsync(token);
        user = {
          id: payload.sub || payload.id,
          email: payload.email,
          role: payload.role || 'user',
          firstName: payload.firstName,
          lastName: payload.lastName,
          bankId: payload.bankId,
        };
        request.user = user;
      } catch (err) {
        throw new UnauthorizedException('Invalid or expired authentication token');
      }
    }

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const role = (user.role || '').toLowerCase();

    // 2. Staff and Administrator roles have full access
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
    ];
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
