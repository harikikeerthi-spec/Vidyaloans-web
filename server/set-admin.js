const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DIRECT_URL || process.env.DATABASE_URL,
        },
    },
});

async function setAdmin() {
    const email = process.argv[2]?.trim().toLowerCase();
    const role = (process.argv[3] || 'admin').trim().toLowerCase();

    if (!email) {
        console.log('\n========================================');
        console.log('   VidyaLoans Admin Role Assignment');
        console.log('========================================');
        console.log('Usage:');
        console.log('  node set-admin.js <email> [role]');
        console.log('\nExamples:');
        console.log('  node set-admin.js admin@vidyaloans.in');
        console.log('  node set-admin.js admin@vidyaloans.in super_admin');
        console.log('========================================\n');
        process.exit(1);
    }

    try {
        let user = await prisma.user.findFirst({
            where: { email: { equals: email, mode: 'insensitive' } }
        });

        if (!user) {
            console.log(`User "${email}" not found in database. Creating account...`);
            user = await prisma.user.create({
                data: {
                    email,
                    role,
                    firstName: 'Admin',
                    lastName: 'User',
                    mobile: '',
                    password: '',
                    canAccessSupport: true,
                }
            });
            console.log(`Created new account: ${user.email} (ID: ${user.id}) with role: "${user.role}"`);
        } else {
            console.log(`Found existing user: ${user.email} (Current Role: "${user.role}")`);
            const updated = await prisma.user.update({
                where: { id: user.id },
                data: { 
                    role,
                    canAccessSupport: true,
                },
            });
            console.log(`Successfully updated ${updated.email} to role: "${updated.role}"`);
        }

        // Also ensure an AdminProfile record exists for full dashboard access
        try {
            const existingProfile = await prisma.adminProfile.findUnique({
                where: { userId: user.id },
            });
            if (!existingProfile) {
                await prisma.adminProfile.create({
                    data: {
                        userId: user.id,
                        adminTitle: role === 'super_admin' ? 'Super Administrator' : 'Administrator',
                        department: 'Management',
                        canApproveBlogs: true,
                        canManageUsers: true,
                    },
                });
                console.log(`Initialized AdminProfile for ${user.email}`);
            }
        } catch (profileErr) {
            // Non-critical if AdminProfile already exists or has constraint
            console.log(`AdminProfile notice:`, profileErr.message);
        }

        console.log(`\nDone! You can now log into the Admin portal:`);
        console.log(`URL:   /admin/login`);
        console.log(`Email: ${email}\n`);
    } catch (err) {
        console.error('Error setting admin role:', err);
    } finally {
        await prisma.$disconnect();
    }
}

setAdmin();

