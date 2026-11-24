const { Client } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../.env');
const env = dotenv.parse(fs.readFileSync(envPath));
const connStr = env.DIRECT_URL || env.DATABASE_URL;
const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });

async function check() {
  try {
    await client.connect();
    console.log('Connected to PostgreSQL database successfully.');

    // 1. Check BankSubmission table
    const tblRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('BankSubmission', 'LoanApplication', 'BankWorkflowHistory', 'BankWorkflowQuery');
    `);
    console.log('Found tables:', tblRes.rows.map(r => r.table_name));

    // 2. Check LoanApplication columns
    const colRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'LoanApplication';
    `);
    const cols = colRes.rows.map(r => r.column_name);
    console.log('Total LoanApplication columns:', cols.length);
    console.log('lanEnteredAt exists?', cols.includes('lanEnteredAt'));
    console.log('lanNumber exists?', cols.includes('lanNumber'));
    console.log('bankSubmissionId exists?', cols.includes('bankSubmissionId'));
    console.log('bankWorkflowStatus exists?', cols.includes('bankWorkflowStatus'));
    console.log('bankWorkflowStage exists?', cols.includes('bankWorkflowStage'));
    console.log('submittedToBankAt exists?', cols.includes('submittedToBankAt'));

    if (tblRes.rows.map(r => r.table_name).includes('BankSubmission')) {
      const bsCols = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'BankSubmission';
      `);
      console.log('BankSubmission columns:', bsCols.rows.map(r => r.column_name));
    }

    await client.end();
  } catch (err) {
    console.error('Check failed:', err);
    process.exit(1);
  }
}

check();
