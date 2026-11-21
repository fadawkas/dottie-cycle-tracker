import { hashPassword } from 'better-auth/crypto';
import type { Pool } from 'pg';
import { appConfig } from './config.ts';
import { accountBucket } from './signin-limit.ts';

export async function resetPassword(database: Pool, email: string, password: string) {
  if (password.length < 12 || password.length > 128) throw new Error('Password must be 12–128 characters.');
  const hash = await hashPassword(password);
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{ userId: string }>(
      `UPDATE account SET password = $2, "updatedAt" = NOW()
       WHERE "providerId" = 'credential' AND "userId" = (SELECT id FROM "user" WHERE email = $1)
       RETURNING "userId"`,
      [email.trim().toLowerCase(), hash],
    );
    if (rows.length !== 1) throw new Error('Credential account not found.');
    await client.query('DELETE FROM session WHERE "userId" = $1', [rows[0].userId]);
    await client.query('DELETE FROM signin_limits WHERE key = $1', [accountBucket(appConfig().secret, email)]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
