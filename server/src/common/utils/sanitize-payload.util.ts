import * as crypto from 'crypto';

const SENSITIVE_KEYS = new Set([
  'password',
  'confirmpassword',
  'pass',
  'token',
  'refreshtoken',
  'accesstoken',
  'authorization',
  'auth',
  'otp',
  'secret',
  'apisecret',
  'apikey',
  'cookie',
  'set-cookie',
  'creditcard',
  'cardnumber',
  'cvv',
  'pin',
  'accountnumber',
  'aadhaar',
  'pannumber',
]);

/**
 * Recursively redacts sensitive fields from objects or arrays.
 * Handles circular references, deep nesting, and limits large strings.
 */
export function sanitizePayload(data: any, depth = 0, seen = new WeakSet()): any {
  if (data === null || data === undefined) return data;
  if (depth > 6) return '[Truncated: Max Depth]';

  if (typeof data === 'string') {
    // Truncate excessively long strings (e.g. base64 image data)
    if (data.length > 2000) {
      return data.substring(0, 500) + `... [Truncated ${data.length - 500} chars]`;
    }
    return data;
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (data instanceof Date) return data.toISOString();
  if (Buffer.isBuffer(data)) return '[Binary Buffer]';

  if (seen.has(data)) return '[Circular Reference]';
  seen.add(data);

  if (Array.isArray(data)) {
    return data.slice(0, 50).map((item) => sanitizePayload(item, depth + 1, seen));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, val] of Object.entries(data)) {
    const lowerKey = key.toLowerCase().replace(/[-_]/g, '');
    if (SENSITIVE_KEYS.has(lowerKey)) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = sanitizePayload(val, depth + 1, seen);
    }
  }

  return sanitized;
}

/**
 * Computes a consistent MD5 fingerprint hash to group recurring errors
 * based on error class, message, endpoint, and the top call stack frame.
 */
export function computeFingerprint(params: {
  name: string;
  message: string;
  endpoint?: string;
  stack?: string;
}): string {
  const normalizedName = (params.name || 'Error').trim();
  // Strip dynamic IDs, UUIDs, numbers from message to group similar messages
  const normalizedMsg = (params.message || '')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':uuid')
    .replace(/\b\d+\b/g, ':num')
    .trim()
    .slice(0, 200);

  // Extract the first meaningful stack frame
  let topFrame = '';
  if (params.stack) {
    const lines = params.stack.split('\n').map((l) => l.trim());
    const frame = lines.find((l) => l.startsWith('at ') && !l.includes('node_modules'));
    if (frame) topFrame = frame;
  }

  // Normalize endpoint (replace UUIDs with :id)
  const normalizedEndpoint = (params.endpoint || '')
    .split('?')[0]
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .toLowerCase();

  const raw = `${normalizedName}|${normalizedEndpoint}|${normalizedMsg}|${topFrame}`;
  return crypto.createHash('md5').update(raw).digest('hex');
}
