jest.mock('sanitize-html', () => (html: string) => html);

import { ForbiddenException } from '@nestjs/common';
import { BlogController } from '../../blog/blog.controller';

describe('AUTH-24: Blog Draft & Approval Workflow Enforcement Tests', () => {
  let controller: BlogController;
  let blogService: any;
  let authService: any;
  let auditLog: any;

  beforeEach(() => {
    blogService = {
      createBlog: jest.fn().mockImplementation((d) => Promise.resolve({ success: true, data: d })),
      updateBlog: jest.fn().mockImplementation((id, d) => Promise.resolve({ success: true, data: { id, ...d } })),
      deleteBlog: jest.fn().mockResolvedValue({ success: true }),
      bulkDeleteBlogs: jest.fn().mockResolvedValue({ success: true }),
      bulkUpdateStatus: jest.fn().mockResolvedValue({ success: true }),
      getAdminBlogDetail: jest.fn(),
      publishBlog: jest.fn().mockResolvedValue({ id: 'b-1', status: 'published', isPublished: true }),
      unpublishBlog: jest.fn().mockResolvedValue({ id: 'b-1', status: 'draft', isPublished: false }),
      approveBlog: jest.fn().mockResolvedValue({ id: 'b-1', status: 'published', isPublished: true }),
      rejectBlog: jest.fn().mockResolvedValue({ id: 'b-1', status: 'draft', isPublished: false }),
    };

    authService = {
      canEditBlog: jest.fn().mockResolvedValue(true),
      canDeleteBlog: jest.fn().mockResolvedValue(true),
    };

    auditLog = {
      logAction: jest.fn().mockResolvedValue(true),
    };

    controller = new BlogController(blogService, authService, auditLog);
  });

  const itReq = { user: { id: 'it-1', email: 'it@vidyaloans.com', role: 'it' } };
  const adminReq = { user: { id: 'adm-1', email: 'admin@vidyaloans.com', role: 'admin' } };

  it('AUTH-24.1: IT user creating a blog with isPublished=true is forced to pending/draft (cannot publish directly)', async () => {
    await controller.createBlog(
      {
        title: 'New Post',
        slug: 'new-post',
        excerpt: 'Summary',
        content: 'Body',
        category: 'Loans',
        authorName: 'IT User',
        isPublished: true,
      },
      itReq,
    );

    expect(blogService.createBlog).toHaveBeenCalledWith(
      expect.objectContaining({
        isPublished: false,
        published: false,
        visibility: 'private',
        status: 'pending',
      }),
    );
  });

  it('AUTH-24.2: IT user cannot edit a live published post', async () => {
    blogService.getAdminBlogDetail.mockResolvedValue({
      id: 'b-live',
      authorId: 'it-1',
      status: 'published',
      isPublished: true,
    });

    await expect(
      controller.updateBlog(itReq, 'b-live', { title: 'Tampered' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('AUTH-24.3: IT user cannot delete a live published post', async () => {
    blogService.getAdminBlogDetail.mockResolvedValue({
      id: 'b-live',
      authorId: 'it-1',
      status: 'published',
      isPublished: true,
    });

    await expect(controller.deleteBlog(itReq, 'b-live')).rejects.toThrow(ForbiddenException);
  });

  it('AUTH-24.4: IT user can edit and delete their own unpublished draft', async () => {
    blogService.getAdminBlogDetail.mockResolvedValue({
      id: 'b-draft',
      authorId: 'it-1',
      status: 'draft',
      isPublished: false,
    });

    await controller.updateBlog(itReq, 'b-draft', { title: 'Updated Draft' });
    expect(blogService.updateBlog).toHaveBeenCalledWith(
      'b-draft',
      expect.objectContaining({ title: 'Updated Draft', isPublished: false }),
    );

    await controller.deleteBlog(itReq, 'b-draft');
    expect(blogService.deleteBlog).toHaveBeenCalledWith('b-draft');
  });

  it('AUTH-24.5: IT user cannot approve, reject, publish, unpublish, bulk-delete, or bulk-status', async () => {
    await expect(controller.approveBlog(itReq, 'b-1', {})).rejects.toThrow(ForbiddenException);
    await expect(controller.rejectBlog(itReq, 'b-1', { reason: 'no' })).rejects.toThrow(ForbiddenException);
    await expect(controller.publishBlog(itReq, 'b-1', {})).rejects.toThrow(ForbiddenException);
    await expect(controller.unpublishBlog(itReq, 'b-1', {})).rejects.toThrow(ForbiddenException);
    await expect(controller.bulkDeleteBlogs(itReq, { blogIds: ['b-1'] })).rejects.toThrow(ForbiddenException);
    await expect(controller.bulkUpdateStatus(itReq, { blogIds: ['b-1'], isPublished: false })).rejects.toThrow(ForbiddenException);
  });

  it('AUTH-24.6: Admin user CAN approve and publish posts', async () => {
    await controller.approveBlog(adminReq, 'b-1', { notes: 'LGTM' });
    expect(blogService.approveBlog).toHaveBeenCalledWith('b-1', 'adm-1', 'LGTM');

    await controller.publishBlog(adminReq, 'b-1', { visibility: 'public' });
    expect(blogService.publishBlog).toHaveBeenCalledWith('b-1', 'public');
  });
});
