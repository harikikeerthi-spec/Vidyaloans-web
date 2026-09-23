# Vidya Loans: Secure Bank Statement Processing & EVV Integration

## 1. Architecture Overview

The Secure Statement Processing Module provides enterprise-grade, zero-persistence ingestion of password-protected bank statements, coordinate-aligned tabular transaction extraction, OCR fallback for scanned PDFs, mathematical daily closing balance reconstruction, and authoritative handoff to the 6-component Eligibility Verification Vector (EVV) engine.

```
                           +----------------------------------------+
                           |  Frontend: SecureStatementUploadFlow   |
                           +-------------------+--------------------+
                                               |
                                     1. Ephemeral Upload
                                               v
                          +------------------------------------------+
                          |   POST /api/statements/upload            |
                          |   - AES-256-GCM Encryption-at-Rest      |
                          |   - SHA-256 Hash Invariant Calculation   |
                          |   - PDF.js Protection Detection          |
                          +--------------------+---------------------+
                                               |
                          +--------------------+---------------------+
                          | If Protected: Prompt Document Password   |
                          | - Explicit Anti-Credential Warnings     |
                          | - Masked Account: "•••• •••• 1234"      |
                          | - Max 5 Attempts Rate Limit / 30m Lock   |
                          +--------------------+---------------------+
                                               |
                                     2. Unlock & Extract
                                               v
                          +------------------------------------------+
                          |   POST /api/statements/:id/unlock        |
                          |   - Isolated Worker Decryption           |
                          |   - Memory Overwrite in finally {}       |
                          |   - Zero Disk/DB/Log Password Leakage    |
                          |   - Coordinate Table Extraction          |
                          +--------------------+---------------------+
                                               |
                                     3. Confirm Columns
                                               v
                          +------------------------------------------+
                          |   POST /api/statements/:id/confirm-cols  |
                          |   - Date, Narration, Debit, Credit, Bal  |
                          |   - Mathematical Reconciliation Check    |
                          +--------------------+---------------------+
                                               |
                                     4. Daily Balance Timeline
                                               v
                          +------------------------------------------+
                          |   POST /api/statements/:id/daily-balance |
                          |   - 100% Calendar Days Timeline (6 mos)  |
                          |   - Mathematical Invariant Verified      |
                          +--------------------+---------------------+
                                               |
                                     5. Authoritative EVV
                                               v
                          +------------------------------------------+
                          |   POST /api/statements/:id/run-evv       |
                          |   - Fixed Sampling [1, 5, 10, 15, 20, 25]|
                          |   - Component 1: Average Balance Trend   |
                          |   - Component 2: Min-Balance Safety      |
                          |   - Component 3: Bounce-Free Record      |
                          |   - Component 4: Verified Inflow         |
                          |   - Component 5: Cash-Deposit Ratio      |
                          |   - Component 6: Withdrawal Discipline   |
                          +--------------------+---------------------+
                                               |
                                     6. Immediate Purge
                                               v
                          +------------------------------------------+
                          |   Temp Artifacts Wiped & Overwritten     |
                          +------------------------------------------+
```

---

## 2. Strict Security Constraints & Zero-Persistence Rules

### 2.1 Password Protection Guarantees
1. **Document-Open Password Only:**
   - Under no circumstances will the system request, accept, or process net-banking credentials, OTP, ATM PIN, UPI PIN, or CVV.
   - User consent is cryptographically recorded as an audit event without the secret.
2. **Never Persist Secrets:**
   - The document password is **NEVER** written to PostgreSQL, Redis, session storage, browser localStorage, cookies, error dumps, Sentry logs, or queues.
3. **In-Memory Volatile Processing:**
   - Node.js buffers and variables containing the password are scrubbed immediately in `finally` blocks:
     ```ts
     finally {
       if (passwordBuffer) passwordBuffer.fill(0);
       documentOpenPassword = undefined;
     }
     ```
4. **Log & Exception Redaction:**
   - The global `PasswordRedactionInterceptor` intercepts all inbound/outbound payloads and masks any keys containing `password`, `pwd`, `passcode`, `secret`, `pin`, `cvv`, or `token`.

---

## 3. Rate Limiting & Cooldown Protection

To prevent brute-force attacks against customer document passwords:
- **Maximum Attempts:** 5 failed unlock attempts per statement.
- **Lockout Duration:** 30 minutes cooldown upon reaching 5 consecutive failures.
- **Client Status:** Returns HTTP 403 Forbidden with exact countdown remaining.

---

## 4. Ephemeral Artifact Lifecycle (15-Minute TTL)

- Any temporary files generated during OCR rendering (e.g., intermediate canvas images or page PNGs) are tagged with a 15-minute Time-To-Live (TTL).
- **Active Cleanup:** Called immediately upon completion of extraction and daily closing-balance persistence (`purgeArtifactsForStatement`).
- **Passive Cleanup:** Background cron job running every 5 minutes (`@Cron('*/5 * * * *')`) sweeps and unlinks expired files from `uploads/statements/ephemeral/`.

---

## 5. Environment Variables & Key Configuration

Configure the following variables in `server/.env`:

```env
# 32-byte AES-256-GCM Statement Vault Key (64-character hexadecimal or 32+ character passphrase)
STATEMENT_ENCRYPTION_KEY=c3f1b4029d581a7031405b63e8a4a35041793739fa4219b13fa2bfebbc6d5c19

# Maximum allowable PDF unlock attempts before imposing cooldown (Default: 5)
STATEMENT_MAX_UNLOCK_ATTEMPTS=5

# Cooldown duration in minutes after failed attempts (Default: 30)
STATEMENT_COOLDOWN_MINUTES=30

# Ephemeral artifact max TTL in minutes (Default: 15)
STATEMENT_TEMP_ARTIFACT_TTL_MINUTES=15
```

### 5.1 Key Generation
To generate a secure 256-bit encryption key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 6. Authoritative EVV Integration

The system adheres strictly to the six core underwriting components:
1. **Average Balance Trend** (Max 25 pts)
2. **Minimum-Balance Safety** (Max 20 pts)
3. **Bounce-Free Record** (Max 20 pts)
4. **Verified Financial Inflow Regularity** (Max 15 pts, or N/A for non-income contributor)
5. **Cash-Deposit Ratio** (Max 10 pts)
6. **Withdrawal Discipline** (Max 10 pts)

- **Default Sampling Dates:** `[1, 5, 10, 15, 20, 25]` repeated in every completed calendar month over the 6-month evaluation window.
- **Custom Dates:** Permitted only with mandatory manager sign-off, recorded reason, and an immutable audit entry while preserving the standard fixed-date calculation.

---

## 7. Verification & Testing

Unit tests for encryption, ephemeral password safety, attempt limits, and artifact cleanup are executed via:
```bash
npm run test src/statement-processing/__tests__/statement-processing.spec.ts
```
Expected output:
```
PASS src/statement-processing/__tests__/statement-processing.spec.ts
  Secure Statement Processing Module
    EncryptionStorageService
      √ should encrypt and decrypt a buffer with AES-256-GCM successfully
      √ should fail decryption if ciphertext or payload is corrupted
      √ should deterministically calculate SHA-256 hash
      √ should securely mask account numbers preserving only the last 4 digits
    Ephemeral Password & Rate Limiting Enforcement
      √ should enforce failed attempt limit and impose cooldown when locked
      √ should reject requests without explicit user consent
    Zero-Persistence Memory Safety
      √ should erase password strings immediately using buffer overwrite
    TempArtifactService Lifecycle
      √ should track and purge ephemeral artifacts after extraction
```
