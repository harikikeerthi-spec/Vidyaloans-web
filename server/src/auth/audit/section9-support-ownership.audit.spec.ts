import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SupportService } from '../../support/support.service';

describe('Report Section 9: Support Tickets IDOR & Ownership Audit Tests', () => {
  let supportService: SupportService;
  let mockSupabaseService: any;
  let mockS3Service: any;

  const studentA = {
    id: 'VL-STU-2026-00028',
    email: 'studentA@example.com',
    role: 'user',
  };

  const studentB = {
    id: 'VL-STU-2026-00029',
    email: 'studentB@example.com',
    role: 'user',
  };

  const staffUser = {
    id: 'VL-STF-2026-00001',
    email: 'staff@vidyaloans.in',
    role: 'staff',
  };

  const ticketA = {
    id: 'ticket-uuid-student-a',
    ticketNumber: 'TKT-00001',
    subject: 'Loan Status Inquiry',
    description: 'When will my loan be disbursed?',
    category: 'Loan Application',
    priority: 'medium',
    status: 'open',
    createdById: 'VL-STU-2026-00028',
    createdByName: 'Student A',
    createdByEmail: 'studentA@example.com',
    studentId: 'VL-STU-2026-00028',
  };

  let mockDb: any;

  beforeEach(() => {
    mockS3Service = {
      buildKey: jest.fn(),
      upload: jest.fn(),
      getPresignedUrl: jest.fn(),
    };

    mockDb = {
      from: jest.fn(),
    };

    mockSupabaseService = {
      getClient: jest.fn().mockReturnValue(mockDb),
      client: mockDb,
    };

    supportService = new SupportService(mockSupabaseService, mockS3Service);
  });

  describe('1. GET /api/support/tickets (List Tickets)', () => {
    it('forces caller user.id and ignores query createdById for student role', async () => {
      const mockQueryChain = {
        select: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: [ticketA],
          count: 1,
          error: null,
        }),
      };

      mockDb.from.mockImplementation((table: string) => {
        if (table === 'SupportTicket') return mockQueryChain;
        if (table === 'SupportComment') return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ count: 0 }) };
        if (table === 'SupportAttachment') return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: [] }) };
        return mockQueryChain;
      });

      // Student B attempts to pass student A's ID in query
      const result = await supportService.getTickets(
        { createdById: 'VL-STU-2026-00028' },
        studentB
      );

      // Must filter strictly by studentB's ID from token, ignoring query param
      expect(mockQueryChain.eq).toHaveBeenCalledWith('createdById', 'VL-STU-2026-00029');
      expect(mockQueryChain.eq).not.toHaveBeenCalledWith('createdById', 'VL-STU-2026-00028');
      expect(result.data).toBeDefined();
    });

    it('allows staff or admin to filter by createdById query parameter', async () => {
      const mockQueryChain = {
        select: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: [ticketA],
          count: 1,
          error: null,
        }),
      };

      mockDb.from.mockImplementation((table: string) => {
        if (table === 'SupportTicket') return mockQueryChain;
        if (table === 'SupportComment') return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ count: 0 }) };
        if (table === 'SupportAttachment') return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: [] }) };
        return mockQueryChain;
      });

      await supportService.getTickets(
        { createdById: 'VL-STU-2026-00028' },
        staffUser
      );

      // Staff can filter by any student's createdById
      expect(mockQueryChain.eq).toHaveBeenCalledWith('createdById', 'VL-STU-2026-00028');
    });
  });

  describe('2. GET /api/support/tickets/:id (Single Ticket)', () => {
    it('returns 403 Forbidden when Student B tries to read Student A ticket', async () => {
      mockDb.from.mockImplementation((table: string) => {
        if (table === 'SupportTicket') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: ticketA, error: null }),
          };
        }
        return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis() };
      });

      await expect(
        supportService.getTicket('ticket-uuid-student-a', studentB)
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows Student A to read their own ticket (200)', async () => {
      mockDb.from.mockImplementation((table: string) => {
        if (table === 'SupportTicket') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: ticketA, error: null }),
          };
        }
        const chain: any = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          then: (resolve: any) => resolve({ data: [] }),
        };
        return chain;
      });

      const res = await supportService.getTicket('ticket-uuid-student-a', studentA);
      expect(res.id).toBe('ticket-uuid-student-a');
      expect(res.createdById).toBe('VL-STU-2026-00028');
    });

    it('allows Staff to read any student ticket', async () => {
      mockDb.from.mockImplementation((table: string) => {
        if (table === 'SupportTicket') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: ticketA, error: null }),
          };
        }
        const chain: any = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          then: (resolve: any) => resolve({ data: [] }),
        };
        return chain;
      });

      const res = await supportService.getTicket('ticket-uuid-student-a', staffUser);
      expect(res.id).toBe('ticket-uuid-student-a');
    });
  });

  describe('3. POST /api/support/tickets/:id/comment (Add Comment)', () => {
    it('returns 403 Forbidden when Student B tries to comment on Student A ticket', async () => {
      mockDb.from.mockImplementation((table: string) => {
        if (table === 'SupportTicket') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: ticketA, error: null }),
          };
        }
        return { select: jest.fn().mockReturnThis() };
      });

      await expect(
        supportService.addComment('ticket-uuid-student-a', { content: 'Malicious comment' } as any, studentB)
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
