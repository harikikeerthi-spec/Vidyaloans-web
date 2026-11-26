import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { setAuthCookies, clearAuthCookies, getCookieOptions, AUTH_COOKIE_NAMES } from '../auth-cookie.helper';
import { AuthService } from '../auth.service';
import { AdminGuard } from '../admin.guard';
import { StaffGuard } from '../staff.guard';
import { UserGuard } from '../user.guard';
import { AgentGuard } from '../agent.guard';
import { SuperAdminGuard } from '../super-admin.guard';

describe('PUB-036 & AUTH-25 Security Audit Regression Tests', () => {
  describe('PUB-036: HttpOnly, Secure, SameSite Cookie Enforcement', () => {
    let mockResponse: {
      cookie: jest.Mock;
      clearCookie: jest.Mock;
    };

    beforeEach(() => {
      mockResponse = {
        cookie: jest.fn(),
        clearCookie: jest.fn(),
      };
    });

    it('PUB-036.1: setAuthCookies must set HttpOnly, SameSite=lax, and Path=/ for student/standard user', () => {
      setAuthCookies(mockResponse as any, {
        accessToken: 'mock-access-token-123',
        refreshToken: 'mock-refresh-token-456',
        role: 'user',
      });

      expect(mockResponse.cookie).toHaveBeenCalled();

      // Check all cookie calls
      for (const call of mockResponse.cookie.mock.calls) {
        const [name, value, options] = call;
        expect(options.httpOnly).toBe(true);
        expect(options.sameSite).toBe('lax');
        expect(options.path).toBe('/');
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      }

      // Check specific cookies set for user
      const cookieNames = mockResponse.cookie.mock.calls.map(c => c[0]);
      expect(cookieNames).toContain('accessToken');
      expect(cookieNames).toContain('token');
      expect(cookieNames).toContain('refreshToken');
    });

    it('PUB-036.2: setAuthCookies must set role-specific HttpOnly cookies for admin', () => {
      setAuthCookies(mockResponse as any, {
        accessToken: 'admin-access-token',
        refreshToken: 'admin-refresh-token',
        role: 'admin',
      });

      const calls = mockResponse.cookie.mock.calls;
      const cookieNames = calls.map(c => c[0]);

      expect(cookieNames).toContain('adminAccessToken');
      expect(cookieNames).toContain('adminRefreshToken');
      expect(cookieNames).toContain('accessToken');
      expect(cookieNames).toContain('refreshToken');

      // Every cookie must have httpOnly: true
      calls.forEach(([, , options]) => {
        expect(options.httpOnly).toBe(true);
        expect(options.sameSite).toBe('lax');
        expect(options.path).toBe('/');
      });
    });

    it('PUB-036.3: setAuthCookies must set role-specific HttpOnly cookies for IT portal', () => {
      setAuthCookies(mockResponse as any, {
        accessToken: 'it-access-token',
        refreshToken: 'it-refresh-token',
        role: 'it',
      });

      const calls = mockResponse.cookie.mock.calls;
      const cookieNames = calls.map(c => c[0]);

      expect(cookieNames).toContain('itAccessToken');
      expect(cookieNames).toContain('itRefreshToken');
      expect(cookieNames).toContain('staffAccessToken');
      expect(cookieNames).toContain('staffRefreshToken');

      calls.forEach(([, , options]) => {
        expect(options.httpOnly).toBe(true);
        expect(options.sameSite).toBe('lax');
      });
    });

    it('PUB-036.4: setAuthCookies must set role-specific HttpOnly cookies for Bank portal', () => {
      setAuthCookies(mockResponse as any, {
        accessToken: 'bank-access-token',
        refreshToken: 'bank-refresh-token',
        role: 'bank',
      });

      const calls = mockResponse.cookie.mock.calls;
      const cookieNames = calls.map(c => c[0]);

      expect(cookieNames).toContain('bankAccessToken');
      expect(cookieNames).toContain('bankRefreshToken');

      calls.forEach(([, , options]) => {
        expect(options.httpOnly).toBe(true);
        expect(options.sameSite).toBe('lax');
      });
    });

    it('PUB-036.5: clearAuthCookies must clear all portal session tokens on logout', () => {
      clearAuthCookies(mockResponse as any);

      expect(mockResponse.clearCookie).toHaveBeenCalled();
      const clearedCookies = mockResponse.clearCookie.mock.calls.map(c => c[0]);

      expect(clearedCookies).toContain('accessToken');
      expect(clearedCookies).toContain('token');
      expect(clearedCookies).toContain('refreshToken');
      expect(clearedCookies).toContain('adminAccessToken');
      expect(clearedCookies).toContain('adminRefreshToken');
      expect(clearedCookies).toContain('itAccessToken');
      expect(clearedCookies).toContain('itRefreshToken');
      expect(clearedCookies).toContain('bankAccessToken');
      expect(clearedCookies).toContain('bankRefreshToken');
      expect(clearedCookies).toContain('staffAccessToken');
      expect(clearedCookies).toContain('staffRefreshToken');

      // Clear cookie options must match security flags
      mockResponse.clearCookie.mock.calls.forEach(([, options]) => {
        expect(options.httpOnly).toBe(true);
        expect(options.sameSite).toBe('lax');
        expect(options.path).toBe('/');
      });
    });
  });

  describe('AUTH-25: Token Lifetimes and Server-Side Revocation', () => {
    let authService: AuthService;
    let jwtService: jest.Mocked<JwtService>;
    let usersService: any;
    let siteSettingsService: any;
    let eventEmitter: any;
    let configService: any;

    beforeEach(() => {
      jwtService = {
        sign: jest.fn((payload, options) => `signed.${options?.expiresIn || 'default'}`),
        signAsync: jest.fn().mockResolvedValue('signed-async-token'),
        verifyAsync: jest.fn(),
      } as any;

      usersService = {
        findOne: jest.fn(),
        updateRefreshToken: jest.fn().mockResolvedValue({ success: true }),
        resolveBankInfo: jest.fn().mockResolvedValue({ bankId: null, bankName: null, bankLogo: null }),
      };

      siteSettingsService = {
        checkDisposableEmail: jest.fn().mockResolvedValue({ blocked: false }),
      };

      eventEmitter = {
        emit: jest.fn(),
      };

      configService = {
        get: jest.fn((key: string) => {
          if (key === 'JWT_ACCESS_TOKEN_EXPIRATION') return '24h';
          if (key === 'JWT_REFRESH_TOKEN_EXPIRATION') return '7d';
          return null;
        }),
      };

      authService = new AuthService(
        usersService,
        null as any, // emailService
        jwtService,
        configService,
        eventEmitter,
        null as any, // firebaseAuthService
        siteSettingsService,
        null as any, // auditLogService
      );
    });

    it('AUTH-25.1: generateTokens must store refresh token in database for revocation tracking', async () => {
      const mockUser = {
        id: 'user-uuid-1',
        email: 'student@example.com',
        role: 'user',
      };

      const tokens = await authService.generateTokens(mockUser);

      expect(tokens.access_token).toBeDefined();
      expect(tokens.refresh_token).toBeDefined();

      // Verify usersService.updateRefreshToken was called with user email and the new refresh token
      expect(usersService.updateRefreshToken).toHaveBeenCalledWith(
        'student@example.com',
        tokens.refresh_token,
      );
    });

    it('AUTH-25.2: refreshTokens must verify refresh token matches database and reject revoked tokens', async () => {
      const validRefreshToken = 'valid-refresh-token';
      const revokedRefreshToken = 'revoked-stale-token';

      jwtService.verifyAsync.mockResolvedValueOnce({
        email: 'student@example.com',
        sub: 'user-uuid-1',
      });

      // User has revoked/different token stored in DB
      usersService.findOne.mockResolvedValueOnce({
        id: 'user-uuid-1',
        email: 'student@example.com',
        role: 'user',
        refreshToken: validRefreshToken, // DB has validRefreshToken
      });

      // Attempt to refresh with revokedRefreshToken
      await expect(authService.refreshTokens(revokedRefreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('AUTH-25.3: logout must revoke session by setting stored refresh token to null in database', async () => {
      const email = 'admin@vidyaloans.in';

      const result = await authService.logout(email);

      expect(result.success).toBe(true);
      expect(usersService.updateRefreshToken).toHaveBeenCalledWith(email, null);
    });

    it('AUTH-25.4: after logout revocation, refreshing with previous token must fail', async () => {
      jwtService.verifyAsync.mockResolvedValueOnce({
        email: 'student@example.com',
        sub: 'user-uuid-1',
      });

      // User in DB has null refreshToken because they logged out
      usersService.findOne.mockResolvedValueOnce({
        id: 'user-uuid-1',
        email: 'student@example.com',
        role: 'user',
        refreshToken: null,
      });

      await expect(authService.refreshTokens('stale-token-after-logout')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('Guards Cookie Extraction Support', () => {
    let jwtService: jest.Mocked<JwtService>;
    let usersService: any;
    let adminGuard: AdminGuard;
    let staffGuard: StaffGuard;
    let userGuard: UserGuard;
    let agentGuard: AgentGuard;
    let superAdminGuard: SuperAdminGuard;

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
      agentGuard = new AgentGuard(jwtService, usersService);
      superAdminGuard = new SuperAdminGuard(jwtService, usersService);
    });

    const createMockContext = (req: Partial<any>): ExecutionContext => {
      return {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {},
            query: {},
            body: {},
            cookies: {},
            ...req,
          }),
        }),
      } as unknown as ExecutionContext;
    };

    it('AdminGuard must authenticate requests using adminAccessToken cookie without Authorization header', async () => {
      jwtService.verifyAsync.mockResolvedValueOnce({
        email: 'admin@vidyaloans.com',
        role: 'admin',
        sub: 'admin-1',
      });
      usersService.findOne.mockResolvedValueOnce({
        id: 'admin-1',
        email: 'admin@vidyaloans.com',
        role: 'admin',
      });

      const ctx = createMockContext({
        cookies: { adminAccessToken: 'valid-admin-cookie-token' },
      });

      const canActivate = await adminGuard.canActivate(ctx);
      expect(canActivate).toBe(true);
      expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-admin-cookie-token');
    });

    it('AgentGuard must authenticate requests using agentAccessToken cookie without Authorization header', async () => {
      jwtService.verifyAsync.mockResolvedValueOnce({
        email: 'agent@vidyaloans.com',
        role: 'agent',
        sub: 'agent-1',
      });
      usersService.findOne.mockResolvedValueOnce({
        id: 'agent-1',
        email: 'agent@vidyaloans.com',
        role: 'agent',
      });

      const ctx = createMockContext({
        cookies: { agentAccessToken: 'valid-agent-cookie-token' },
      });

      const canActivate = await agentGuard.canActivate(ctx);
      expect(canActivate).toBe(true);
      expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-agent-cookie-token');
    });

    it('SuperAdminGuard must authenticate requests using superAdminAccessToken cookie without Authorization header', async () => {
      jwtService.verifyAsync.mockResolvedValueOnce({
        email: 'superadmin@vidyaloans.com',
        role: 'super_admin',
        sub: 'super-1',
      });
      usersService.findOne.mockResolvedValueOnce({
        id: 'super-1',
        email: 'superadmin@vidyaloans.com',
        role: 'super_admin',
      });

      const ctx = createMockContext({
        cookies: { superAdminAccessToken: 'valid-super-admin-cookie-token' },
      });

      const canActivate = await superAdminGuard.canActivate(ctx);
      expect(canActivate).toBe(true);
      expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-super-admin-cookie-token');
    });
  });
});
