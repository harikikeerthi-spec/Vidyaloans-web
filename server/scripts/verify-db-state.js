const { Client } = require('pg');
require('dotenv').config();

async function main() {
  const connStr = process.env.DIRECT_URL || process.env.DATABASE_URL;
  console.log('Connecting to:', connStr ? connStr.split('@')[1] : 'undefined');

  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';");
    const tableNames = tables.rows.map(r => r.table_name);
    console.log('\n--- Table Checks ---');
    console.log('BankSubmission exists?:', tableNames.includes('BankSubmission'));
    console.log('BankWorkflowHistory exists?:', tableNames.includes('BankWorkflowHistory'));
    console.log('BankWorkflowQueryRequest exists?:', tableNames.includes('BankWorkflowQueryRequest'));

    const columns = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'LoanApplication';");
    const colNames = columns.rows.map(r => r.column_name);
    console.log('\n--- LoanApplication Column Checks ---');
    console.log('LoanApplication columns count:', colNames.length);
    console.log('lanEnteredAt exists?:', colNames.includes('lanEnteredAt'));
    console.log('fileLoggedAt exists?:', colNames.includes('fileLoggedAt'));

    if (tableNames.includes('BankSubmission')) {
      const bsCols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'BankSubmission';");
      console.log('\n--- BankSubmission Columns count ---:', bsCols.rows.length);
      console.log('Sample BankSubmission columns:', bsCols.rows.map(r => r.column_name).slice(0, 10));
    }

    await client.end();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
