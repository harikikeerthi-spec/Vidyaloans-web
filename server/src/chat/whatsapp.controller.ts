import { Controller, Post, Res, Req, Body, Logger, Get, Param, Query } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';

/**
 * WhatsApp Webhook Controller (AWS End User Messaging Social / Meta WhatsApp Cloud API)
 * 
 * Supports:
 * 1. Webhook verification challenge (GET hub.mode=subscribe, hub.challenge, hub.verify_token)
 * 2. AWS End User Messaging Social / Meta Cloud API incoming message webhooks
 * 3. AWS SNS notifications / Subscription confirmations
 * 4. Backward-compatible direct JSON payloads for simulation and testing
 */
@Controller(['webhook/whatsapp', 'whatsapp', 'webhook/sns', 'sns/whatsapp'])
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
    private readonly configService: ConfigService
  ) {}

  /**
   * GET /api/webhook/whatsapp or GET /api/webhook/sns
   * Handles Meta / AWS WhatsApp webhook challenge verification and healthcheck
   */
  @Get()
  @Get('sns')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response
  ) {
    const configuredToken =
      this.configService.get<string>('AWS_WHATSAPP_VERIFY_TOKEN') ||
      this.configService.get<string>('WHATSAPP_VERIFY_TOKEN') ||
      'vidyaloan_webhook_verify_token';

    // Meta / AWS WhatsApp webhook subscription challenge
    if (mode === 'subscribe') {
      if (token === configuredToken) {
        this.logger.log(`[AWS WhatsApp Webhook] Verification successful. Responding with challenge.`);
        return res.status(200).type('text/plain').send(challenge);
      } else {
        this.logger.warn(`[AWS WhatsApp Webhook] Verification failed. Token mismatch: received "${token}"`);
        return res.status(403).send('Verification token mismatch');
      }
    }

    // Health check endpoint info
    return res.status(200).json({
      status: 'ok',
      service: 'AWS WhatsApp & SNS Webhook Ingestion Engine',
      timestamp: new Date().toISOString(),
      routes: {
        primary: 'POST /api/webhook/whatsapp',
        snsAlias: 'POST /api/webhook/sns',
        directAlias: 'POST /api/whatsapp',
        history: 'GET /api/whatsapp/history/:phone',
      },
    });
  }

  /**
   * POST /api/webhook/whatsapp or POST /api/webhook/sns
   * Handles incoming WhatsApp messages from AWS End User Messaging Social, Meta Cloud API, or Amazon SNS
   */
  @Post()
  @Post('sns')
  async handleIncomingMessage(@Req() req: Request, @Res() res: Response, @Body() rawBody: any) {
    let body = rawBody;

    // 1. If body arrives as a raw string (e.g. from AWS SNS sending text/plain)
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (err) {
        this.logger.warn(`[AWS Webhook] Raw body is string but not valid JSON`);
      }
    }

    const messageTypeHeader = req.headers['x-amz-sns-message-type'];
    const snsType = (messageTypeHeader || body?.Type || '').toString();

    // 2. Handle AWS SNS Subscription Confirmation (Auto-confirm subscription)
    if (snsType === 'SubscriptionConfirmation' || body?.Type === 'SubscriptionConfirmation') {
      this.logger.log(`━━━━━━━━━━ AWS SNS SUBSCRIPTION CONFIRMATION ━━━━━━━━━━`);
      this.logger.log(`TopicArn: ${body?.TopicArn}`);
      if (body?.SubscribeURL) {
        this.logger.log(`Auto-confirming SNS subscription via URL: ${body.SubscribeURL}`);
        try {
          if (typeof fetch !== 'undefined') {
            await fetch(body.SubscribeURL);
            this.logger.log(`[AWS SNS] Successfully confirmed subscription for Topic: ${body.TopicArn}`);
          }
        } catch (e: any) {
          this.logger.error(`[AWS SNS] Error confirming SubscribeURL: ${e?.message}`);
        }
      }
      return res.status(200).json({ status: 'confirmed', topicArn: body?.TopicArn });
    }

    // 3. Handle AWS SNS Notification wrapper
    if (snsType === 'Notification' || body?.Type === 'Notification') {
      this.logger.log(`[AWS SNS] Received Notification from TopicArn: ${body?.TopicArn || 'Unknown'}`);
      if (typeof body.Message === 'string') {
        try {
          body = JSON.parse(body.Message);
        } catch {
          // If not JSON string, leave body.Message
        }
      } else if (body.Message && typeof body.Message === 'object') {
        body = body.Message;
      }
    }

    this.logger.log('━━━━━━━━━━ AWS WHATSAPP / SNS MESSAGE RECEIVED ━━━━━━━━━━');
    this.logger.log(`Content-Type: ${req.headers['content-type']}`);

    try {
      // 4. Check for Meta / AWS Social Messaging standard payload structure
      // Structure: body.entry[].changes[].value.messages[] OR body.whatsAppWebhookEntry...
      const entry = body?.entry?.[0] || body?.whatsAppWebhookEntry?.[0] || body?.whatsAppWebhookEntry;
      const change = entry?.changes?.[0] || entry;
      const value = change?.value || change;

      const messagesList = (value?.messages && Array.isArray(value.messages))
        ? value.messages
        : (body?.messages && Array.isArray(body.messages) ? body.messages : null);

      if (messagesList && messagesList.length > 0) {
        const contact = value?.contacts?.[0] || body?.contacts?.[0];
        const contactName = contact?.profile?.name;

        for (const message of messagesList) {
          const senderPhone = message.from; // e.g. "919876543210"
          let messageContent = '';
          let messageType = 'text';

          if (message.type === 'text') {
            messageContent = message.text?.body || '';
          } else if (message.type === 'interactive') {
            messageContent =
              message.interactive?.button_reply?.title ||
              message.interactive?.list_reply?.title ||
              '[Interactive Reply]';
          } else if (['image', 'document', 'audio', 'video'].includes(message.type)) {
            messageType = message.type;
            messageContent = message[message.type]?.caption || `[${message.type.toUpperCase()} Attachment]`;
          } else {
            messageContent = `[${message.type || 'unknown'} message]`;
          }

          await this.processMessage(senderPhone, messageContent, messageType, contactName);
        }

        return res.status(200).json({ status: 'success' });
      }

      // Check for message delivery status updates from WhatsApp / SNS
      const statuses = value?.statuses || body?.statuses;
      if (statuses && Array.isArray(statuses)) {
        for (const status of statuses) {
          this.logger.log(`[AWS WhatsApp] Delivery status update: ${status.id} -> ${status.status} (recipient: ${status.recipient_id})`);
        }
        return res.status(200).json({ status: 'success' });
      }

      // 5. Check for AWS End User Messaging Social native event payload
      const awsOrigination = body?.originationPhoneNumber || body?.origination_phone_number || body?.['origination-phone-number'];
      const awsText = body?.messageBody || body?.message_body || body?.['message-body'] || body?.text;
      if (awsOrigination && awsText) {
        await this.processMessage(awsOrigination, awsText, 'text', body?.senderName);
        return res.status(200).json({ status: 'success' });
      }

      // 6. Direct / flat payload format (e.g. from simulator, tests, or custom webhooks)
      const from = body?.from || body?.From || body?.phoneNumber;
      const content = body?.body || body?.Body || body?.text || body?.content;
      const mediaUrl = body?.mediaUrl || body?.MediaUrl0;
      const senderName = body?.name || body?.senderName;

      if (from) {
        await this.processMessage(
          from,
          content || (mediaUrl ? '[Media Attachment]' : ''),
          mediaUrl ? 'image' : 'text',
          senderName
        );
        return res.status(200).json({ status: 'success' });
      }

      const safeBodyStr = JSON.stringify(body ?? {}) || '';
      this.logger.warn(`[AWS WhatsApp] Unrecognized payload format: ${safeBodyStr.substring(0, 200)}`);
      return res.status(200).json({ status: 'ignored', reason: 'Unrecognized payload format' });

    } catch (error: any) {
      this.logger.error('[AWS WhatsApp Webhook] Failed to process message:', error?.message);
      this.logger.error(error);
      return res.status(200).json({ status: 'error', message: error?.message });
    }
  }

  /**
   * Helper to persist incoming message and broadcast to assigned staff & staff dashboard
   */
  private async processMessage(
    senderPhone: string,
    content: string,
    messageType: string = 'text',
    customerName?: string
  ) {
    if (!senderPhone || !content) {
      this.logger.warn('[AWS WhatsApp] Skipping message without sender or content');
      return;
    }

    this.logger.log(`[AWS WhatsApp] Processing message from ${senderPhone}: "${content}"`);

    // 1. Resolve student and application assignment from phone number
    const assignment = await this.chatService.resolveStudentAssignment(senderPhone);
    const resolvedStudentName = assignment.studentName || customerName || 'Student';
    const resolvedStudentEmail = assignment.studentEmail || undefined;

    // Normalize phone number with whatsapp: prefix for internal conversation lookup
    const cleanDigits = senderPhone.replace('whatsapp:', '').trim().replace(/\D/g, '');
    const formattedPhone = cleanDigits.startsWith('91') && cleanDigits.length === 12
      ? cleanDigits
      : (cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits);

    const fromAddress = `whatsapp:+${formattedPhone}`;

    // 2. Prepare conversation metadata with student & staff routing details
    const conversationMetadata: any = {
      type: 'staff',
      channel: 'whatsapp',
      assignedStaffId: assignment.assignedStaffId || null,
      assignedStaffName: assignment.assignedStaffName || null,
      assignedStaffEmail: assignment.assignedStaffEmail || null,
      applicationId: assignment.application?.id || null,
      applicationNumber: assignment.application?.applicationNumber || null,
      studentName: resolvedStudentName,
      studentEmail: resolvedStudentEmail || null,
      studentId: assignment.user?.id || null,
      loanType: assignment.application?.loanType || null,
      bank: assignment.application?.bank || null,
    };

    // 3. Get or create/reactivate the conversation for this phone
    const conversation = await this.chatService.getOrCreateConversation(
      fromAddress,
      resolvedStudentEmail,
      'staff',
      resolvedStudentName,
      undefined,
      conversationMetadata
    );

    this.logger.log(
      `[AWS WhatsApp] Conversation ID: ${conversation.id} | Student: ${resolvedStudentName} | Assigned Staff: ${assignment.assignedStaffId || 'Unassigned'}`
    );

    // 4. Save message to database with student sender name
    const msg = await this.chatService.saveMessage({
      conversationId: conversation.id,
      senderType: 'customer',
      senderId: conversation.customerPhone,
      receiverType: 'staff',
      senderName: resolvedStudentName,
      content: content,
      messageType: messageType || 'text',
      status: 'delivered',
    });

    this.logger.log(`[AWS WhatsApp] Saved message with ID: ${msg.id}`);

    // 5. Emit real-time WebSocket events
    if (this.chatGateway.server) {
      // Notify staff actively viewing this specific conversation thread
      this.chatGateway.server.to(`conv_${conversation.id}`).emit('new_message', msg);
      this.logger.log(`[AWS WhatsApp] Emitted 'new_message' to conv_${conversation.id}`);

      // Notify global staff dashboard room
      const type = conversation.metadata?.type || 'staff';
      const room = type === 'bank' ? 'room_bank' : 'room_staff';
      this.chatGateway.server.to(room).emit('conversation_updated', {
        conversationId: conversation.id,
        lastMessage: msg,
        metadata: conversation.metadata,
      });
      this.logger.log(`[AWS WhatsApp] Emitted 'conversation_updated' to ${room}`);

      // TARGETED: If an assigned staff member is resolved, notify their dedicated socket room
      if (assignment.assignedStaffId) {
        const staffRoom = `user_${assignment.assignedStaffId}`;
        this.chatGateway.server.to(staffRoom).emit('conversation_updated', {
          conversationId: conversation.id,
          lastMessage: msg,
          metadata: conversation.metadata,
          isAssignedToMe: true,
        });

        this.chatGateway.server.to(staffRoom).emit('staff_new_whatsapp_message', {
          conversationId: conversation.id,
          studentName: resolvedStudentName,
          applicationNumber: assignment.application?.applicationNumber || null,
          content: content,
          message: msg,
          createdAt: new Date().toISOString(),
        });

        this.logger.log(`[AWS WhatsApp] Emitted targeted alerts to assigned staff room: ${staffRoom}`);
      }
    } else {
      this.logger.warn('[AWS WhatsApp] WebSocket server not initialized — real-time update skipped');
    }
  }

  /**
   * Get message history for a phone number
   * GET /api/whatsapp/history/:phone
   */
  @Get('history/:phone')
  async getHistory(@Param('phone') phone: string) {
    const cleanPhone = phone.replace('whatsapp:', '').trim().replace(/\D/g, '');
    const phoneNo = cleanPhone.length > 10 && cleanPhone.startsWith('91')
      ? cleanPhone.substring(2)
      : (cleanPhone.length > 10 ? cleanPhone.slice(-10) : cleanPhone);

    try {
      const { data: convData } = await this.chatService.db
        .from('Conversation')
        .select('id, customerPhone')
        .eq('customerPhone', phoneNo)
        .eq('status', 'active')
        .limit(1);

      const conv = convData?.[0];
      if (conv) {
        await this.chatService.markMessagesAsRead(conv.id, 'customer');
        if (this.chatGateway.server) {
          this.chatGateway.server.to(`conv_${conv.id}`).emit('messages_read', {
            conversationId: conv.id,
            readerType: 'customer',
            readerId: conv.customerPhone || 'customer',
          });
          this.chatGateway.server.to('room_staff').emit('conversation_updated', {
            conversationId: conv.id,
          });
          this.chatGateway.server.to('room_bank').emit('conversation_updated', {
            conversationId: conv.id,
          });
        }
      }
    } catch (e: any) {
      this.logger.error(`Failed to auto-mark messages as read in history: ${e?.message}`);
    }

    return this.chatService.getMessagesByPhone(phone);
  }
}
