import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards, Logger } from '@nestjs/common';
import { ChatService } from './chat.service';
import { TwilioService } from './twilio.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';

@WebSocketGateway({
  cors: {
    origin: '*', // Change in production
  },
  namespace: '/chat'
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private onlineUsers = new Map<string, string>(); // client.id -> email

  constructor(
    private readonly chatService: ChatService,
    private readonly twilioService: TwilioService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token || client.handshake.headers['authorization']?.split(' ')[1];
      
      // Allow simulator connections without full JWT if flagged
      const isSimulator = client.handshake.auth.simulator === true;
      const simPhone = client.handshake.auth.phone;

      if (isSimulator && simPhone) {
        const digits = String(simPhone).replace('whatsapp:', '').trim().replace(/\D/g, '');
        const cleanPhone = digits.length > 10 && digits.startsWith('91') ? digits.substring(2) : (digits.length > 10 ? digits.slice(-10) : digits);
        client.join(`sim_${cleanPhone}`);
        this.logger.log(`Simulator connected for phone: ${cleanPhone}`);
        return;
      }

      if (!token) {
        throw new Error('No token provided');
      }
      
      const payload = await this.jwtService.verifyAsync(token, {
          secret: this.configService.get('JWT_SECRET')
      });
      
      client.data.user = payload;
      this.logger.log(`Client connected: ${client.id} (User: ${payload.email}, Role: ${payload.role})`);
      
      // Join general room based on role
      if (payload.role === 'admin' || payload.role === 'staff' || payload.role === 'super_admin') {
        client.join('room_staff');
      } else if (payload.role === 'bank' || payload.role === 'partner_bank') {
        client.join('room_bank');
        // Also join a per-bank room so notifications can be targeted to a specific bank
        // The bankId may be stored on the JWT as bankId, bank_id, or derived from bankName
        const bankId = payload.bankId || payload.bank_id || payload.selectedBank || null;
        if (bankId) {
          const safeBankId = String(bankId).toLowerCase().replace(/[^a-z0-9_-]/g, '_');
          client.join(`room_bank_${safeBankId}`);
          client.data.bankId = safeBankId;
          this.logger.log(`Bank client ${client.id} joined per-bank room: room_bank_${safeBankId}`);
        }
      } else if (payload.role === 'support') {
        client.join('room_support');
        client.join('room_staff');
        client.join('room_bank');
      }

      // Join direct user room for personal notifications
      const userId = payload.id || payload.uid || payload.sub;
      if (userId) {
        client.join(`user_${userId}`);
      }

      // Track online presence if email is available
      if (payload.email) {
        this.onlineUsers.set(client.id, payload.email.toLowerCase());
        this.server.to('room_staff').emit('presence_update', Array.from(new Set(this.onlineUsers.values())));
      }

    } catch (error) {
      this.logger.warn(`Connection rejected: ${client.id} - ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    const email = this.onlineUsers.get(client.id);
    if (email) {
      this.onlineUsers.delete(client.id);
      this.server.to('room_staff').emit('presence_update', Array.from(new Set(this.onlineUsers.values())));
    }
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() room: string
  ) {
    // Only allow joining rooms the user's role is permitted to access
    const user = client.data.user;
    const isStaff = user?.role === 'admin' || user?.role === 'staff' || user?.role === 'super_admin' || user?.role === 'support';
    const isBank = user?.role === 'bank' || user?.role === 'partner_bank' || user?.role === 'support';
    const isSupport = user?.role === 'support' || user?.role === 'admin' || user?.role === 'super_admin';
    // Allow per-bank rooms (e.g. room_bank_idfc) for bank clients
    const isPerBankRoom = isBank && /^room_bank_[a-z0-9_-]+$/.test(room);
    if ((room === 'room_staff' && isStaff) || (room === 'room_bank' && isBank) || (room === 'room_support' && isSupport) || isPerBankRoom) {
      client.join(room);
      this.logger.log(`Client ${client.id} explicitly joined ${room}`);
    }
    return { success: true };
  }

  @SubscribeMessage('request_presence')
  handleRequestPresence(@ConnectedSocket() client: Socket) {
    client.emit('presence_update', Array.from(new Set(this.onlineUsers.values())));
    return { success: true };
  }

  @SubscribeMessage('join_conversation')
  handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: string
  ) {
    client.join(`conv_${conversationId}`);
    return { status: 'joined', conversationId };
  }

  @SubscribeMessage('leave_conversation')
  handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: string
  ) {
    client.leave(`conv_${conversationId}`);
    return { status: 'left', conversationId };
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string }
  ) {
    const user = client.data.user;
    const isSimulator = client.handshake.auth.simulator === true;
    if (!user && !isSimulator) return { success: false };

    const role = user ? user.role : 'customer';
    const isStaffOrBank = user && ['admin', 'staff', 'super_admin', 'bank', 'partner_bank', 'support'].includes(role);
    const readerType = isStaffOrBank ? 'staff_or_bank' : 'customer';

    try {
      await this.chatService.markMessagesAsRead(payload.conversationId, readerType, role);

      let readerId = '';
      if (readerType === 'customer') {
        const conv = await this.chatService.getConversationById(payload.conversationId);
        readerId = conv?.customerPhone || 'customer';
      } else {
        readerId = user?.email || user?.sub || 'staff';
      }
      
      // Broadcast read receipt to room
      this.server.to(`conv_${payload.conversationId}`).emit('messages_read', {
        conversationId: payload.conversationId,
        readerType,
        readerId
      });

      // Also trigger list update to clear unread indicator
      const listRoom = user && ['bank', 'partner_bank'].includes(role) ? 'room_bank' : 'room_staff';
      this.server.to(listRoom).emit('conversation_updated', {
        conversationId: payload.conversationId
      });

      return { success: true };
    } catch (e) {
      this.logger.error('Failed to mark messages as read', e);
      return { success: false, error: e.message };
    }
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string, customerPhone: string, content: string }
  ) {
    const user = client.data.user;
    const senderType = user.role || 'staff'; // fallback

    try {
      // Check if WhatsApp Simulator is connected
      const rawPhone = payload.customerPhone || '';
      const digits = rawPhone.replace('whatsapp:', '').trim().replace(/\D/g, '');
      const cleanPhone = digits.length > 10 && digits.startsWith('91') ? digits.substring(2) : (digits.length > 10 ? digits.slice(-10) : digits);
      const room = rawPhone ? this.server?.sockets?.adapter?.rooms?.get(`sim_${cleanPhone}`) : null;
      const isSimConnected = room ? room.size > 0 : false;
      const initialStatus = isSimConnected ? 'read' : 'sent';

      // 1. Save to database
      const senderName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || undefined;
      const msg = await this.chatService.saveMessage({
        conversationId: payload.conversationId,
        senderType,
        senderId: user?.email || user?.sub || 'user',
        senderName,
        receiverType: 'customer',
        content: payload.content,
        status: initialStatus
      });

      // 2. Broadcast to other dashboards observing this conversation
      this.server.to(`conv_${payload.conversationId}`).emit('new_message', msg);
      
      // Also notify general dashboard rooms for list updates
      const conv = await this.chatService.getConversationById(payload.conversationId);
      const convType = conv?.metadata?.type;

      if (convType === 'support_to_staff' || convType === 'support_to_bank') {
        this.server.to('room_support').emit('conversation_updated', {
          conversationId: payload.conversationId,
          lastMessage: msg
        });
        if (convType === 'support_to_bank') {
          this.server.to('room_bank').emit('conversation_updated', {
            conversationId: payload.conversationId,
            lastMessage: msg
          });
        } else {
          this.server.to('room_staff').emit('conversation_updated', {
            conversationId: payload.conversationId,
            lastMessage: msg
          });
        }
      } else if (convType === 'bank') {
        this.server.to('room_staff').emit('conversation_updated', {
          conversationId: payload.conversationId,
          lastMessage: msg
        });
        this.server.to('room_bank').emit('conversation_updated', {
          conversationId: payload.conversationId,
          lastMessage: msg
        });
      } else {
        if (user.role === 'bank' || user.role === 'partner_bank') {
          this.server.to('room_bank').emit('conversation_updated', {
            conversationId: payload.conversationId,
            lastMessage: msg
          });
        } else {
          this.server.to('room_staff').emit('conversation_updated', {
            conversationId: payload.conversationId,
            lastMessage: msg
          });
        }
      }

      // 3. Update WhatsApp Simulator if connected
      this.server.to(`sim_${cleanPhone}`).emit('wa_message_received', msg);

      // 4. Send out via Twilio WhatsApp (Real)
      if (payload.customerPhone) {
        await this.twilioService.sendWhatsAppMessage(payload.customerPhone, payload.content).catch(e => {
            this.logger.error('Twilio Error (ignoring for simulation): ' + e.message);
        });
      }
      
      return { success: true, message: msg };
    } catch (e) {
      this.logger.error('Failed to process outgoing message', e);
      return { success: false, error: e.message };
    }
  }

  @SubscribeMessage('sim_customer_reply')
  async handleSimReply(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { phone: string, content: string }
  ) {
    try {
        const from = payload.phone.startsWith('whatsapp:') ? payload.phone : `whatsapp:${payload.phone}`;
        
        // Use existing logic from service/controller
        const conversation = await this.chatService.getOrCreateConversation(from);
        const msg = await this.chatService.saveMessage({
            conversationId: conversation.id,
            senderType: 'customer',
            senderId: conversation.customerPhone,
            content: payload.content,
            status: 'delivered'
        });

        // Broadcast to relevant rooms
        this.server.to(`conv_${conversation.id}`).emit('new_message', msg);
        
        const type = conversation.metadata?.type || 'staff';
        if (type === 'bank') {
          this.server.to('room_bank').emit('conversation_updated', {
            conversationId: conversation.id,
            lastMessage: msg
          });
        } else {
          this.server.to('room_staff').emit('conversation_updated', {
            conversationId: conversation.id,
            lastMessage: msg
          });
        }

        return { success: true, message: msg };
    } catch (e) {
        this.logger.error('Simulator reply failed', e);
        return { success: false, error: e.message };
    }
  }

  @SubscribeMessage('send_multiparty_message')
  handleSendMultipartyMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: any
  ) {
    this.logger.log(`Broadcasting multiparty message in conversation ${payload.conversationId}`);
    if (this.server) {
      this.server.to(`conv_${payload.conversationId}`).emit('new_message', payload);
      
      const user = client.data.user;
      if (user) {
        if (user.role === 'bank' || user.role === 'partner_bank') {
          this.server.to('room_bank').emit('conversation_updated', {
            conversationId: payload.conversationId,
            lastMessage: payload
          });
        } else {
          this.server.to('room_staff').emit('conversation_updated', {
            conversationId: payload.conversationId,
            lastMessage: payload
          });
        }
      }
    }
    return { success: true };
  }

  @OnEvent('user.login')
  handleUserLogin(payload: any) {
    this.logger.log(`Broadcasting login alert for ${payload.email} to staff`);
    if (this.server) {
      this.server.to('room_staff').emit('user_activity', {
        id: Date.now(),
        type: payload.isNewUser ? 'registration' : 'login',
        msg: `${payload.firstName || 'Student'} ${payload.lastName || ''} logged in.`,
        time: 'Just now',
        color: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        icon: 'login',
        actorName: `${payload.firstName || 'Student'} ${payload.lastName || ''}`.trim() || payload.email,
        actorEmail: payload.email,
        createdAt: new Date().toISOString()
      });
    } else {
      this.logger.warn(`WS server not initialized. Skipping user.login broadcast.`);
    }
  }

  @OnEvent('dashboard.activity')
  handleDashboardActivity(payload: any) {
    this.logger.log(`Broadcasting dashboard activity: ${payload.msg}`);
    if (this.server) {
      this.server.to('room_staff').emit('user_activity', {
        id: payload.id || Date.now(),
        type: payload.type || 'info',
        msg: payload.msg,
        time: payload.time || 'Just now',
        icon: payload.icon || 'history',
        color: payload.color || 'bg-slate-50 text-slate-600 border-slate-100',
        actorName: payload.actorName || 'System',
        actorEmail: payload.actorEmail || null,
        createdAt: payload.createdAt || new Date().toISOString()
      });
    } else {
      this.logger.warn(`WS server not initialized. Skipping dashboard.activity broadcast.`);
    }
  }

  @OnEvent('notification.created')
  handleNotificationCreated(payload: any) {
    this.logger.log(`Broadcasting notification alert: ${payload.title} to User ID: ${payload.userId}`);
    if (this.server) {
      if (payload.userId === 'staff' || payload.userId === 'system') {
        this.server.to('room_staff').emit('notification_received', payload);
      } else if (payload.userId === 'bank') {
        // Always emit to room_bank so clients with older JWTs (no bankId) still receive it.
        // Also emit to the per-bank room when bankId is present for targeted delivery.
        // Client-side isNotificationForThisBank() handles filtering by bank.
        let metadata = payload.metadata;
        if (typeof metadata === 'string') {
          try { metadata = JSON.parse(metadata); } catch { metadata = {}; }
        }
        const rawBankId = metadata?.bankId || metadata?.bank_id || null;
        if (rawBankId) {
          const safeBankId = String(rawBankId).toLowerCase().replace(/[^a-z0-9_-]/g, '_');
          const perBankRoom = `room_bank_${safeBankId}`;
          this.logger.log(`Emitting notification to per-bank room: ${perBankRoom} and room_bank`);
          // Dual emit: per-bank room (precise) + room_bank (fallback for older tokens)
          this.server.to(perBankRoom).emit('notification_received', payload);
          this.server.to('room_bank').emit('notification_received', payload);
        } else {
          this.logger.log(`No bankId in metadata, broadcasting to room_bank (all banks)`);
          this.server.to('room_bank').emit('notification_received', payload);
        }
      } else {
        this.server.to(`user_${payload.userId}`).emit('notification_received', payload);
      }
    } else {
      this.logger.warn(`WS server not initialized. Skipping notification broadcast.`);
    }
  }

  @OnEvent('chat.message_created')
  async handleChatMessageCreated(msg: any) {
    this.logger.log(`Broadcasting programmatically created message in conversation ${msg.conversationId}`);
    if (this.server) {
      this.server.to(`conv_${msg.conversationId}`).emit('new_message', msg);
      
      const conv = await this.chatService.getConversationById(msg.conversationId);
      const convType = conv?.metadata?.type;

      if (convType === 'support_to_staff' || convType === 'support_to_bank') {
        this.server.to('room_support').emit('conversation_updated', {
          conversationId: msg.conversationId,
          lastMessage: msg
        });
        if (convType === 'support_to_bank') {
          this.server.to('room_bank').emit('conversation_updated', {
            conversationId: msg.conversationId,
            lastMessage: msg
          });
        } else {
          this.server.to('room_staff').emit('conversation_updated', {
            conversationId: msg.conversationId,
            lastMessage: msg
          });
        }
      } else {
        if (convType === 'bank') {
          this.server.to('room_bank').emit('conversation_updated', {
            conversationId: msg.conversationId,
            lastMessage: msg
          });
          this.server.to('room_staff').emit('conversation_updated', {
            conversationId: msg.conversationId,
            lastMessage: msg
          });
        } else {
          this.server.to('room_staff').emit('conversation_updated', {
            conversationId: msg.conversationId,
            lastMessage: msg
          });
        }
      }
    }
  }

  @OnEvent('chat.message_updated')
  async handleChatMessageUpdated(msg: any) {
    this.logger.log(`Broadcasting updated message ${msg.id} in conversation ${msg.conversationId}`);
    if (this.server) {
      this.server.to(`conv_${msg.conversationId}`).emit('message_updated', msg);
      
      const conv = await this.chatService.getConversationById(msg.conversationId);
      const convType = conv?.metadata?.type;
      const listRoom = convType === 'bank' ? 'room_bank' : 'room_staff';
      this.server.to(listRoom).emit('conversation_updated', {
        conversationId: msg.conversationId,
        lastMessage: msg
      });
    }
  }

  @OnEvent('chat.message_deleted')
  async handleChatMessageDeleted(payload: { conversationId: string, messageId: string }) {
    this.logger.log(`Broadcasting deleted message ${payload.messageId} in conversation ${payload.conversationId}`);
    if (this.server) {
      this.server.to(`conv_${payload.conversationId}`).emit('message_deleted', payload);
      
      // Update conversation last message in lists
      const messages = await this.chatService.getMessages(payload.conversationId);
      const lastMsg = messages && messages.length > 0 ? messages[messages.length - 1] : null;
      
      const conv = await this.chatService.getConversationById(payload.conversationId);
      const convType = conv?.metadata?.type;
      const listRoom = convType === 'bank' ? 'room_bank' : 'room_staff';
      this.server.to(listRoom).emit('conversation_updated', {
        conversationId: payload.conversationId,
        lastMessage: lastMsg
      });
    }
  }

  @OnEvent('chat.conversation.created')
  async handleConversationCreated(payload: { conversation: any, type: string, bankName?: string }) {
    this.logger.log(`Broadcasting newly created conversation ${payload.conversation?.id}`);
    if (this.server && payload.conversation) {
      if (payload.type === 'bank') {
        this.server.to('room_bank').emit('conversation_updated', {
          conversationId: payload.conversation.id
        });
        this.server.to('room_staff').emit('conversation_updated', {
          conversationId: payload.conversation.id
        });
      } else {
        this.server.to('room_staff').emit('conversation_updated', {
          conversationId: payload.conversation.id
        });
      }
    }
  }
}
