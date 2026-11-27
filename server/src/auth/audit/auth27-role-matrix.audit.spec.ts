jest.mock('archiver', () => () => ({
  on: jest.fn(),
  pipe: jest.fn(),
  append: jest.fn(),
  finalize: jest.fn(),
}));

import { ForbiddenException } from '@nestjs/common';
import { ApplicationController } from '../../application/application.controller';
import { ApplicationService } from '../../application/application.service';
import { AdminApplicationController } from '../../application/admin-application.controller';
import { AssignmentController } from '../../assignment/assignment.controller';

describe('AUTH-27: Role-Matrix & Assignment Scoping Acceptance Tests', () => {
  describe('ApplicationController Role & Assignment Enforcement', () => {
    let applicationController: ApplicationController;
    let applicationService: any;

    beforeEach(() => {
      applicationService = {
        getAllApplications: jest.fn().mockResolvedValue({ success: true, data: [], total: 0 }),
        getApplicationStats: jest.fn().mockResolvedValue({ success: true, data: { total: 0 } }),
        verifyStaffOrBankApplicationAccess: jest.fn(),
        verifyDocumentAccess: jest.fn(),
        verifyApplicationBelongsToBank: jest.fn(),
        getApplicationDocuments: jest.fn().mockResolvedValue({ success: true, data: [] }),
        updateApplicationStatus: jest.fn().mockResolvedValue({ success: true }),
        getApplicationNotes: jest.fn().mockResolvedValue({ success: true, data: [] }),
        addApplicationNote: jest.fn().mockResolvedValue({ success: true }),
        getApplicationById: jest.fn(),
        startApplicationReview: jest.fn(),
        getSingleDocument: jest.fn().mockResolvedValue({ id: 'doc-1', filePath: 'https://example.com/doc.pdf' }),
      };

      applicationController = new ApplicationController(
        applicationService,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );
    });

    it('AUTH-27.1: Staff calling GET /applications/admin/all is forced to own assignedStaffId and ignores ?assignedStaffId & ?includeUnassigned', async () => {
      const staffUser = { id: 'staff-1', email: 'staff1@vidyaloans.com', role: 'staff' };
      const req = { user: staffUser };

      await applicationController.getAllApplications(
        undefined, undefined, undefined, undefined, undefined, undefined, undefined,
        '1000', '0', undefined, undefined, undefined, undefined,
        'true',          // client tries ?includeUnassigned=true
        'other-staff-2', // client tries ?assignedStaffId=other-staff-2
        req,
      );

      expect(applicationService.getAllApplications).toHaveBeenCalledWith(
        expect.objectContaining({
          assignedStaffId: 'staff-1',
          staffEmail: 'staff1@vidyaloans.com',
          includeUnassigned: false,
        }),
      );
    });

    it('AUTH-27.2: Admin calling GET /applications/admin/all can filter by assignedStaffId and includeUnassigned', async () => {
      const adminUser = { id: 'admin-1', email: 'admin@vidyaloans.com', role: 'admin' };
      const req = { user: adminUser };

      await applicationController.getAllApplications(
        undefined, undefined, undefined, undefined, undefined, undefined, undefined,
        '1000', '0', undefined, undefined, undefined, undefined,
        'true',
        'staff-2',
        req,
      );

      expect(applicationService.getAllApplications).toHaveBeenCalledWith(
        expect.objectContaining({
          assignedStaffId: 'staff-2',
          includeUnassigned: true,
        }),
      );
    });

    it.each(['agent', 'partner_agent', 'analyst', 'marketing', 'it', 'user'])(
      'AUTH-27.3: Role "%s" calling GET /applications/admin/all MUST receive 403 Forbidden',
      async (role) => {
        const req = { user: { id: 'u-1', email: `${role}@vidyaloans.com`, role } };

        await expect(
          applicationController.getAllApplications(
            undefined, undefined, undefined, undefined, undefined, undefined, undefined,
            undefined, undefined, undefined, undefined, undefined, undefined,
            undefined, undefined, req,
          ),
        ).rejects.toThrow(ForbiddenException);
      },
    );

    it('AUTH-27.4: Staff accessing another staff member application via admin/:id/* MUST receive 403 Forbidden', async () => {
      const staffUser = { id: 'staff-1', email: 'staff1@vidyaloans.com', role: 'staff' };
      const req = { user: staffUser };

      applicationService.verifyStaffOrBankApplicationAccess.mockRejectedValue(
        new ForbiddenException('Access denied: This application is not assigned to you'),
      );

      await expect(
        applicationController.getDocumentsAdmin(req, 'app-other'),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        applicationController.updateApplicationStatus(req, 'app-other', { status: 'approved' }),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        applicationController.getApplicationNotes(req, 'app-other'),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        applicationController.addApplicationNote(req, 'app-other', { content: 'test' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('AUTH-27.5: Staff accessing GET /applications/:id for unassigned case MUST receive 403 Forbidden', async () => {
      const staffUser = { id: 'staff-1', email: 'staff1@vidyaloans.com', role: 'staff' };
      const req = { user: staffUser };

      applicationService.getApplicationById.mockResolvedValue({
        id: 'app-other',
        userId: 'student-1',
        assignedStaffId: 'staff-2',
        status: 'submitted',
      });
      applicationService.verifyStaffOrBankApplicationAccess.mockRejectedValue(
        new ForbiddenException('Access denied: This application is not assigned to you'),
      );

      await expect(
        applicationController.getApplicationById(req, 'app-other'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('ApplicationService.verifyStaffOrBankApplicationAccess & getApplicationStats', () => {
    let service: ApplicationService;
    let mockDb: any;

    beforeEach(() => {
      const makeChain = (data: any = []) => {
        const chain: any = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          neq: jest.fn().mockReturnThis(),
          not: jest.fn().mockReturnThis(),
          ilike: jest.fn().mockReturnThis(),
          or: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null }),
          single: jest.fn().mockResolvedValue({ data: null }),
          then: (resolve: any) => resolve({ data, error: null }),
        };
        return chain;
      };

      mockDb = {
        from: jest.fn(() => makeChain([])),
      };

      service = new ApplicationService(
        { getClient: () => mockDb } as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        { logAction: jest.fn() } as any,
      );
    });

    it('AUTH-27.6: verifyStaffOrBankApplicationAccess rejects staff not assigned to application', async () => {
      jest.spyOn(service, 'getApplicationById').mockResolvedValue({
        id: 'app-1',
        assignedStaffId: 'staff-2',
        bank: 'Avanse',
      });
      jest.spyOn(service, 'resolveStaffCandidateIds').mockResolvedValue(['staff-1', 'staff1@vidyaloans.com']);

      await expect(
        service.verifyStaffOrBankApplicationAccess('app-1', { id: 'staff-1', email: 'staff1@vidyaloans.com', role: 'staff' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('AUTH-27.7: verifyStaffOrBankApplicationAccess allows staff assigned to application', async () => {
      const app = { id: 'app-1', assignedStaffId: 'staff-1', bank: 'Avanse' };
      jest.spyOn(service, 'getApplicationById').mockResolvedValue(app);
      jest.spyOn(service, 'resolveStaffCandidateIds').mockResolvedValue(['staff-1', 'staff1@vidyaloans.com']);

      const result = await service.verifyStaffOrBankApplicationAccess('app-1', {
        id: 'staff-1',
        email: 'staff1@vidyaloans.com',
        role: 'staff',
      });
      expect(result).toEqual(app);
    });

    it('AUTH-27.8: getApplicationStats rejects non-case-management roles and unassigned bank accounts', async () => {
      await expect(
        service.getApplicationStats({ id: 'agent-1', role: 'agent' }),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.getApplicationStats({ id: 'it-1', role: 'it' }),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.getApplicationStats({ id: 'bank-1', email: 'unknown@gmail.com', role: 'bank' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('AdminApplicationController & AssignmentController Role Matrix', () => {
    it('AUTH-27.9: Non-admin roles (staff, bank, agent) are rejected from AdminApplicationController bulk/reassignment endpoints', async () => {
      const controller = new AdminApplicationController({} as any, {} as any);

      for (const role of ['staff', 'bank', 'agent', 'analyst', 'it']) {
        const req = { user: { id: 'u-1', role } };
        await expect(controller.assignAllUnassigned(req)).rejects.toThrow(ForbiddenException);
        await expect(controller.bulkReassignLoans({ loanIds: ['1'], toStaffId: 's2' }, req)).rejects.toThrow(ForbiddenException);
        await expect(controller.batchProcessApplications({ applicationIds: ['1'], action: 'approve', remarks: '' }, req)).rejects.toThrow(ForbiddenException);
      }
    });

    it('AUTH-27.10: AssignmentController enforces role matrix and ignores staffIdQuery/includeUnassigned for staff', async () => {
      const assignmentService = {
        getMyApplications: jest.fn().mockResolvedValue([]),
        assignAllUnassigned: jest.fn().mockResolvedValue({ assigned: 0, skipped: 0, failed: 0 }),
        getUnassignedQueue: jest.fn().mockResolvedValue([]),
      };
      const controller = new AssignmentController(assignmentService as any);

      // Bank / agent cannot call my-applications
      await expect(controller.getMyApplications({ user: { id: 'b1', role: 'bank' } })).rejects.toThrow(ForbiddenException);
      await expect(controller.getMyApplications({ user: { id: 'a1', role: 'agent' } })).rejects.toThrow(ForbiddenException);

      // Staff cannot query another staff's applications or unassigned queue
      await controller.getMyApplications(
        { user: { id: 'staff-1', role: 'staff' } },
        'other-staff-2',
        undefined,
        'true',
      );
      expect(assignmentService.getMyApplications).toHaveBeenCalledWith('staff-1', undefined, false);

      // Staff cannot call admin-only unassigned queue or bulk assignment
      await expect(controller.getUnassignedQueue({ user: { id: 'staff-1', role: 'staff' } })).rejects.toThrow(ForbiddenException);
      await expect(controller.assignAllUnassigned({ user: { id: 'staff-1', role: 'staff' } })).rejects.toThrow(ForbiddenException);
    });
  });
});
