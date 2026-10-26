import 'dotenv/config';
import * as dns from 'dns';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {
  // ignore if unsupported
}

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import cookieParser from 'cookie-parser';
import { doubleCsrfProtection } from './auth/csrf.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');

  // Support direct calls to /blogs, /blogs/* without /api prefix
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.url === '/blogs' || req.url.startsWith('/blogs/') || req.url.startsWith('/blogs?')) {
      req.url = `/api${req.url}`;
    }
    next();
  });

  // Cookie parser required for Double Cookie Submit CSRF protection
  app.use(cookieParser());

  // Global ValidationPipe to whitelist and sanitize incoming payloads
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Hardened CORS whitelist for production and development
  const allowedOrigins = [
    'https://vidyaloans.in',
    'https://www.vidyaloans.in',
    'https://appv1.vidyaloans.in',
    'http://vidyaloans.in',
    'http://appv1.vidyaloans.in',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:5000',
  ];
  if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL);
  }

  app.enableCors({
    origin: (origin, callback) => {
      // Allow non-browser requests (mobile apps, backend services) without Origin header
      if (!origin) return callback(null, true);
      const isAllowed =
        allowedOrigins.includes(origin) ||
        origin.endsWith('.vidyaloans.in') ||
        origin === 'https://vidyaloans.in';
      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for unauthorized origin: ${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'x-csrf-token', 'x-selected-bank', 'x-portal'],
  });

  // Webhook body parsers (supports urlencoded, json, and text/plain for AWS SNS webhooks)
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(express.json({ limit: '10mb', type: ['application/json', 'text/plain'] }));

  // Strict CSRF Double Cookie Submit Protection
  const CSRF_EXEMPT_EXACT_ROUTES = new Set([
    '/api/csrf-token',
    '/api/auth/csrf-token',
    '/api/documents/upload',
    '/api/documents/complete-upload',
    '/api/auth/upload-document',
    '/api/statements/upload',
    '/api/upload-statement',
    '/api/auth/send-otp',
    '/api/auth/verify-otp',
    '/api/auth/request-otp',
    '/api/auth/check-bank-officer',
    '/api/auth/firebase',
    '/api/auth/landing-page-submit',
    '/api/auth/create-application',
    '/api/auth/refresh',
    '/api/auth/login',
    '/api/auth/logout',
    '/api/digilocker/callback',
    '/api/blogs/inquiry',
    '/api/university-inquiry',
    '/api/support/send',
    '/api/ai-search',
    '/api/webmail',
    '/csrf-token',
    '/auth/csrf-token',
    '/documents/upload',
    '/documents/complete-upload',
    '/auth/upload-document',
    '/statements/upload',
    '/upload-statement',
    '/auth/send-otp',
    '/auth/verify-otp',
    '/auth/request-otp',
    '/auth/check-bank-officer',
    '/auth/firebase',
    '/auth/landing-page-submit',
    '/auth/create-application',
    '/auth/refresh',
    '/auth/login',
    '/auth/logout',
    '/digilocker/callback',
    '/blogs/inquiry',
    '/university-inquiry',
    '/support/send',
    '/ai-search',
    '/webmail',
  ]);

  const CSRF_EXEMPT_PREFIXES = [
    '/api/webhook',
    '/webhook',
    '/api/whatsapp',
    '/whatsapp',
    '/api/sns',
    '/sns',
    '/api/integration/whatsapp',
    '/integration/whatsapp',
    '/api/statements/',
    '/statements/',
    '/api/ai/',
    '/ai/',
    '/api/reference/',
    '/reference/',
    '/api/explore/',
    '/explore/',
    '/api/mail/',
    '/mail/',
    '/api/webmail/',
    '/webmail/',
  ];

  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Exempt safe idempotent HTTP methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase())) {
      return next();
    }

    // Exempt requests with Bearer tokens (immune to browser CSRF attacks)
    if (req.headers['authorization']?.startsWith('Bearer ')) {
      return next();
    }

    // Strip query parameters for clean path comparison
    const cleanPath = (req.originalUrl || req.url).split('?')[0].toLowerCase();

    if (
      CSRF_EXEMPT_EXACT_ROUTES.has(cleanPath) ||
      CSRF_EXEMPT_PREFIXES.some((prefix) => cleanPath.startsWith(prefix))
    ) {
      return next();
    }

    doubleCsrfProtection(req, res, (err: any) => {
      if (err) {
        return res.status(403).json({
          statusCode: 403,
          error: 'Forbidden',
          message: err.message || 'CSRF Token Validation Failed: Missing or invalid X-CSRF-Token header',
        });
      }
      next();
    });
  });

  const port = process.env.PORT || 5000;
  await app.listen(port, '0.0.0.0');
  
  console.log(`Server running on port ${port}`);
  console.log(`Android Emulator: http://10.0.2.2:${port}`);
  console.log(`WhatsApp Webhook URL: http://localhost:${port}/api/webhook/whatsapp`);
  console.log(`WhatsApp Webhook URL (alt): http://localhost:${port}/api/whatsapp`);
}
bootstrap();
