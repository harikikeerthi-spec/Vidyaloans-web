import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

const SENSITIVE_KEYS = [
  'documentopenpassword',
  'password',
  'pwd',
  'secret',
  'pin',
  'cvv',
  'otp',
  'atm_pin',
  'upi_pin',
];

/**
 * Deeply scrubs sensitive password fields from an object for logging purposes
 */
export function sanitizeForLogs(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeForLogs);
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const kLower = key.toLowerCase();
    if (SENSITIVE_KEYS.some((s) => kLower.includes(s))) {
      sanitized[key] = '[REDACTED_EPHEMERAL_SECRET]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLogs(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

@Injectable()
export class PasswordRedactionInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PasswordRedactionInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();

    if (req.body && typeof req.body === 'object') {
      // Redact in-place for any downstream logging middleware
      req.sanitizedBody = sanitizeForLogs(req.body);
    }

    return next.handle().pipe(
      tap((data) => {
        // Ensure no accidentally returned password exists in output
        if (data && typeof data === 'object') {
          for (const key of Object.keys(data)) {
            const kLower = key.toLowerCase();
            if (SENSITIVE_KEYS.some((s) => kLower.includes(s))) {
              delete data[key];
            }
          }
        }
      }),
      catchError((err) => {
        // Sanitize error message to ensure no password string was reflected
        if (err && err.message) {
          for (const s of SENSITIVE_KEYS) {
            if (err.message.toLowerCase().includes(s)) {
              err.message = 'A processing error occurred during document unlock';
              break;
            }
          }
        }
        throw err;
      }),
    );
  }
}
