import { Client } from 'pg';
import { Logger } from '@nestjs/common';

const logger = new Logger('SchemaDriftCheck');

export interface SchemaCheckResult {
  hasDrift: boolean;
  missingTables: string[];
  missingColumns: { table: string; column: string }[];
}

export async function checkSchemaDrift(): Promise<SchemaCheckResult> {
  const connStr = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connStr) {
    logger.warn('Skipping schema drift check: No DIRECT_URL or DATABASE_URL provided');
    return { hasDrift: false, missingTables: [], missingColumns: [] };
  }

  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });

  const expectedTables = [
    'BankSubmission',
    'LoanApplication',
    'BankWorkflowHistory',
    'BankWorkflowQueryRequest',
    'User',
    'StaffProfile',
  ];

  const expectedColumns: Record<string, string[]> = {
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

  const missingTables: string[] = [];
  const missingColumns: { table: string; column: string }[] = [];

  try {
    await client.connect();

    // 1. Check tables
    const tableRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name = ANY($1::text[]);
    `, [expectedTables]);

    const existingTables = new Set(tableRes.rows.map((r: any) => r.table_name));
    for (const t of expectedTables) {
      if (!existingTables.has(t)) {
        missingTables.push(t);
      }
    }

    // 2. Check columns for existing tables
    for (const [table, cols] of Object.entries(expectedColumns)) {
      if (!existingTables.has(table)) continue;

      const colRes = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = $1 
          AND column_name = ANY($2::text[]);
      `, [table, cols]);

      const foundCols = new Set(colRes.rows.map((r: any) => r.column_name));
      for (const c of cols) {
        if (!foundCols.has(c)) {
          missingColumns.push({ table, column: c });
        }
      }
    }

    await client.end();
  } catch (err: any) {
    logger.warn(`Schema drift check encountered network/connection issue: ${err.message}`);
    return { hasDrift: false, missingTables: [], missingColumns: [] };
  }

  const hasDrift = missingTables.length > 0 || missingColumns.length > 0;

  if (hasDrift) {
    logger.error('================================================================');
    logger.error('CRITICAL WARNING: DATABASE SCHEMA DRIFT DETECTED AT STARTUP!');
    if (missingTables.length > 0) {
      logger.error(`Missing Tables: ${missingTables.join(', ')}`);
    }
    if (missingColumns.length > 0) {
      logger.error(
        `Missing Columns: ${missingColumns.map((c) => `${c.table}.${c.column}`).join(', ')}`,
      );
    }
    logger.error('Run "node scripts/apply-missing-migrations.js" to resolve schema drift.');
    logger.error('================================================================');
  } else {
    logger.log('✓ Database schema drift check passed: All critical tables and columns present.');
  }

  return { hasDrift, missingTables, missingColumns };
}
