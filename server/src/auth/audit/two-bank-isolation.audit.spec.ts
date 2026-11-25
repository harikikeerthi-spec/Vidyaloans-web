jest.mock('archiver', () => () => ({
  on: jest.fn(),
  pipe: jest.fn(),
  append: jest.fn(),
  finalize: jest.fn(),
}));

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApplicationController } from '../../application/application.controller';

describe('CG-04 & S-03: Two-Bank Tenant Isolation Acceptance Tests', () => {
  let applicationController: ApplicationController;
  let applicationService: any;
  let s3Service: any;
  let notificationService: any;
  let jwtService: any;
  let bankService: any;

  beforeEach(() => {
    applicationService = {
      getAllApplications: jest.fn().mockImplementation((filters) => {
        return Promise.resolve({
          success: true,
          data: [],
          total: 0,
          appliedFilters: filters,
        });
      }),
      getApplicationById: jest.fn(),
      verifyApplicationBelongsToBank: jest.fn(),
      getApplicationStats: jest.fn(),
      getApplicationDocuments: jest.fn(),
      startApplicationReview: jest.fn(),
    };

    s3Service = {};
    notificationService = {};
    jwtService = {};
    bankService = {};

    applicationController = new ApplicationController(
      applicationService,
      s3Service,
      notificationService,
      jwtService,
      bankService,
    );
  });

  const createMockRequest = (user: any, query: any = {}) => {
    return {
      user,
      query,
      headers: {},
    };
  };

  describe('GET /applications/admin/all Multi-Tenant Query Parameter Injection Protection', () => {
    it('1. Auxilo Bank Officer requesting ?bank=avanse MUST have parameter ignored and scoped to Auxilo', async () => {
      const auxiloUser = {
        id: 'usr-auxilo-01',
        email: 'officer@auxilo.com',
        role: 'bank',
        bankId: 'auxilo',
        bankName: 'Auxilo Finserve',
      };

      const req = createMockRequest(auxiloUser, { bank: 'avanse' });

      // The officer maliciously or mistakenly requests ?bank=avanse
      await applicationController.getAllApplications(
        undefined, // status
        undefined, // stage
        undefined, // loanType
        'avanse',  // bank query param from client
        undefined, // search
        undefined, // fromDate
        undefined, // toDate
        undefined, // limit
        undefined, // offset
        undefined, // sortBy
        undefined, // sortOrder
        undefined, // userId
        undefined, // excludeStatus
        undefined, // includeUnassigned
        undefined, // assignedStaffIdQuery
        req,
      );

      // Verify that applicationService received Auxilo and NOT avanse
      expect(applicationService.getAllApplications).toHaveBeenCalledWith(
        expect.objectContaining({
          bank: 'Auxilo',
        }),
      );
      expect(applicationService.getAllApplications).not.toHaveBeenCalledWith(
        expect.objectContaining({
          bank: 'Avanse',
        }),
      );
    });

    it('2. Avanse Bank Officer requesting ?bank=auxilo MUST have parameter ignored and scoped to Avanse', async () => {
      const avanseUser = {
        id: 'usr-avanse-01',
        email: 'officer@avanse.com',
        role: 'bank',
        bankId: 'avanse',
        bankName: 'Avanse Financial',
      };

      const req = createMockRequest(avanseUser, { bank: 'auxilo' });

      // The officer maliciously requests ?bank=auxilo
      await applicationController.getAllApplications(
        undefined,
        undefined,
        undefined,
        'auxilo',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        req,
      );

      // Verify that applicationService received Avanse and NOT auxilo
      expect(applicationService.getAllApplications).toHaveBeenCalledWith(
        expect.objectContaining({
          bank: 'Avanse',
        }),
      );
      expect(applicationService.getAllApplications).not.toHaveBeenCalledWith(
        expect.objectContaining({
          bank: 'Auxilo',
        }),
      );
    });

    it('3. Bank Officer calling endpoint without ?bank= parameter MUST NOT see all banks, but strictly their own', async () => {
      const avanseUser = {
        id: 'usr-avanse-01',
        email: 'officer@avanse.com',
        role: 'bank',
        bankId: 'avanse',
        bankName: 'Avanse Financial',
      };

      const req = createMockRequest(avanseUser, {});

      await applicationController.getAllApplications(
        undefined,
        undefined,
        undefined,
        undefined, // No bank param sent
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        req,
      );

      // Must be scoped to Avanse, NOT undefined (which would return all banks)
      expect(applicationService.getAllApplications).toHaveBeenCalledWith(
        expect.objectContaining({
          bank: 'Avanse',
        }),
      );
    });

    it('4. Bank Officer without assigned bank institution MUST receive 403 Forbidden', async () => {
      const unassignedBankUser = {
        id: 'usr-unknown-01',
        email: 'unassigned@gmail.com',
        role: 'bank',
        bankId: null,
        bankName: null,
      };

      const req = createMockRequest(unassignedBankUser, { bank: 'avanse' });

      await expect(
        applicationController.getAllApplications(
          undefined,
          undefined,
          undefined,
          'avanse',
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          req,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('5. Admin user CAN filter by specific bank (?bank=avanse)', async () => {
      const adminUser = {
        id: 'adm-01',
        email: 'superadmin@vidyaloans.com',
        role: 'admin',
      };

      const req = createMockRequest(adminUser, { bank: 'avanse' });

      await applicationController.getAllApplications(
        undefined,
        undefined,
        undefined,
        'avanse',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        req,
      );

      expect(applicationService.getAllApplications).toHaveBeenCalledWith(
        expect.objectContaining({
          bank: 'Avanse',
        }),
      );
    });

    it('6. Admin user without bank parameter sees all applications across all lenders', async () => {
      const adminUser = {
        id: 'adm-01',
        email: 'superadmin@vidyaloans.com',
        role: 'super_admin',
      };

      const req = createMockRequest(adminUser, {});

      await applicationController.getAllApplications(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        req,
      );

      expect(applicationService.getAllApplications).toHaveBeenCalledWith(
        expect.objectContaining({
          bank: undefined,
        }),
      );
    });
  });

  describe('GET /applications/:id Direct Access Multi-Tenant Isolation', () => {
    it('7. Auxilo Bank Officer accessing an application belonging to Avanse MUST receive 403 Forbidden', async () => {
      const auxiloUser = {
        id: 'usr-auxilo-01',
        email: 'officer@auxilo.com',
        role: 'bank',
        bankId: 'auxilo',
        bankName: 'Auxilo Finserve',
      };

      const req = createMockRequest(auxiloUser);

      // Application belongs to Avanse
      applicationService.getApplicationById.mockResolvedValueOnce({
        id: 'VL-APP-2026-00001',
        bank: 'Avanse',
        bankName: 'Avanse Financial',
        userId: 'student-01',
      });

      // Verification fails because Auxilo != Avanse
      applicationService.verifyApplicationBelongsToBank.mockResolvedValueOnce(false);

      await expect(
        applicationController.getApplicationById(req, 'VL-APP-2026-00001'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('8. Auxilo Bank Officer accessing their own application MUST be granted access (200 OK)', async () => {
      const auxiloUser = {
        id: 'usr-auxilo-01',
        email: 'officer@auxilo.com',
        role: 'bank',
        bankId: 'auxilo',
        bankName: 'Auxilo Finserve',
      };

      const req = createMockRequest(auxiloUser);

      applicationService.getApplicationById.mockResolvedValueOnce({
        id: 'VL-APP-2026-00002',
        bank: 'Auxilo',
        bankName: 'Auxilo Finserve',
        userId: 'student-02',
      });

      applicationService.verifyApplicationBelongsToBank.mockResolvedValueOnce(true);

      const result = await applicationController.getApplicationById(req, 'VL-APP-2026-00002');
      expect(result.success).toBe(true);
      expect(result.data.id).toBe('VL-APP-2026-00002');
    });
  });
});
