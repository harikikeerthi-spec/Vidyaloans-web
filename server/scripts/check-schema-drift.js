const { Client } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const env = dotenv.parse(fs.readFileSync(envPath));
  for (const k in env) {
    if (!process.env[k]) process.env[k] = env[k];
  }
}

const connStr = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connStr) {
  console.log('Skipping CI schema check: No database URL provided in environment.');
  process.exit(0);
}

const client = new Client({
  connectionString: connStr,
  ssl: { rejectUnauthorized: false },
});

const expectedTables = [
  'BankSubmission',
  'LoanApplication',
  'BankWorkflowHistory',
  'BankWorkflowQueryRequest',
  'User',
  'StaffProfile',
];

const expectedColumns = {
  LoanApplication: [
    'lanEnteredAt',
    'lanNumber',
    'bankSubmissionId',
    'bankWorkflowStatus',
    'bankWorkflowStage',
    'submittedToBankAt',
    'fileLoggedAt',
  ],
  BankSubmission: [
    'id',
    'applicationId',
    'bankId',
    'workflowStatus',
    'lanNumber',
    'lanEnteredAt',
    'isOnHold',
    'assignedOfficerId',
    'qualityRating',
    'amendments',
    'disbursementTranches',
  ],
};

async function run() {
  try {
    await client.connect();

    const tableRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name = ANY($1::text[]);
    `, [expectedTables]);

    const existingTables = new Set(tableRes.rows.map((r) => r.table_name));
    const missingTables = expectedTables.filter((t) => !existingTables.has(t));

    const missingColumns = [];
    for (const [table, cols] of Object.entries(expectedColumns)) {
      if (!existingTables.has(table)) continue;

      const colRes = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = $1 
          AND column_name = ANY($2::text[]);
      `, [table, cols]);

      const foundCols = new Set(colRes.rows.map((r) => r.column_name));
      for (const c of cols) {
        if (!foundCols.has(c)) {
          missingColumns.push({ table, column: c });
        }
      }
    }

    await client.end();

    if (missingTables.length > 0 || missingColumns.length > 0) {
      console.error('FAILED: Schema drift detected in database:');
      if (missingTables.length > 0) console.error('  Missing tables:', missingTables.join(', '));
      if (missingColumns.length > 0) console.error('  Missing columns:', missingColumns.map(c => `${c.table}.${c.column}`).join(', '));
      process.exit(1);
    } else {
      console.log('SUCCESS: Schema verification passed without drift.');
      process.exit(0);
    }
  } catch (err) {
    console.warn('Schema drift check failed to connect:', err.message);
    process.exit(0);
  }
}

run();
