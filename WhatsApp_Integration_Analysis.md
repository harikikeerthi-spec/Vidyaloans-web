# WhatsApp & Amazon SNS Integration Architecture

## Overview
The application integrates WhatsApp messaging through **AWS End User Messaging Social** (Meta WhatsApp Cloud API) and **Amazon SNS** to enable real-time student-to-assigned-staff communication. 

Incoming messages from students on WhatsApp are received via AWS SNS or direct HTTPS webhooks, resolved to the student's active **LoanApplication** and assigned staff member, stored in the database, and routed to the assigned staff member's dashboard in real time. Staff can reply directly from their dashboard back to the student's WhatsApp.

---

## Key Components

### 1. **WhatsApp & SNS Webhook Controller**
**File:** [server/src/chat/whatsapp.controller.ts](server/src/chat/whatsapp.controller.ts)

**Endpoints:**
- `GET  /api/webhook/whatsapp` & `GET  /api/webhook/sns` - Challenge verification (`hub.challenge`) & healthcheck
- `POST /api/webhook/whatsapp` & `POST /api/webhook/sns` - AWS SNS and WhatsApp incoming messages
- `GET  /api/whatsapp/history/:phone` - Message history for a phone number

**Supported Payload Formats:**
1. **Amazon SNS Subscription Confirmation:** Auto-fetches `SubscribeURL` to automatically confirm subscriptions.
2. **Amazon SNS Notifications:** Extracts WhatsApp messages wrapped in `body.Message`.
3. **Meta / AWS WhatsApp Cloud API:** Standard `entry[].changes[].value.messages[]`.
4. **AWS End User Messaging Social Native Events:** `originationPhoneNumber` & `messageBody`.
5. **Direct Simulator / Test Payloads:** `{ from, body }`.

**Staff Resolution Flow:**
1. Student sends WhatsApp message.
2. Webhook triggers `ChatService.resolveStudentAssignment(phone)`.
3. Looks up student in `User` and their latest active `LoanApplication`.
4. Enriches `Conversation.metadata` with:
   - `assignedStaffId`, `assignedStaffName`, `assignedStaffEmail`
   - `applicationId`, `applicationNumber`
   - `studentName`, `studentEmail`, `studentId`
   - `channel: 'whatsapp'`
5. Emits targeted real-time WebSocket events to:
   - `user_${assignedStaffId}` (triggers personal staff alert & unread badges)
   - `conv_${conversationId}` (active chat thread)
   - `room_staff` (global staff inquiry list)
6. Emits `staff.chat.received` event to trigger in-app bell notification for the assigned staff.

---

### 2. **Twilio Service**
**File:** [server/src/chat/twilio.service.ts](server/src/chat/twilio.service.ts)

**Responsibilities:**
- Initialize Twilio client using environment variables:
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_WHATSAPP_NUMBER` (default: `whatsapp:+14155238886`)

- **Method:** `sendWhatsAppMessage(to: string, body: string)`
  - Sends outgoing messages to customers via WhatsApp
  - Normalizes phone numbers (adds country code +91 if Indian 10-digit)
  - Returns message SID on success
  - Handles mock mode for development (when credentials are mock values)

**Features:**
- Phone number formatting: Handles 10-digit, 11-digit, and full international formats
- Mock fallback: Returns mock SID when Twilio client not initialized
- Error handling: Catches Twilio auth errors and logs appropriately

---

### 3. **Chat Service**
**File:** [server/src/chat/chat.service.ts](server/src/chat/chat.service.ts)

**Key Methods:**

**`getOrCreateConversation(customerPhone, customerEmail?, conversationType?, customerName?, bankName?, additionalMetadata?)`**
- Creates or reactivates conversation record
- Phone normalization: Strips `whatsapp:` prefix and normalizes to 10 digits
- Merges metadata (conversation type, bank name, application ID)
- Tracks conversation with:
  - `customerPhone`: Normalized 10-digit number
  - `status`: 'active'
  - `customerEmail`: Optional
  - `customerName`: Optional
  - `metadata`: Type, bank, application ID

**`saveMessage(data)`**
- Stores message in database with fields:
  - `conversationId`, `senderType`, `senderId`, `receiverType`
  - `content`, `messageType`, `status`
  - `createdAt`, `updatedAt`

**`getMessages(conversationId)`**
- Retrieves all messages for a conversation

**`getMessagesByPhone(phone)`**
- Retrieves message history for a phone number

---

### 4. **Chat Gateway (WebSocket)**
**File:** [server/src/chat/chat.gateway.ts](server/src/chat/chat.gateway.ts)

**Real-time Events Emitted by Webhook:**

1. **`new_message` event** → Sent to room `conv_{conversationId}`
   - Updates staff actively viewing a specific conversation
   - Payload: Full message object

2. **`conversation_updated` event** → Sent to room `room_staff` or `room_bank`
   - Updates global conversation list on dashboard
   - Notifies all connected staff of new/updated conversation
   - Payload: `{ conversationId, lastMessage }`

---

### 5. **Chat Controller**
**File:** [server/src/chat/chat.controller.ts](server/src/chat/chat.controller.ts)

**Key Endpoints:**
- `GET /chat/conversations?bankName=XYZ` - List all conversations (filtered by bank if specified)
- `GET /chat/messages/:conversationId` - Get all messages in conversation
- `POST /chat/connect` - Customer initiates chat with staff
- File upload handling for message attachments

---

### 6. **Database Schema**
**Tables:**

**`Conversation`**
```sql
- id: UUID (primary key)
- customerPhone: VARCHAR(10) (normalized)
- customerEmail: VARCHAR(255)
- customerName: VARCHAR(255)
- status: ENUM ('active', 'closed', 'archived')
- metadata: JSONB {
    type: 'staff' | 'bank',
    bank: string | null,
    applicationId: string | null
  }
