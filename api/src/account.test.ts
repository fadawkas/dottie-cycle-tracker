import assert from 'node:assert/strict';
import { test } from 'node:test';
import pg from 'pg';
import { buildApp } from './build-app.ts';
import { appConfig } from './config.ts';

test('the removed account creation endpoint stays unavailable with the old admin setting', async (t) => {
  const database = new pg.Pool();
  t.after(() => database.end());
  const oldAdmin = process.env.ACCOUNT_ADMIN_EMAIL;
  process.env.ACCOUNT_ADMIN_EMAIL = 'admin@example.test';
  t.after(() => {
    if (oldAdmin === undefined) delete process.env.ACCOUNT_ADMIN_EMAIL;
    else process.env.ACCOUNT_ADMIN_EMAIL = oldAdmin;
  });
  const app = buildApp(database);
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST', url: '/api/admin/accounts', headers: { origin: appConfig().appOrigin },
  });
  assert.equal(response.statusCode, 404);
});
