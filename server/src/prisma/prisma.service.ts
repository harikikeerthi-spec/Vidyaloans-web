import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private pool: Pool;

  constructor() {
    // Prefer DATABASE_URL (port 6543 transaction pooler) to avoid (EMAXCONNSESSION) session pooler cap (15)
    // Fall back to DIRECT_URL only if DATABASE_URL is not configured
    const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL || '';
    
    const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

    const pool = new Pool({
      connectionString,
      ssl: isLocalhost ? false : { rejectUnauthorized: false },
      max: 6, // Keep pool conservative per worker to prevent pooler exhaustion
      idleTimeoutMillis: 10000, // Close idle connections after 10s to release back to Supabase
      connectionTimeoutMillis: 15000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    pool.on('error', (err) => {
      this.logger.warn(`Notice on idle pg pool connection: ${err.message}`);
    });

    const adapter = new PrismaPg(pool);

    super({
      adapter,
      log: ['error', 'warn'],
    });

    this.pool = pool;
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Prisma connected to PostgreSQL database successfully.');
    } catch (err: any) {
      this.logger.warn(`Prisma initial connection delay: ${err.message}. Will retry automatically on next query.`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}

