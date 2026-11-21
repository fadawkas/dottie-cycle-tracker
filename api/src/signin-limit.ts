import { createHmac } from 'node:crypto';
import type { Pool } from 'pg';

const GLOBAL_LIMIT = 60;
const ACCOUNT_LIMIT = 8;

export function accountBucket(secret: string, email: string) {
  return createHmac('sha256', secret).update(email.trim().toLowerCase()).digest('hex');
}

export async function signinLimit(database: Pool, secret: string, email: string) {
  // The global budget bounds account keys even when requests submit fabricated emails.
  // Do not trust arbitrary forwarded IP headers or store cleartext emails in this table.
  async function consume(bucket: string, seconds: number, limit: number) {
    const { rows } = await database.query<{ retry: number }>(
      `INSERT INTO signin_limits (key, attempts, expires_at)
       VALUES ($1, 1, statement_timestamp() + make_interval(secs => $2))
       ON CONFLICT (key) DO UPDATE SET
         attempts = CASE WHEN signin_limits.expires_at <= statement_timestamp() THEN 1 ELSE signin_limits.attempts + 1 END,
         expires_at = CASE WHEN signin_limits.expires_at <= statement_timestamp() THEN excluded.expires_at ELSE signin_limits.expires_at END
       RETURNING CASE WHEN attempts > $3 THEN GREATEST(1, CEIL(EXTRACT(EPOCH FROM expires_at - statement_timestamp())))::int ELSE 0 END AS retry`,
      [bucket, seconds, limit],
    );
    return rows[0].retry;
  }

  const globalRetry = await consume('global', 60, GLOBAL_LIMIT);
  if (globalRetry) return globalRetry;
  await database.query("DELETE FROM signin_limits WHERE key <> 'global' AND expires_at <= statement_timestamp()");
  return consume(accountBucket(secret, email), 900, ACCOUNT_LIMIT);
}