- createdAt: TIMESTAMP
- updatedAt: TIMESTAMP
```

**`Message`**
```sql
- id: UUID (primary key)
- conversationId: UUID (foreign key)
- senderType: ENUM ('customer', 'staff', 'system')
- senderId: VARCHAR(255) (phone, staff ID, or identifier)
- receiverType: ENUM ('customer', 'staff', 'system')
- content: TEXT
- messageType: ENUM ('text', 'image', 'video', 'document')
- status: ENUM ('sent', 'delivered', 'read', 'failed')
- createdAt: TIMESTAMP
- updatedAt: TIMESTAMP
```

**`Conversation_Participant`** (Multi-party support)
```sql
- id: UUID (primary key)
- conversationId: UUID (foreign key)
- participantId: VARCHAR(255)
- participantType: ENUM ('customer', 'staff', 'bot')
- joinedAt: TIMESTAMP
```

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. CUSTOMER sends WhatsApp message via Twilio               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Twilio Webhook POST → /api/webhook/whatsapp              │
│    Content-Type: application/x-www-form-urlencoded          │
│    Payload: From, To, Body, MessageSid, NumMedia, MediaUrl0 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. WhatsappController.handleIncomingMessage()               │
│    - Extract fields (From, Body, MediaUrl0)                 │
│    - Normalize phone number (remove 'whatsapp:', → 10 digit)│
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. ChatService.getOrCreateConversation()                    │
│    - Query existing conversation by phone                   │
│    - Create new if not found                                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. ChatService.saveMessage()                                │
│    - Insert message into database                           │
│    - Set status: 'delivered'                                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. ChatGateway (WebSocket)                                  │
│    - Emit 'new_message' to conv_${conversationId}           │
│    - Emit 'conversation_updated' to room_staff/room_bank    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Staff Dashboard receives real-time updates               │
│    - Conversation appears/updates in list                   │
│    - Message appears in chat window                         │
│    - Badge/notification for new message                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Outgoing Messages (Staff → Customer)

**Flow:**
1. Staff replies via dashboard chat interface
2. Chat endpoint processes reply
3. **TwilioService.sendWhatsAppMessage()** called
4. Message sent through Twilio to customer's WhatsApp
5. Status: 'sent' → 'delivered' (Twilio callback)

**Example:**
```javascript
const result = await twilioService.sendWhatsAppMessage(
  '+919876543210',  // or 'whatsapp:+919876543210'
  'Hello! Your loan status has been updated.'
);
// Result: { sid: 'SMxxxxxxxx...', status: 'sent' }
```

---

## Configuration

**Environment Variables:**
```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=auth_token_here
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# Database
DATABASE_URL=postgresql://...
```

---

## Frontend Integration Points

### Customer Side
- Initiated via: `POST /chat/connect`
- Uses WebSocket to receive incoming messages in real-time
- Can upload files/images with messages

### Staff Dashboard
- **Conversation List View:** Sorted by last message time
- **Message Thread View:** Shows all messages in conversation
- **Real-time Updates:** WebSocket subscription to `room_staff` or `room_bank`
- **Message Status:** Visible indicators (sent, delivered, read)
- **Quick Reply:** Text input to send WhatsApp messages

---

## Phone Number Normalization

**Input Handling:**
- `+919876543210` → `9876543210`
- `919876543210` → `9876543210`
- `whatsapp:+919876543210` → `9876543210`
- `whatsapp:9876543210` → `9876543210`

**Output Format (for Twilio):**
- `9876543210` → `whatsapp:+919876543210` (with country code)

**Special Cases:**
- Synthetic IDs (start with `BNK_` or `STF_`) are passed through unchanged
- Used for system/bank staff conversations

---

## Error Handling

| Error | Scenario | Response |
|-------|----------|----------|
| Missing `From` field | Malformed webhook | 400 Bad Request |
| No `Body` or `MediaUrl0` | Empty message | 200 OK (ignored) |
| Twilio Auth Error (code 20003) | Invalid SID/Token | Warning logged, mock mode fallback |
| Database Error | Connection failed | 500 error logged |
| Webhook Processing Error | Any exception | 200 OK + error logged (prevent Twilio retry spam) |

---

## Security Considerations

1. **Webhook Validation:**
   - Twilio request validation (tokens/signatures)
   - Input sanitization (phone numbers, content)

2. **Access Control:**
   - Staff dashboard requires authentication (`UserGuard`)
   - Conversations filtered by bank/user role

3. **Data Privacy:**
   - Messages stored in encrypted database
   - Phone numbers normalized and stored securely
   - No PII in logs

4. **Rate Limiting:**
   - Recommended: Implement rate limiting on webhook endpoint
   - Prevent message spam/DoS

---

## Related Files

**Core:**
- [server/src/chat/whatsapp.controller.ts](server/src/chat/whatsapp.controller.ts)
- [server/src/chat/twilio.service.ts](server/src/chat/twilio.service.ts)
- [server/src/chat/chat.service.ts](server/src/chat/chat.service.ts)
- [server/src/chat/chat.gateway.ts](server/src/chat/chat.gateway.ts)
- [server/src/chat/chat.controller.ts](server/src/chat/chat.controller.ts)
- [server/src/chat/chat.module.ts](server/src/chat/chat.module.ts)

**UI/Frontend:**
- [frontend/app/(public)/whatsapp-simulator/page.tsx](frontend/app/(public)/whatsapp-simulator/page.tsx)
- Staff dashboard chat components (in frontend/components or frontend/app)

**Database Migrations:**
- [server/scripts/migrate_chat_multiparty.sql](server/scripts/migrate_chat_multiparty.sql)

**Utilities:**
- [server/src/chat/dto/chat.dto.ts](server/src/chat/dto/chat.dto.ts)
- [server/src/chat/email.service.ts](server/src/chat/email.service.ts)
- [server/src/chat/student-notification.service.ts](server/src/chat/student-notification.service.ts)

---

## Testing

**WhatsApp Simulator Available:**
- Endpoint: `GET /whatsapp-simulator`
- Allows testing message flow without real Twilio account
- Useful for development and QA

---

## Deployment Notes

1. **Set Twilio Webhook URL** in Twilio Console → Sandbox Settings:
   - URL: `https://your-domain.com/api/webhook/whatsapp`
   - Method: POST

2. **Ensure HTTPS** for webhook endpoint

3. **Monitor Webhook Logs** for failures:
   - Check database for incoming messages
   - Verify WebSocket connections for real-time updates

4. **Scaling Considerations:**
   - WebSocket gateway may need load balancing
   - Database indexing on `customerPhone` and `conversationId`
   - Cache frequently accessed conversations

---

## Future Enhancements

1. **Message Status Tracking:** Implement read receipts
2. **Typing Indicators:** Show when staff/customer is typing
3. **File Uploads:** Support document/media sharing
4. **Conversation Templates:** Pre-written responses for common queries
5. **Analytics:** Message volume, response time metrics
6. **Integration:** Link WhatsApp chats to loan applications
7. **Bot Integration:** AI-powered initial response system
