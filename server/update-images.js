const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log('Updating blog images...');

    // Using reliable picsum or specific unsplash source images
    const updates = [
        {
            slug: 'top-5-cs-universities-2026',
            image: '/images/university-default.jpg', // University
        },
        {
            slug: 'how-to-write-winning-sop',
            image: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80', // Writing
        },
        {
            slug: 'education-loans-fixed-vs-floating-rates', // Checking if slug matches exactly or if it was truncated
            // The seed had 'education-loans-fixed-vs-floating' (no 'rates')
            altSlug: 'education-loans-fixed-vs-floating',
            image: 'https://images.unsplash.com/photo-1554224155-9736d53d1d84?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80', // Finance
        },
    ];

    /* 
       If the above Unsplash links were the issue, we can switch to Picsum:
       1. https://picsum.photos/id/20/800/600 (Student/Notebook)
       2. https://picsum.photos/id/24/800/600 (Book)
       3. https://picsum.photos/id/160/800/600 (Phone/Finance)
    */

    // Let's try to update with the original ones but slightly cleaner params first, 
    // IF that fails, we can run again with Picsum.
    // Actually, user said 2 are blank. 
    // Let's us Picsum for reliability or make sure the URL is valid.

    // I'll use Picsum to be SAFE and ensure they load. Unsplash hotlinking can be flaky.

    const reliableImages = {
        'top-5-cs-universities-2026': 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80', // Valid university
        'how-to-write-winning-sop': 'https://images.unsplash.com/photo-1517842645767-c639042777db?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80', // Notes/writing
        'education-loans-fixed-vs-floating': 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80' // Money
    };

    for (const [slug, imageUrl] of Object.entries(reliableImages)) {
        try {
            await prisma.blog.update({
                where: { slug: slug },
                data: { featuredImage: imageUrl }
            });
            console.log(`Updated image for ${slug}`);
        } catch (e) {
            console.log(`Could not update ${slug}: ${e.message}`);
        }
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
