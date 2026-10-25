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
export class StaffGuard implements CanActivate {
    constructor(
        private jwtService: JwtService,
        private usersService: UsersService
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers.authorization;
        let token: string | undefined;

        if (authHeader) {
            const [type, tokenStr] = authHeader.split(' ');
            if (type !== 'Bearer' || !tokenStr) {
                throw new UnauthorizedException('Invalid authorization format');
            }
            token = tokenStr;
        } else if (request.query && request.query.token) {
            // Only allow token in query string for specific file download/export routes
            const path = (request.path || request.url || '').toLowerCase();
            const isDownloadRoute = path.includes('/download') || path.includes('/export');
            if (isDownloadRoute) {
                token = request.query.token as string;
            }
        } else if (request.cookies) {
            token = request.cookies.staffAccessToken || request.cookies.adminAccessToken || request.cookies.accessToken;
        }

        if (!token) {
            throw new UnauthorizedException('No authorization token provided');
        }

        try {
            // Verify JWT token signature and expiry
            const payload = await this.jwtService.verifyAsync(token);

            // StaffGuard explicitly allows staff, admin, super_admin, and operational roles (excluding students/users)
            const allowedRoles = [
                'staff',
                'admin',
                'super_admin',
                'support',
                'agent',
                'partner_agent',
                'analyst',
                'marketing',
                'bank',
                'partner_bank',
                'it',
            ];

            const payloadRoleLower = (payload.role || '').toLowerCase();
            let userRole = payloadRoleLower;

            if (!userRole) {
                const user = await this.usersService.findOne(payload.email);
                if (!user) {
                    throw new UnauthorizedException('User not found');
                }
                userRole = (user.role || '').toLowerCase();
                request.user = user;
            } else {
                let mailboxEmail = payload.mailboxEmail;
                let mailboxPrefix = payload.mailboxPrefix;
                let canAccessSupport = payload.canAccessSupport;

                if (payloadRoleLower === 'staff') {
                    try {
                        const dbUser = await this.usersService.findOne(payload.email);
                        if (dbUser) {
                            mailboxEmail = dbUser.mailboxEmail || mailboxEmail;
                            mailboxPrefix = dbUser.mailboxPrefix || mailboxPrefix;
                            canAccessSupport = dbUser.canAccessSupport;
                        }
                    } catch (e) {
                        // Non-blocking lookup
                    }
                }

                request.user = {
                    id: payload.sub || payload.id,
                    email: payload.email,
                    role: payload.role,
                    firstName: payload.firstName,
                    lastName: payload.lastName,
                    mailboxEmail,
                    mailboxPrefix,
                    canAccessSupport,
                };
            }

            if (!allowedRoles.includes(userRole) && !userRole.startsWith('bank_')) {
                throw new ForbiddenException('Access denied. Staff privileges required.');
            }

            return true;
        } catch (error) {
            if (error instanceof ForbiddenException || error instanceof UnauthorizedException) {
                throw error;
            }

            if (error.name === 'TokenExpiredError') {
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
