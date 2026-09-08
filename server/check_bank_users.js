const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const fs = require('fs');
const dotenv = require('dotenv');

const envConfig = dotenv.parse(fs.readFileSync('c:/Projects/Sun Glade/Loan/server/.env'));
const connectionString = envConfig.DIRECT_URL || envConfig.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function check() {
  await prisma.user.update({
    where: { id: 'VL-BNK-346' },
    data: { bank: 'auxilo' }
  });
  console.log('Updated VL-BNK-346 to auxilo');

  const bankUsers = await prisma.user.findMany({
    where: { role: 'bank' },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, bank: true }
  });
  console.log('Bank users in DB:', JSON.stringify(bankUsers, null, 2));
}

check().then(async () => {
  await prisma.$disconnect();
  await pool.end();
}).catch(console.error);
