const { Client } = require('pg');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function computeFingerprint(name, message, endpoint) {
    const raw = `${name}|${endpoint}|${message}|topFrame`;
    return crypto.createHash('md5').update(raw).digest('hex');
}

async function testErrorLogFlow() {
    const connStr = process.env.DIRECT_URL || process.env.DATABASE_URL;
    const client = new Client({ connectionString: connStr });

    try {
        await client.connect();
        console.log('--- 1. Testing ErrorLog Table Insertion ---');
        const fp = computeFingerprint('TestDatabaseException', 'Connection timeout while querying LoanApplication', '/api/applications');

        // Insert initial test error
        const insertRes = await client.query(`
            INSERT INTO "ErrorLog" (
                "fingerprint", "level", "name", "message", "statusCode", 
                "endpoint", "method", "stack", "source", "context", 
                "metadata", "userId", "userEmail", "userRole", "occurrences"
            ) VALUES (
                $1, 'CRITICAL', 'TestDatabaseException', 'Connection timeout while querying LoanApplication', 500,
                '/api/applications', 'POST', 'Error: Connection timeout\n    at LoanApplicationService.create (/server/src/application/application.service.ts:42:15)', 'backend', 'TestVerification',
                '{"timeoutMs": 5000, "query": "SELECT * FROM LoanApplication"}'::jsonb, 'test-user-id', 'test.student@example.com', 'student', 1
            ) RETURNING id, fingerprint, occurrences, "isResolved";
        `, [fp]);

        const logId = insertRes.rows[0].id;
        console.log('Inserted ErrorLog record ID:', logId);

        console.log('--- 2. Testing Deduplication (Simulate 2nd occurrence) ---');
        const updateRes = await client.query(`
            UPDATE "ErrorLog" 
            SET "occurrences" = "occurrences" + 1, "lastSeenAt" = NOW()
            WHERE "id" = $1
            RETURNING occurrences, "lastSeenAt";
        `, [logId]);
        console.log('Updated occurrences count:', updateRes.rows[0].occurrences);

        console.log('--- 3. Testing Resolution Workflow ---');
        const resolveRes = await client.query(`
            UPDATE "ErrorLog"
            SET "isResolved" = true, "resolvedAt" = NOW(), "resolvedBy" = 'admin@example.com', "resolutionNote" = 'Verified fix in DB pool config'
            WHERE "id" = $1
            RETURNING "isResolved", "resolvedBy", "resolutionNote";
        `, [logId]);
        console.log('Resolution updated:', resolveRes.rows[0]);

        console.log('--- 4. Clean up Test Record ---');
        await client.query('DELETE FROM "ErrorLog" WHERE "id" = $1', [logId]);
        console.log('Test record cleaned up successfully!');
        console.log('\nAll ErrorLog database tests PASSED successfully!');
    } catch (err) {
        console.error('Test failed:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

testErrorLogFlow();
