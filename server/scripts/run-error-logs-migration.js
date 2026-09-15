const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function runMigration() {
    const connStr = process.env.DIRECT_URL || process.env.DATABASE_URL;
    if (!connStr) {
        console.error('Neither DIRECT_URL nor DATABASE_URL found in environment variables.');
        process.exit(1);
    }
    const client = new Client({ connectionString: connStr });
    try {
        await client.connect();
        console.log('Connected to PostgreSQL successfully.');
        const sqlPath = path.join(__dirname, 'create-error-logs-table.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await client.query(sql);
        console.log('ErrorLog table and indexes created successfully!');
        
        // Verify table exists
        const checkRes = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'ErrorLog'
            ORDER BY ordinal_position;
        `);
        console.log('Verified columns in ErrorLog:', checkRes.rows.map(r => `${r.column_name} (${r.data_type})`));
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigration();
