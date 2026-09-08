import 'dotenv/config';
import * as dns from 'dns';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {
  // ignore if unsupported
}

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import { doubleCsrfProtection } from './auth/csrf.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');

  // Cookie parser required for Double Cookie Submit CSRF protection
  app.use(cookieParser());

  // Enhanced CORS configuration supporting credentials and custom headers
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'x-csrf-token', 'x-selected-bank'],
  });

  // ✅ CRITICAL: Twilio sends webhooks as application/x-www-form-urlencoded
  // Without this, body.From and body.Body will always be undefined
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(express.json({ limit: '10mb' }));

  // CSRF Double Cookie Submit Protection
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    const url = (req.originalUrl || req.url).toLowerCase();
    // Exempt safe methods, public auth login/verification endpoints, and external third-party webhooks/callbacks
    if (
      ['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase()) ||
      url.includes('/webhook') ||
      url.includes('/integration/whatsapp') ||
      url.includes('/csrf-token') ||
      url.includes('/auth/csrf-token') ||
      url.includes('/documents/upload') ||
      url.includes('/documents/complete-upload') ||
      url.includes('/auth/upload-document') ||
      url.includes('/upload-statement') ||
      url.includes('/auth/send-otp') ||
      url.includes('/auth/verify-otp') ||
      url.includes('/auth/request-otp') ||
      url.includes('/auth/firebase') ||
      url.includes('/auth/landing-page-submit') ||
      url.includes('/auth/refresh') ||
      url.includes('/auth/login') ||
      url.includes('/digilocker/callback') ||
      url.includes('/ai-search') ||
      url.includes('/ai/') ||
      url.includes('/reference/') ||
      url.includes('/explore/') ||
      url.includes('/mail/') ||
      url.includes('/support/send') ||
      url.includes('/send')
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

  // Serve uploaded files (disk fallback when S3 is unavailable)
  app.use('/uploads', express.static(join(__dirname, '..', '..', 'uploads')));
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));
  
  const port = process.env.PORT || 5000;
  await app.listen(port, '0.0.0.0');
  
  console.log(`Server running on port ${port}`);
  console.log(`Android Emulator: http://10.0.2.2:${port}`);
  console.log(`WhatsApp Webhook URL: http://localhost:${port}/api/webhook/whatsapp`);
  console.log(`WhatsApp Webhook URL (alt): http://localhost:${port}/api/whatsapp`);
}
bootstrap();
