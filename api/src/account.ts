import pg from 'pg';
import { provisionAccount } from './auth.ts';
import { databaseUrl } from './config.ts';
import { resetPassword } from './recover.ts';

const reset = process.argv[2] === '--reset';
const email = process.argv[reset ? 3 : 2]?.trim().toLowerCase();
if (!email) {
  console.error('Usage: npm run account -- [--reset] email@example.test (password on stdin)');
  process.exit(1);
}

const chunks: Buffer[] = [];
let length = 0;
for await (const chunk of process.stdin) {
  length += chunk.length;
  if (length > 1024) throw new Error('Password input is too long.');
  chunks.push(chunk);
}
const password = Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
const database = new pg.Pool({ connectionString: databaseUrl() });

try {
  if (reset) {
    await resetPassword(database, email, password);
    console.log('Password reset and active sessions revoked.');
  } else {
    await provisionAccount(database, email, password);
    console.log('Account created.');
  }
} catch {
  console.error('Account operation failed. Check the email and use a password of 12–128 characters.');
  process.exitCode = 1;
} finally {
  await database.end();
}
