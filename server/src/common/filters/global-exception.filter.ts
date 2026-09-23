import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorLogService } from '../../error-log/error-log.service';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly errorLogService: ErrorLogService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (!response || typeof response.status !== 'function') {
      // Non-HTTP context (e.g., WebSocket or microservice)
      this.logger.error('Unhandled non-HTTP exception:', exception);
      return;
    }

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorName = 'InternalServerError';
    let stack: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const anyRes = res as any;
        const rawMsg = anyRes.message || exception.message;
        message = Array.isArray(rawMsg)
          ? rawMsg.join(', ')
          : (typeof rawMsg === 'object' ? JSON.stringify(rawMsg) : String(rawMsg));
        errorName = anyRes.error || exception.name;
      }
      stack = exception.stack;
    } else if (exception instanceof Error) {
      message = exception.message || 'Unexpected server error';
      errorName = exception.name || 'Error';
      stack = exception.stack;
    } else if (typeof exception === 'object' && exception !== null) {
      const anyEx = exception as any;
      const rawMsg = anyEx.message || anyEx.details || anyEx.error;
      message = typeof rawMsg === 'object' ? JSON.stringify(rawMsg) : (rawMsg ? String(rawMsg) : JSON.stringify(exception));
      errorName = anyEx.code || anyEx.name || 'Error';
      stack = anyEx.stack;
    } else {
      message = String(exception);
    }

    const url = request.originalUrl || request.url || '';
    const method = request.method || 'GET';
    const clientIp = request.headers['x-forwarded-for'] || request.socket?.remoteAddress;
    const userAgent = request.headers['user-agent'] as string | undefined;

    // Retrieve user from request if authenticated
    const reqUser = (request as any).user;
    const userId = reqUser?.id || reqUser?.sub;
    const userEmail = reqUser?.email;
    const userRole = reqUser?.role;

    // Filter out noisy 404s for common assets/favicons
    const isNoisyAsset =
      status === 404 &&
      (url.includes('favicon.ico') ||
        url.includes('.png') ||
        url.includes('.jpg') ||
        url.includes('.map') ||
        url.includes('.well-known'));

    if (!isNoisyAsset) {
      // Asynchronously record error to database without delaying response
      this.errorLogService
        .captureError({
          name: errorName,
          message,
          statusCode: status,
          endpoint: url,
          method,
          stack,
          source: 'backend',
          context: 'GlobalExceptionFilter',
          metadata: {
            clientIp,
            userAgent,
            query: request.query,
            params: request.params,
            body: request.body,
          },
          userId,
          userEmail,
          userRole,
        })
        .catch((err) => {
          this.logger.error(`Failed to capture error asynchronously: ${err.message}`);
        });
    }

    // Log to console for dev debugging
    if (status >= 500) {
      this.logger.error(
        `[${method}] ${url} - Status ${status} - ${message}`,
        stack,
      );
    } else if (status >= 400 && !isNoisyAsset) {
      this.logger.warn(`[${method}] ${url} - Status ${status} - ${message}`);
    }

    // Return clean JSON response
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: url,
      message,
      error: errorName,
    });
  }
}
