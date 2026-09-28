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
@Controller(['webhook/whatsapp', 'whatsapp'])
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
    private readonly configService: ConfigService
  ) {}

  /**
   * GET /api/webhook/whatsapp or GET /api/whatsapp
   * Handles Meta / AWS WhatsApp webhook challenge verification and healthcheck
   */
  @Get()
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
      service: 'AWS WhatsApp Webhook Handler',
      timestamp: new Date().toISOString(),
      routes: {
        primary: 'POST /api/webhook/whatsapp',
        alias:   'POST /api/whatsapp',
        history: 'GET  /api/whatsapp/history/:phone',
      },
    });
  }

  /**
   * POST /api/webhook/whatsapp or POST /api/whatsapp
   * Handles incoming WhatsApp messages from AWS End User Messaging Social, Meta Cloud API, or SNS
   */
  @Post()
  async handleIncomingMessage(@Req() req: Request, @Res() res: Response, @Body() rawBody: any) {
    let body = rawBody;

    // Handle AWS SNS wrapper if received via SNS HTTP/HTTPS subscription
    if (body?.Type === 'SubscriptionConfirmation') {
      this.logger.log(`[AWS SNS] Received SubscriptionConfirmation. TopicArn: ${body.TopicArn}`);
      if (body.SubscribeURL) {
        this.logger.log(`[AWS SNS] Auto-confirm URL: ${body.SubscribeURL}`);
        try {
          // If native fetch is available, automatically confirm
          if (typeof fetch !== 'undefined') {
            await fetch(body.SubscribeURL);
            this.logger.log(`[AWS SNS] Successfully auto-confirmed subscription to ${body.TopicArn}`);
          }
        } catch (e: any) {
          this.logger.warn(`[AWS SNS] Auto-confirm fetch error: ${e?.message}`);
        }
      }
      return res.status(200).json({ status: 'confirmed' });
    }

    if (body?.Type === 'Notification' && typeof body.Message === 'string') {
      try {
        body = JSON.parse(body.Message);
      } catch {
        // use raw body.Message if not JSON
      }
    }

    this.logger.log('━━━━━━━━━━ AWS WHATSAPP WEBHOOK RECEIVED ━━━━━━━━━━');
    this.logger.log(`Content-Type: ${req.headers['content-type']}`);

    try {
      // 1. Check for Meta / AWS WhatsApp Cloud API payload format
      // Structure: body.entry[].changes[].value.messages[]
      const entry = body?.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;

      if (value?.messages && Array.isArray(value.messages) && value.messages.length > 0) {
        const contact = value.contacts?.[0];
        const contactName = contact?.profile?.name;

        for (const message of value.messages) {
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

      // Check if it's a delivery status update (sent, delivered, read)
      if (value?.statuses && Array.isArray(value.statuses)) {
        for (const status of value.statuses) {
          this.logger.log(`[AWS WhatsApp] Message Status Update: ${status.id} -> ${status.status} for recipient ${status.recipient_id}`);
        }
        return res.status(200).json({ status: 'success' });
      }

      // 2. Fallback to direct / flat payload format (e.g. from simulator or webhook forwarders)
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

      this.logger.warn(`[AWS WhatsApp] Unrecognized payload format: ${JSON.stringify(body).substring(0, 200)}`);
      return res.status(200).json({ status: 'ignored', reason: 'Unrecognized payload format' });

    } catch (error: any) {
      this.logger.error('[AWS WhatsApp Webhook] Failed to process message:', error?.message);
      this.logger.error(error);
      return res.status(200).json({ status: 'error', message: error?.message });
    }
  }

  /**
   * Helper to persist incoming message and broadcast to staff & bank rooms
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

    // Normalize phone number with whatsapp: prefix for internal conversation lookup
    const cleanDigits = senderPhone.replace('whatsapp:', '').trim().replace(/\D/g, '');
    const formattedPhone = cleanDigits.startsWith('91') && cleanDigits.length === 12
      ? cleanDigits
      : (cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits);

    const fromAddress = `whatsapp:+${formattedPhone}`;

    // 1. Get or create the conversation for this phone
    const conversation = await this.chatService.getOrCreateConversation(
      fromAddress,
      undefined,
      'staff',
      customerName
    );

    this.logger.log(`[AWS WhatsApp] Conversation ID: ${conversation.id} | Phone: ${conversation.customerPhone}`);

    // 2. Save message to database
    const msg = await this.chatService.saveMessage({
      conversationId: conversation.id,
      senderType: 'customer',
      senderId: conversation.customerPhone,
      receiverType: 'system',
      content: content,
      messageType: messageType || 'text',
      status: 'delivered',
    });

    this.logger.log(`[AWS WhatsApp] Saved message with ID: ${msg.id}`);

    // 3. Emit real-time WebSocket events to staff dashboard
    if (this.chatGateway.server) {
      // Notify staff actively viewing this conversation
      this.chatGateway.server.to(`conv_${conversation.id}`).emit('new_message', msg);
      this.logger.log(`[AWS WhatsApp] Emitted 'new_message' to conv_${conversation.id}`);

      // Notify global dashboard room to update list order & badges
      const type = conversation.metadata?.type || 'staff';
      const room = type === 'bank' ? 'room_bank' : 'room_staff';
      this.chatGateway.server.to(room).emit('conversation_updated', {
        conversationId: conversation.id,
        lastMessage: msg,
      });
      this.logger.log(`[AWS WhatsApp] Emitted 'conversation_updated' to ${room}`);
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
