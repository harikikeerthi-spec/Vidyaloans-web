/**
 * Sanitizes raw database / PostgREST error messages so that internal implementation details,
 * SQL fragments, table names, and PostgREST protocol codes are never exposed to clients.
 */
export function sanitizeErrorMessage(rawMessage: any): string {
  if (!rawMessage) {
    return 'An unexpected error occurred. Please try again.';
  }

  const str = typeof rawMessage === 'string' ? rawMessage : (rawMessage.message || JSON.stringify(rawMessage));

  // 1. Missing table / relation error (PostgreSQL 42P01)
  if (/relation\s+["'].*?["']\s+does not exist/i.test(str) || /42P01/i.test(str)) {
    return 'The requested banking service is undergoing schema synchronization. Please retry in a moment.';
  }

  // 2. Missing column error (PostgreSQL 42703)
  if (/column\s+["'].*?["']\s+does not exist/i.test(str) || /42703/i.test(str)) {
    return 'A required application data field is currently synchronizing. Please try again shortly.';
  }

  // 3. PostgREST schema cache reload in progress
  if (/schema cache/i.test(str) || /PGRST/i.test(str)) {
    return 'The database schema cache is currently refreshing. Please retry your request in a few moments.';
  }

  // 4. Duplicate key / unique constraint violation (PostgreSQL 23505)
  if (/duplicate key value/i.test(str) || /23505/i.test(str) || /unique constraint/i.test(str)) {
    return 'A record with these details already exists. Please verify your input and try again.';
  }

  // 5. Foreign key violation (PostgreSQL 23503)
  if (/foreign key constraint/i.test(str) || /23503/i.test(str)) {
    return 'The referenced record does not exist or has been removed.';
  }

  // 6. SQL syntax errors or invalid input syntax
  if (/syntax error at or near/i.test(str) || /invalid input syntax/i.test(str)) {
    return 'Invalid data format submitted. Please check the values and try again.';
  }

  // 7. Connection timeouts / network disconnects
  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|Connection terminated/i.test(str)) {
    return 'Unable to establish a secure database connection. Please try again in a few moments.';
  }

  return str;
}
