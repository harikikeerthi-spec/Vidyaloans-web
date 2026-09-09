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
        } else if (request.query.token) {
            token = request.query.token as string;
        }

        if (!token) {
            throw new UnauthorizedException('No authorization token provided');
        }

        try {
            // Verify JWT token signature and expiry
            const payload = await this.jwtService.verifyAsync(token);

            const allowedRoles = ['staff', 'admin', 'super_admin', 'bank', 'partner_bank', 'support', 'it', 'user', 'agent', 'partner_agent'];

            // Fast path: role is embedded in the JWT payload — no DB lookup needed
            const payloadRoleLower = (payload.role || '').toLowerCase();
            if (payload.role && (allowedRoles.includes(payloadRoleLower) || payloadRoleLower.startsWith('bank_'))) {
                let mailboxEmail = payload.mailboxEmail;
                let mailboxPrefix = payload.mailboxPrefix;
                let canAccessSupport = payload.canAccessSupport;

                if (payloadRoleLower === 'staff' && (mailboxEmail === undefined || mailboxPrefix === undefined)) {
                    try {
                        const dbUser = await this.usersService.findOne(payload.email);
                        if (dbUser) {
                            mailboxEmail = dbUser.mailboxEmail;
                            mailboxPrefix = dbUser.mailboxPrefix;
                            canAccessSupport = dbUser.canAccessSupport;
                        }
                    } catch (e) {
                        // Non-blocking fallback
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
                return true;
            }

            // Slow path: role not in payload, fetch from DB
            const user = await this.usersService.findOne(payload.email);

            if (!user) {
                console.error('[StaffGuard] User not found in DB for email:', payload.email);
                throw new UnauthorizedException('User not found');
            }

            const dbRoleLower = (user.role || '').toLowerCase();
            if (!allowedRoles.includes(dbRoleLower) && !dbRoleLower.startsWith('bank_')) {
                console.warn(`[StaffGuard] Access denied for role: ${user.role}. User: ${user.email}`);
                throw new ForbiddenException('Access denied. Elevated privileges required.');
            }

            request.user = user;
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
                    hint: 'Please use the /auth/refresh endpoint with your refresh_token to get a new access token'
                });
            }

            console.error('[StaffGuard] Token verification failed:', error.message || error);
            throw new UnauthorizedException('Invalid token');
        }
    }
}
