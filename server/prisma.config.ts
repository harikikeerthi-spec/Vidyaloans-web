import 'dotenv/config';
import path from 'path';
import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

// Load .env explicitly from the server directory
dotenv.config({ path: path.resolve(__dirname, '.env') });

const rawUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || '';
const finalUrl = rawUrl.includes(':6543') && !rawUrl.includes('pgbouncer=true')
  ? (rawUrl.includes('?') ? `${rawUrl}&pgbouncer=true` : `${rawUrl}?pgbouncer=true`)
  : rawUrl;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: finalUrl,
  },
});
