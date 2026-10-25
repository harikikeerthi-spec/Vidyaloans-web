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

        // 1. Extract Bearer token from Authorization header
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
        }

        if (!token) {
            throw new UnauthorizedException('No authorization token provided');
        }

        try {
            // Verify JWT token signature and expiry
            const payload = await this.jwtService.verifyAsync(token);

            // AdminGuard strictly allows only admin and super_admin
            const allowedRoles = ['admin', 'super_admin'];
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
