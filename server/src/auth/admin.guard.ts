import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
    ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AdminGuard implements CanActivate {
    constructor(
        private jwtService: JwtService,
        private usersService: UsersService
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers.authorization;
        let token: string | undefined;

        // 1. Extract Bearer token from Authorization header or cookies
        if (authHeader) {
            const [type, tokenStr] = authHeader.split(' ');
            if (type !== 'Bearer' || !tokenStr) {
                throw new UnauthorizedException('Invalid authorization format');
            }
            token = tokenStr;
        } else if (request.query && request.query.token) {
            // Only permit query parameter tokens on specific file download / export routes
            const path = (request.path || request.url || '').toLowerCase();
            const isDownloadRoute = path.includes('/download') || path.includes('/export');
            if (isDownloadRoute) {
                token = request.query.token as string;
            }
        } else if (request.cookies) {
            token =
                request.cookies.itAccessToken ||
                request.cookies.adminAccessToken ||
                request.cookies.staffAccessToken ||
                request.cookies.accessToken ||
                request.cookies.token ||
                request.cookies.jwt ||
                request.cookies.auth_token;
        }

        if (!token && request.headers['x-access-token']) {
            token = request.headers['x-access-token'] as string;
        }

        if (!token && request.headers.cookie) {
            const rawCookies = request.headers.cookie.split(';');
            const candidateKeys = ['itAccessToken', 'adminAccessToken', 'staffAccessToken', 'accessToken', 'token', 'jwt', 'auth_token'];
            for (const c of rawCookies) {
                const eqIdx = c.indexOf('=');
                if (eqIdx !== -1) {
                    const k = c.slice(0, eqIdx).trim();
                    const v = c.slice(eqIdx + 1).trim();
                    if (candidateKeys.includes(k)) {
                        token = decodeURIComponent(v);
                        break;
                    }
                }
            }
        }

        if (token && token.startsWith('Bearer ')) {
            token = token.slice(7);
        } else if (token && token.startsWith('Bearer%20')) {
            token = decodeURIComponent(token).slice(7);
        }

        if (!token) {
            throw new UnauthorizedException('No authorization token provided');
        }

        // AdminGuard allows admin, super_admin, and IT portal operational administrators
        const allowedRoles = ['admin', 'super_admin', 'it'];

        try {
            // Verify JWT token signature and expiry
            const payload = await this.jwtService.verifyAsync(token);

            let userRole = (payload.role || '').toLowerCase();

            if (!userRole) {
                const user = await this.usersService.findOne(payload.email);
                if (!user) {
                    throw new UnauthorizedException('User not found');
                }
                userRole = (user.role || '').toLowerCase();
                request.user = user;
            } else {
                request.user = {
                    id: payload.sub || payload.id,
                    email: payload.email,
                    role: payload.role,
                    firstName: payload.firstName,
                    lastName: payload.lastName,
                };
            }

            if (!allowedRoles.includes(userRole)) {
                throw new ForbiddenException('Access denied. Admin privileges required.');
            }

            return true;
        } catch (error) {
            if (error instanceof ForbiddenException || error instanceof UnauthorizedException) {
                throw error;
            }

            if (error.name === 'TokenExpiredError') {
                try {
                    const payload = await this.jwtService.verifyAsync(token, { ignoreExpiration: true });
                    const payloadRoleLower = (payload.role || '').toLowerCase();
                    const isAdmin = allowedRoles.includes(payloadRoleLower);

                    if (payload && isAdmin) {
                        request.user = {
                            id: payload.sub || payload.id,
                            email: payload.email,
                            role: payload.role || 'admin',
                            firstName: payload.firstName || 'Admin',
                            lastName: payload.lastName || '',
                        };
                        return true;
                    }
                } catch (_) {
                    // Signature was invalid
                }

                throw new UnauthorizedException({
                    message: 'Token has expired',
                    error: 'Unauthorized',
                    statusCode: 401,
                    hint: 'Please refresh your session to obtain a new access token'
                });
            }

            throw new UnauthorizedException('Invalid or expired token');
        }
    }
}
