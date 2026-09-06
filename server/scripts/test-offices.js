const { Client } = require('pg');
require('dotenv').config();

async function main() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to DB.');

    // 1. Insert seed offices if not already present
    const existing = await client.query('SELECT count(*) FROM "Office" WHERE "isActive" = true;');
    console.log('Existing offices count:', existing.rows[0].count);

    if (parseInt(existing.rows[0].count, 10) === 0) {
      console.log('Seeding initial office locations...');
      await client.query(`
        INSERT INTO "Office" (name, city, location) VALUES
        ('VidyaLoans Head Office', 'Hyderabad', 'Cyber Towers, HITEC City, Madhapur'),
        ('Bengaluru Operations Hub', 'Bengaluru', 'Indiranagar 100ft Road, Stage 2'),
        ('Mumbai Regional Office', 'Mumbai', 'Bandra Kurla Complex (BKC), Bandra East');
      `);
      console.log('Initial offices seeded.');
    }

    const offices = await client.query('SELECT id, name, city, location, "isActive" FROM "Office" WHERE "isActive" = true;');
    console.log('Offices in database:');
    offices.rows.forEach(o => console.log(` - [${o.id}] ${o.name} | ${o.city} | ${o.location}`));

    await client.end();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
