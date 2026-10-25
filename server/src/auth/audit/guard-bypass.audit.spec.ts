import { ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AdminGuard } from '../admin.guard';
import { StaffGuard } from '../staff.guard';
import { UserGuard } from '../user.guard';

describe('Guard Bypass Audit Regression Tests', () => {
    let jwtService: jest.Mocked<JwtService>;
    let usersService: any;
    let adminGuard: AdminGuard;
    let staffGuard: StaffGuard;
    let userGuard: UserGuard;

    beforeEach(() => {
        jwtService = {
            verifyAsync: jest.fn(),
        } as any;

        usersService = {
            findOne: jest.fn(),
        };

        adminGuard = new AdminGuard(jwtService, usersService);
        staffGuard = new StaffGuard(jwtService, usersService);
        userGuard = new UserGuard(jwtService, usersService);
    });

    const createMockContext = (req: Partial<any>): ExecutionContext => {
        return {
            switchToHttp: () => ({
                getRequest: () => ({
                    headers: {},
                    query: {},
                    body: {},
                    url: '/api/admin/users',
                    path: '/api/admin/users',
                    ...req,
                }),
            }),
        } as unknown as ExecutionContext;
    };

    // Case 1: AdminGuard - header x-portal: it without token
    it('Case 1: AdminGuard must reject request with x-portal: it header and no token', async () => {
        const ctx = createMockContext({
            headers: { 'x-portal': 'it' },
        });
        await expect(adminGuard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    // Case 2: AdminGuard - referer /it without token
    it('Case 2: AdminGuard must reject request with Referer containing /it and no token', async () => {
        const ctx = createMockContext({
            headers: { referer: 'https://vidyaloans.in/it/dashboard' },
        });
        await expect(adminGuard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    // Case 3: AdminGuard - body contains userId without token
    it('Case 3: AdminGuard must reject request with body.userId and no token', async () => {
        const ctx = createMockContext({
            body: { userId: 'attacker-id', email: 'admin@test.com' },
        });
        await expect(adminGuard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    // Case 4: AdminGuard - query contains userId without token
    it('Case 4: AdminGuard must reject request with query.userId and no token', async () => {
        const ctx = createMockContext({
            query: { userId: 'attacker-id' },
        });
        await expect(adminGuard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    // Case 5: AdminGuard - valid token with student role 'user'
    it('Case 5: AdminGuard must reject valid token having student role "user"', async () => {
        jwtService.verifyAsync.mockResolvedValueOnce({
            sub: 'student-123',
            email: 'student@example.com',
            role: 'user',
        });
        const ctx = createMockContext({
            headers: { authorization: 'Bearer valid.jwt.token' },
        });
        await expect(adminGuard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    // Case 6: StaffGuard - header x-portal: it without token
    it('Case 6: StaffGuard must reject request with x-portal: it header and no token', async () => {
        const ctx = createMockContext({
            headers: { 'x-portal': 'it' },
        });
        await expect(staffGuard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    // Case 7: StaffGuard - body contains authorId/userId without token
    it('Case 7: StaffGuard must reject request with body.userId/authorId and no token', async () => {
        const ctx = createMockContext({
            body: { authorId: 'attacker-author-id' },
        });
        await expect(staffGuard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    // Case 8: StaffGuard - valid token with student role 'user'
    it('Case 8: StaffGuard must reject valid token having role "user"', async () => {
        jwtService.verifyAsync.mockResolvedValueOnce({
            sub: 'student-123',
            email: 'student@example.com',
            role: 'user',
        });
        const ctx = createMockContext({
            headers: { authorization: 'Bearer valid.jwt.token' },
        });
        await expect(staffGuard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    // Case 9: UserGuard - body contains userId/email without token
    it('Case 9: UserGuard must reject request with body.userId and no token', async () => {
        const ctx = createMockContext({
            body: { userId: 'guest-user', email: 'guest@example.com' },
        });
        await expect(userGuard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    // Case 10: AdminGuard - query token ignored on normal non-download API routes
    it('Case 10: AdminGuard must ignore query ?token= on non-download routes and reject with 401', async () => {
        const ctx = createMockContext({
            url: '/api/admin/sensitive-data',
            path: '/api/admin/sensitive-data',
            query: { token: 'sensitive.jwt.token' },
        });
        await expect(adminGuard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });
});
