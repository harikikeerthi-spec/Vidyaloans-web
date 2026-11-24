const { Client } = require('pg');

async function main() {
  const connStr = 'postgresql://postgres.mhhmqdbzsmwyizmvwtsx:Vidyaloans%400357@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres?connect_timeout=60';
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL');
    
    await client.query(`ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "plainPassword" TEXT;`);
    console.log('ALTER TABLE executed successfully.');

    const verify = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'plainPassword';`);
    console.log('Verified column in public.User:', verify.rows);

    await client.query(`NOTIFY pgrst, 'reload schema';`);
    await client.query(`NOTIFY pgrst, 'reload config';`);
    console.log('Notified PostgREST to reload schema.');

    await client.end();
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

main();
