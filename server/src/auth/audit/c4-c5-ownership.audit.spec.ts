import { ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OwnershipOrStaffGuard } from '../ownership.guard';

describe('Report C4 & C5: IDOR & Sequential Student ID Protection Audit Tests', () => {
  let jwtService: jest.Mocked<JwtService>;
  let usersService: any;
  let supabaseService: any;
  let ownershipGuard: OwnershipOrStaffGuard;

  beforeEach(() => {
    jwtService = {
      verifyAsync: jest.fn(),
    } as any;

    usersService = {
      findById: jest.fn(),
      findOne: jest.fn(),
    };

    supabaseService = {
      client: {
        from: jest.fn(),
      },
    };

    ownershipGuard = new OwnershipOrStaffGuard(
      jwtService,
      usersService,
      supabaseService,
    );
  });

  const createMockContext = (req: Partial<any>): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {},
          query: {},
          params: {},
          body: {},
          url: '/api/documents/VL-STU-2026-00001',
          path: '/api/documents/VL-STU-2026-00001',
          ...req,
        }),
      }),
    } as unknown as ExecutionContext;
  };

  it('1. Logged-out user with no credentials must receive 401 Unauthorized', async () => {
    const ctx = createMockContext({
      params: { userId: 'VL-STU-2026-00001' },
    });
    await expect(ownershipGuard.canActivate(ctx)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('2. Arbitrary query string ?token= on non-download routes must be rejected', async () => {
    const ctx = createMockContext({
      path: '/api/auth/dashboard-data',
      url: '/api/auth/dashboard-data?token=some.jwt.token',
      query: { token: 'some.jwt.token' },
      body: { userId: 'VL-STU-2026-00001' },
    });
    // On non-download routes, query.token is ignored, resulting in 401
    await expect(ownershipGuard.canActivate(ctx)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('3. Student A (VL-STU-2026-00001) attempting to access sequential Student B (VL-STU-2026-00002) must receive 403 Forbidden', async () => {
    jwtService.verifyAsync.mockResolvedValueOnce({
      sub: 'VL-STU-2026-00001',
      id: 'VL-STU-2026-00001',
      email: 'studentA@example.com',
      role: 'user',
    });

    const ctx = createMockContext({
      headers: { authorization: 'Bearer token-student-a' },
      params: { userId: 'VL-STU-2026-00002' },
    });

    await expect(ownershipGuard.canActivate(ctx)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('4. Student A accessing their own resources (by user ID) must be granted access (200)', async () => {
    jwtService.verifyAsync.mockResolvedValueOnce({
      sub: 'VL-STU-2026-00001',
      id: 'VL-STU-2026-00001',
      email: 'studentA@example.com',
      role: 'user',
    });

    const ctx = createMockContext({
      headers: { authorization: 'Bearer token-student-a' },
      params: { userId: 'VL-STU-2026-00001' },
    });

    const result = await ownershipGuard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('5. Student A accessing their own resources (by email) must be granted access (200)', async () => {
    jwtService.verifyAsync.mockResolvedValueOnce({
      sub: 'VL-STU-2026-00001',
      id: 'VL-STU-2026-00001',
      email: 'studentA@example.com',
      role: 'user',
    });

    const ctx = createMockContext({
      headers: { authorization: 'Bearer token-student-a' },
      body: { email: 'studentA@example.com' },
    });

    const result = await ownershipGuard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('6. Bank partner without student consent must receive 403 Forbidden', async () => {
    jwtService.verifyAsync.mockResolvedValueOnce({
      sub: 'bank-rep-01',
      id: 'bank-rep-01',
      bankId: 'bank-hdfc',
      role: 'bank',
    });

    supabaseService.client.from.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: jest.fn().mockResolvedValue({ data: null }),
          }),
        }),
      }),
    });

    const ctx = createMockContext({
      headers: { authorization: 'Bearer token-bank' },
      params: { userId: 'VL-STU-2026-00001' },
    });

    await expect(ownershipGuard.canActivate(ctx)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('7. Bank partner with valid student consent must be granted access', async () => {
    jwtService.verifyAsync.mockResolvedValueOnce({
      sub: 'bank-rep-01',
      id: 'bank-rep-01',
      bankId: 'bank-hdfc',
      role: 'bank',
    });

    supabaseService.client.from.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: jest.fn().mockResolvedValue({ data: { isGranted: true } }),
          }),
        }),
      }),
    });

    const ctx = createMockContext({
      headers: { authorization: 'Bearer token-bank' },
      params: { userId: 'VL-STU-2026-00001' },
    });

    const result = await ownershipGuard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('8. Staff or Administrator role accessing any student must be granted access', async () => {
    jwtService.verifyAsync.mockResolvedValueOnce({
      sub: 'staff-007',
      id: 'staff-007',
      email: 'officer@vidyaloans.com',
      role: 'staff',
    });

    const ctx = createMockContext({
      headers: { authorization: 'Bearer token-staff' },
      params: { userId: 'VL-STU-2026-00099' },
    });

    const result = await ownershipGuard.canActivate(ctx);
    expect(result).toBe(true);
  });
});
