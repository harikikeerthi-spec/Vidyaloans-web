import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthController } from '../auth.controller';

describe('Report C9 Audit Verification: update-details security', () => {
  let authController: AuthController;
  let authService: any;
  let usersService: any;
  let emailService: any;
  let smsService: any;
  let whatsappService: any;

  beforeEach(() => {
    authService = {};
    usersService = {
      updateUserDetails: jest.fn().mockResolvedValue({ success: true, email: 'studentA@example.com', firstName: 'Student', role: 'user' }),
      getUserDashboardData: jest.fn(),
      findById: jest.fn().mockResolvedValue({
        id: 'student-A-id',
        email: 'studentA@example.com',
        phoneNumber: '9876543210',
        dateOfBirth: '2000-01-01',
      }),
      findOne: jest.fn().mockResolvedValue({
        id: 'student-A-id',
        email: 'studentA@example.com',
        phoneNumber: '9876543210',
        dateOfBirth: '2000-01-01',
      }),
    };
    emailService = {
      sendDashboardWelcomeEmail: jest.fn().mockResolvedValue(true),
    };
    smsService = {};
    whatsappService = {};

    authController = new AuthController(
      authService,
      usersService,
      {} as any, // referralService
      {} as any, // csrfService
      emailService,
      {} as any  // assignmentService
    );
  });

  it('1. Rejects unauthenticated request without req.user with UnauthorizedException', async () => {
    const mockReq = {};
    await expect(
      authController.updateUserDetails(mockReq, {
        firstName: 'Hacker',
        userId: 'victim-id',
      })
    ).rejects.toThrow(UnauthorizedException);
  });

  it('2. Student A cannot change Student B details; ignores body.userId and body.email', async () => {
    const mockReq = {
      user: {
        id: 'student-A-id',
        email: 'studentA@example.com',
        role: 'user',
      },
    };

    const result = await authController.updateUserDetails(mockReq, {
      firstName: 'Malicious Name',
      userId: 'student-B-id',
      email: 'studentB@example.com',
    });

    expect(usersService.updateUserDetails).toHaveBeenCalled();
    const calls = usersService.updateUserDetails.mock.calls[0];

    // Arg 0 is targetEmail: must be student A's email, NOT student B
    expect(calls[0]).toBe('studenta@example.com');
    // Arg 15 is targetUserId: must be student A's id, NOT student B
    expect(calls[15]).toBe('student-A-id');
    expect(result.success).toBe(true);
  });

  it('3. Rejects attempts to directly switch email in updateUserDetails', async () => {
    const mockReq = {
      user: {
        id: 'student-A-id',
        email: 'studentA@example.com',
        role: 'user',
      },
    };

    const result = await authController.updateUserDetails(mockReq, {
      newEmail: 'attacker-new-email@example.com',
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Email address cannot be changed directly via this endpoint');
    expect(usersService.updateUserDetails).not.toHaveBeenCalled();
  });
});
