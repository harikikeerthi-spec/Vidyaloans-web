import {
    Injectable,
    CanActivate,
    ExecutionContext,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';

/**
 * Guard that extracts and verifies authentication token if present,
 * but allows the request through with request.user = null if absent or invalid.
 * Ideal for public forms (such as loan applications) that can be submitted
 * either by logged-in users or by guest candidates.
 */
@Injectable()
export class OptionalUserGuard implements CanActivate {
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
            if (type === 'Bearer' && tokenStr) {
                token = tokenStr;
            }
        } else if (request.query && request.query.token) {
            token = request.query.token as string;
        } else if (request.cookies) {
            token =
                request.cookies.itAccessToken ||
                request.cookies.accessToken ||
                request.cookies.token ||
                request.cookies.staffAccessToken ||
                request.cookies.adminAccessToken;
        }

        if (!token && request.headers.cookie) {
            const rawCookies = request.headers.cookie.split(';');
            for (const c of rawCookies) {
                const [k, v] = c.trim().split('=');
                if (['itAccessToken', 'accessToken', 'token', 'staffAccessToken', 'adminAccessToken'].includes(k)) {
                    token = decodeURIComponent(v || '');
                    break;
                }
            }
        }

        if (!token) {
            request.user = null;
            return true;
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
            if (user) {
                request.user = user;
            } else {
                request.user = null;
            }
        } catch {
            request.user = null;
        }

        return true;
    }
}

