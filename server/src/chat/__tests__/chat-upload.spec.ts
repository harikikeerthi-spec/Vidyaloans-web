import { Test, TestingModule } from '@nestjs/testing';
import { ChatController } from '../chat.controller';
import { ChatService } from '../chat.service';
import { S3Service } from '../../document/s3.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { KycService } from '../../ai/services/kyc.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

import { UserGuard } from '../../auth/user.guard';

describe('ChatController Upload Security (Report C8)', () => {
  let controller: ChatController;
  let chatService: Partial<ChatService>;
  let s3Service: Partial<S3Service>;
  let eventEmitter: Partial<EventEmitter2>;
  let kycService: Partial<KycService>;

  const validConversationId = '123e4567-e89b-12d3-a456-426614174000';
  const testUploadDir = path.join(process.cwd(), 'uploads', 'chat', validConversationId);

  beforeEach(async () => {
    chatService = {
      getConversationById: jest.fn().mockImplementation(async (id: string) => {
        if (id === validConversationId) {
          return {
            id: validConversationId,
            customerEmail: 'student@example.com',
            customerPhone: '9876543210',
            metadata: { type: 'staff' },
          };
        }
        return null;
      }),
      normalizePhone: jest.fn((p: string) => p?.replace(/\D/g, '') || ''),
      saveMessage: jest.fn().mockImplementation(async (data: any) => ({
        id: 'msg-123',
        ...data,
      })),
    };

    s3Service = {
      upload: jest.fn().mockRejectedValue(new Error('S3 simulated failure for fallback to disk')),
    };

    eventEmitter = {
      emit: jest.fn(),
    };

    kycService = {
      processDocument: jest.fn().mockResolvedValue({ is_valid: false }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        { provide: ChatService, useValue: chatService },
        { provide: S3Service, useValue: s3Service },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: KycService, useValue: kycService },
      ],
    })
      .overrideGuard(UserGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ChatController>(ChatController);
  });

  afterEach(() => {
    if (fs.existsSync(testUploadDir)) {
      fs.rmSync(testUploadDir, { recursive: true, force: true });
    }
  });

  it('rejects conversationId that is not a valid UUID (e.g. path traversal attempt)', async () => {
    const maliciousFile = {
      originalname: 'test.txt',
      buffer: Buffer.from('hello world'),
      mimetype: 'text/plain',
    } as Express.Multer.File;

    const req = { user: { role: 'admin', email: 'admin@example.com' } };

    await expect(
      controller.uploadFile(req, maliciousFile, '../../malicious_id')
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects upload if the user does not belong to the conversation', async () => {
    const file = {
      originalname: 'test.txt',
      buffer: Buffer.from('hello world'),
      mimetype: 'text/plain',
    } as Express.Multer.File;

    const unauthorizedUser = {
      role: 'customer',
      email: 'attacker@example.com',
      phoneNumber: '1111111111',
      id: 'other-user',
    };

    await expect(
      controller.uploadFile({ user: unauthorizedUser }, file, validConversationId)
    ).rejects.toThrow(ForbiddenException);
  });

  it('saves file with random UUID and safe extension inside uploads/chat/<id>/ even if originalname is "../../test.txt"', async () => {
    const traversalFile = {
      originalname: '../../test.txt',
      buffer: Buffer.from('path traversal test content'),
      mimetype: 'text/plain',
    } as Express.Multer.File;

    const authorizedUser = {
      role: 'customer',
      email: 'student@example.com',
      phoneNumber: '9876543210',
      id: 'student-1',
    };

    const result = await controller.uploadFile(
      { user: authorizedUser },
      traversalFile,
      validConversationId
    );

    expect(result.success).toBe(true);

    // 1. Check database message retains original name
    expect(result.message.content).toContain('../../test.txt');

    // 2. Check attachmentUrl uses local:<conversationId>/<uuid>.txt
    const attachmentUrl = result.message.attachmentUrl;
    expect(attachmentUrl).toMatch(new RegExp(`^local:${validConversationId}/[0-9a-f-]+\\.txt$`));

    // 3. Check the file exists on disk inside uploads/chat/<id>/
    const savedFileName = attachmentUrl.split('/')[1];
    const fullSavedPath = path.join(testUploadDir, savedFileName);
    expect(fs.existsSync(fullSavedPath)).toBe(true);
    expect(fs.readFileSync(fullSavedPath, 'utf8')).toBe('path traversal test content');

    // 4. Verify no file escaped outside uploads/chat/<conversationId>
    const escapedFile = path.join(process.cwd(), 'uploads', 'test.txt');
    expect(fs.existsSync(escapedFile)).toBe(false);
  });
});
