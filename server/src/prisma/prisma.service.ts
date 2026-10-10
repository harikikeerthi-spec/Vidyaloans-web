import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private pool: Pool;

  constructor() {
    // Prefer DATABASE_URL (port 6543 transaction pooler) to avoid session pooler limits
    const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL || '';
    
    const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

    let hostname: string | undefined;
    try {
      if (connectionString) {
        // Strip jdbc: or postgresql:// for URL parsing if needed
        const url = new URL(connectionString.replace(/^postgresql:\/\//, 'http://'));
        hostname = url.hostname;
      }
    } catch (_) {}

    const pool = new Pool({
      connectionString,
      ssl: isLocalhost
        ? false
        : {
            rejectUnauthorized: false,
            servername: hostname, // Provide TLS SNI to prevent intermediate TLS handshake aborts
          },
      max: 10,
      idleTimeoutMillis: 8000, // Recycle idle sockets before Supabase pooler terminates them remotely
      connectionTimeoutMillis: 20000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    pool.on('error', (err) => {
      const msg = err?.message || String(err);
      if (
        msg.includes('socket disconnected') ||
        msg.includes('TLS connection') ||
        msg.includes('Connection terminated')
      ) {
        this.logger.debug(`Idle pg connection dropped by remote pooler: ${msg}`);
      } else {
        this.logger.warn(`Notice on idle pg pool connection: ${msg}`);
      }
    });

    const adapter = new PrismaPg(pool);

    super({
      adapter: adapter as any,
      log: ['error', 'warn'],
    });

    this.pool = pool;
  }

  /**
   * Executes a database query with automatic retry for transient TLS or network socket drops.
   */
  async withRetry<T>(operation: () => Promise<T>, retries = 2, delayMs = 500): Promise<T> {
    try {
      return await operation();
    } catch (err: any) {
      const msg = err?.message || String(err || '');
      const isTransient =
        msg.includes('socket disconnected') ||
        msg.includes('TLS connection') ||
        msg.includes('Connection terminated') ||
        msg.includes('closed network connection') ||
        msg.includes('connection timeout') ||
        msg.includes("Can't reach database");

      if (retries > 0 && isTransient) {
        this.logger.warn(`[PrismaService] Transient connection interruption detected (${msg}). Retrying in ${delayMs}ms...`);
        await new Promise((res) => setTimeout(res, delayMs));
        return this.withRetry(operation, retries - 1, delayMs * 1.5);
      }
      throw err;
    }
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
