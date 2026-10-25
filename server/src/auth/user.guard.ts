import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';

@Injectable()
export class UserGuard implements CanActivate {
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
            // Allow token in query string for file preview, view, download, and export routes
            const path = (request.path || request.url || '').toLowerCase();
            const isDownloadRoute =
                path.includes('/download') ||
                path.includes('/export') ||
                path.includes('/view') ||
                path.includes('/zip') ||
                path.includes('/presigned');
            if (isDownloadRoute) {
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
            throw new UnauthorizedException('No authorization token provided');
        }

        try {
            const payload = await this.jwtService.verifyAsync(token);

            if (payload && payload.email) {
                request.user = {
                    id: payload.sub || payload.id,
                    email: payload.email,
                    role: payload.role,
                    firstName: payload.firstName,
                    lastName: payload.lastName,
                };
                return true;
            }

            const user = await this.usersService.findOne(payload.email);
            if (!user) {
                throw new UnauthorizedException('User not found');
            }

            request.user = user;
            return true;
        } catch (error) {
            if (error instanceof UnauthorizedException) {
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
