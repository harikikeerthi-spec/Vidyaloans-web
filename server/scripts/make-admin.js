const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] || 'vamsiraj168@gmail.com';
  console.log(`Checking user: ${email}...`);

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log(`❌ User with email "${email}" not found.`);
      return;
    }

    const updated = await prisma.user.update({
      where: { email },
      data: { role: 'admin' },
    });

    console.log(`✅ Success! User ${updated.email} is now: ${updated.role}`);
  } catch (err) {
    console.error('❌ Error updating user role:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
