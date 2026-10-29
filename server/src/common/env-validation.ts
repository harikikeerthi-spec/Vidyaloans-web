/**
 * Environment variable validation for security-critical secrets.
 *
 * In production (NODE_ENV === 'production') the server refuses to start
 * if any required secret is missing or set to a known insecure default.
 *
 * In development a loud warning is printed but startup continues.
 */

const REQUIRED_SECRETS = [
  'JWT_SECRET',
  'CSRF_SECRET',
  'STATEMENT_ENCRYPTION_KEY',
] as const;

export const INSECURE_DEFAULTS = new Set([
  'secretKey',
  'your-secret-key',
  'vidyaloans_secure_csrf_secret_key_change_in_prod_2026',
  'vidya_loans_statement_secure_vault_key_2026_aes256',
  'vidyaloans_jwt_secret_key_2026',
  'dev-secret-key-change-this-in-production-2024',
]);

export function validateRequiredSecrets(): void {
  const missing: string[] = [];
  const insecure: string[] = [];

  for (const key of REQUIRED_SECRETS) {
    const value = process.env[key];
    if (!value || value.trim() === '') {
      missing.push(`  - ${key} (not set)`);
    } else if (INSECURE_DEFAULTS.has(value)) {
      insecure.push(`  - ${key} (using insecure default)`);
    }
  }

  // If any required secret is missing, server cannot start in any environment
  if (missing.length > 0) {
    const missingMessage = [
      '',
      '🚨  FATAL: Server cannot start because required security secrets are missing:',
      ...missing,
      '',
      'Generate secure values with:  openssl rand -base64 48',
      'Then add them to your .env file or environment.',
      '',
    ].join('\n');
    throw new Error(missingMessage);
  }

  // If using insecure defaults
  if (insecure.length > 0) {
    const insecureMessage = [
      '',
      '⚠️  SECURITY WARNING: The following secrets are using insecure defaults:',
      ...insecure,
      '',
      'Generate secure values with:  openssl rand -base64 48',
      'Then set them in your .env file or environment.',
      '',
    ].join('\n');

    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        `\n🚨  FATAL: Server cannot start in production with insecure secrets.\n${insecureMessage}`,
      );
    }

    console.warn(insecureMessage);
    console.warn('In production, the server will refuse to start.\n');
  }
}
