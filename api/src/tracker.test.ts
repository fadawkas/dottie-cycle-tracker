import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import pg from 'pg';
import { buildApp } from './build-app.ts';
import { provisionAccount } from './auth.ts';
import { appConfig, databaseUrl } from './config.ts';
import { resetPassword } from './recover.ts';

test('private auth, validation, date constraints and account isolation', async (t) => {
  assert.notEqual(process.env.NODE_ENV, 'production', 'Run this test only on a disposable database.');
  const database = new pg.Pool({ connectionString: databaseUrl() });
  const app = buildApp(database);
  const identities: string[] = [];
  t.after(async () => {
    try {
      await app.close();
      if (identities.length) await database.query('DELETE FROM "user" WHERE id = ANY($1)', [identities]);
    } finally {
      await database.end();
    }
  });

  const origin = appConfig().appOrigin;
  const password = randomBytes(20).toString('hex');
  async function signIn() {
    const email = randomUUID() + '@example.test';
    identities.push(await provisionAccount(database, email, password));
    const response = await app.inject({
      method: 'POST', url: '/api/auth/sign-in/email', headers: { origin }, payload: { email, password },
    });
    assert.equal(response.statusCode, 200);
    const cookie = response.cookies.find(({ name }) => name.endsWith('.session_token'));
    assert.ok(cookie?.httpOnly);
    assert.equal(cookie.sameSite, 'Lax');
    return { email, cookie: cookie.name + '=' + cookie.value };
  }

  const { rows } = await database.query("SELECT has_schema_privilege(current_user, 'public', 'CREATE') AS can_create");
  assert.equal(rows[0].can_create, false);
  const health = await app.inject('/api/health');
  assert.deepEqual(health.json(), { status: 'ok' });
  for (const [method, url] of [['GET', '/api/tracker'], ['GET', '/api/export'], ['DELETE', '/api/tracker'], ['POST', '/api/setup']] as const) {
    const response = await app.inject({ method, url, headers: { origin } });
    assert.equal(response.statusCode, 401);
    assert.equal(response.headers['cache-control'], 'no-store');
  }
  assert.equal((await app.inject({
    method: 'POST', url: '/api/auth/sign-up/email', headers: { origin }, payload: { email: 'random@example.test', password },
  })).statusCode, 404);
  const first = await signIn();
  const a = { origin, cookie: first.cookie };
  const b = { origin, cookie: (await signIn()).cookie };
  const read = (headers: typeof a) => app.inject({ url: '/api/tracker', headers });
  const setup = (headers: typeof a, payload: object) =>
    app.inject({ method: 'POST', url: '/api/setup', headers, payload });
  const firstEntry = { kind: 'period', startDate: '2025-01-01', endDate: null, endUnknown: true };
  assert.equal((await read(a)).json().onboardingComplete, false);
  for (const payload of [
    { ...firstEntry, endDate: '2025-01-03' },
    { ...firstEntry, startDate: '9999-12-31' },
    { kind: 'check-in', day: '2025-01-01' },
    { ...firstEntry, userId: identities[1] },
  ]) assert.equal((await setup(a, payload)).statusCode, 400);
  assert.equal((await read(a)).json().onboardingComplete, false);
  assert.deepEqual((await read(a)).json().periods, []);

  const [initial, retry] = await Promise.all([setup(a, firstEntry), setup(a, firstEntry)]);
  assert.equal(initial.statusCode, 200);
  assert.equal(retry.statusCode, 200);
  assert.deepEqual(retry.json(), initial.json());
  const { periods: [past], onboardingComplete } = initial.json();
  assert.equal(onboardingComplete, true);
  assert.deepEqual(initial.json().periods, [{ id: past.id, startDate: firstEntry.startDate, endDate: null, endUnknown: true }]);
  assert.equal((await read(b)).json().onboardingComplete, false);

  const writePeriod = { startDate: '2025-01-30', endDate: '2025-02-02' };

  assert.equal((await app.inject({
    method: 'POST', url: '/api/periods', headers: { ...a, origin: 'https://different.example' }, payload: writePeriod,
  })).statusCode, 403);
  for (const payload of [
    { ...writePeriod, userId: identities[1] },
    { ...writePeriod, startDate: '2025-02-30' },
    { ...writePeriod, endDate: '2025-01-29' },
  ]) {
    assert.equal((await app.inject({ method: 'POST', url: '/api/periods', headers: a, payload })).statusCode, 400);
  }
  const created = await app.inject({ method: 'POST', url: '/api/periods', headers: a, payload: writePeriod });
  assert.equal(created.statusCode, 201);
  const period = created.json();
  assert.deepEqual(period, { id: period.id, ...writePeriod, endUnknown: false });
  assert.equal((await app.inject({ method: 'DELETE', url: '/api/periods/' + past.id, headers: a })).statusCode, 204);
  assert.equal((await read(a)).json().onboardingComplete, true);
  assert.equal((await app.inject({
    method: 'POST', url: '/api/periods', headers: a, payload: { startDate: '2025-02-01', endDate: null },
  })).statusCode, 409);
  assert.equal((await app.inject({
    method: 'PUT', url: '/api/periods/' + period.id, headers: b, payload: writePeriod,
  })).statusCode, 404);
  assert.equal((await app.inject({
    method: 'DELETE', url: '/api/periods/' + period.id, headers: b,
  })).statusCode, 404);
  const changed = await app.inject({
    method: 'PUT', url: '/api/periods/' + period.id, headers: a, payload: { ...writePeriod, endDate: '2025-02-03' },
  });
  assert.equal(changed.json().endDate, '2025-02-03');

  const logUrl = '/api/daily-logs/2025-02-01';
  assert.equal((await app.inject({
    method: 'PUT', url: logUrl, headers: a, payload: { protection: 'used' },
  })).statusCode, 400);
  const details = { sexualActivity: 'yes', protection: 'used', sleepHours: 0, note: 'Synthetic journal note' };
  assert.equal((await app.inject({ method: 'PUT', url: logUrl, headers: a, payload: { note: 'a'.repeat(1001) } })).statusCode, 400);
  assert.equal((await app.inject({ method: 'PUT', url: logUrl, headers: a, payload: details })).statusCode, 200);
  assert.equal((await app.inject({ method: 'PUT', url: logUrl, headers: a, payload: { ...details, mood: 'good' } })).statusCode, 200);
  assert.equal((await app.inject({ method: 'DELETE', url: logUrl, headers: b })).statusCode, 204);
  const flags = { symptoms: false, mood: true, sleep: false, sexualActivity: false };
  const preferences = { ...flags, notes: true, typicalPeriodDays: 5, symptomShortcuts: ['fatigue'],
    remindDaily: true, remindPeriod: true, remindEnd: false };
  for (const payload of [{ ...preferences, typicalPeriodDays: 0 }, { ...preferences, symptomShortcuts: ['fake'] }]) {
    assert.equal((await app.inject({ method: 'PUT', url: '/api/settings', headers: a, payload })).statusCode, 400);
  }
  const updated = await app.inject({ method: 'PUT', url: '/api/settings', headers: a, payload: preferences });
  assert.equal(updated.statusCode, 200);
  assert.deepEqual(updated.json(), preferences);
  const legacy = await app.inject({ method: 'PUT', url: '/api/settings', headers: a, payload: flags });
  assert.deepEqual(legacy.json(), preferences);
  const other = await app.inject({ method: 'PUT', url: '/api/settings', headers: b, payload: { ...flags, typicalPeriodDays: 8 } });
  assert.equal(other.json().typicalPeriodDays, 8);

  assert.deepEqual((await app.inject({ url: '/api/tracker', headers: b })).json().periods, []);
  assert.deepEqual((await app.inject({ url: '/api/export', headers: b })).json().dailyLogs, []);
  const day = new Date().toISOString().slice(0, 10);
  const checkIn = await setup(b, { kind: 'check-in', day, mood: 'okay' });
  assert.equal(checkIn.statusCode, 200);
  assert.equal(checkIn.json().onboardingComplete, true);
  assert.deepEqual(checkIn.json().dailyLogs, [{ day, mood: 'okay' }]);
  assert.equal((await app.inject({ method: 'DELETE', url: '/api/daily-logs/' + day, headers: b })).statusCode, 204);
  assert.equal((await read(b)).json().onboardingComplete, true);
  assert.equal((await app.inject({ method: 'DELETE', url: '/api/tracker', headers: b })).statusCode, 200);
  assert.equal((await read(b)).json().onboardingComplete, false);
  const exported = await app.inject({ url: '/api/export', headers: a });
  assert.equal(exported.statusCode, 200);
  assert.match(String(exported.headers['content-disposition']), /attachment/);
  assert.deepEqual(exported.json().dailyLogs, [{ day: '2025-02-01', ...details, mood: 'good' }]);
  assert.equal(exported.json().periods.length, 1);
  assert.deepEqual(exported.json().settings, preferences);
  assert.equal(exported.headers['cache-control'], 'no-store');

  assert.equal((await app.inject({ method: 'DELETE', url: '/api/tracker', headers: a })).statusCode, 200);
  assert.deepEqual((await app.inject({ url: '/api/tracker', headers: a })).json(), {
    onboardingComplete: false, periods: [], dailyLogs: [], settings: {
      symptoms: true, mood: true, sleep: false, sexualActivity: false, notes: false, typicalPeriodDays: null,
      symptomShortcuts: ['cramps', 'headache', 'bloating'], remindDaily: false, remindPeriod: false, remindEnd: false,
    },
  });

  const signin = (email: string, password: string, target = app) =>
    target.inject({ method: 'POST', url: '/api/auth/sign-in/email', headers: { origin }, payload: { email, password } });
  const wrongPassword = randomBytes(20).toString('hex');
  for (let attempt = 0; attempt < 7; attempt++) assert.equal((await signin(first.email, wrongPassword)).statusCode, 401);
  assert.equal((await signin(first.email, password)).statusCode, 429);
  const newPassword = randomBytes(20).toString('hex');
  await resetPassword(database, first.email, newPassword);
  assert.equal((await app.inject({ url: '/api/tracker', headers: a })).statusCode, 401);
  assert.equal((await app.inject({ url: '/api/tracker', headers: b })).statusCode, 200);
  assert.equal((await signin(first.email, password)).statusCode, 401);
  assert.equal((await signin(first.email, newPassword)).statusCode, 200);

  const unknown = randomUUID() + '@example.test';
  for (let attempt = 0; attempt < 8; attempt++) assert.equal((await signin(unknown, password)).statusCode, 401);
  const anotherInstance = buildApp(database);
  t.after(() => anotherInstance.close());
  const limited = await signin(unknown.toUpperCase(), password, anotherInstance);
  assert.equal(limited.statusCode, 429);
  assert.ok(Number(limited.headers['retry-after']) > 0);

  assert.equal((await app.inject({ method: 'POST', url: '/api/auth/sign-out', headers: b, payload: {} })).statusCode, 200);
  assert.equal((await app.inject({ url: '/api/tracker', headers: b })).statusCode, 401);

  await t.test('production configuration emits HTTPS-only session cookies', async () => {
    const previousMode = process.env.NODE_ENV;
    const previousOrigin = process.env.APP_ORIGIN;
    const secureOrigin = 'https://notes.example.test';
    process.env.NODE_ENV = 'production';
    process.env.APP_ORIGIN = secureOrigin;
    try {
      const productionApp = buildApp(database);
      try {
        const result = await productionApp.inject({
          method: 'POST', url: '/api/auth/sign-in/email', headers: { origin: secureOrigin },
          payload: { email: first.email, password: newPassword },
        });
        assert.equal(result.statusCode, 200);
        const cookie = result.cookies.find(({ name }) => name.endsWith('.session_token'));
        assert.ok(cookie?.secure && cookie.httpOnly);
        assert.equal(result.headers['strict-transport-security'], 'max-age=31536000');
        assert.equal(result.headers['cache-control'], 'no-store');
      } finally {
        await productionApp.close();
      }
    } finally {
      if (previousMode === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousMode;
      if (previousOrigin === undefined) delete process.env.APP_ORIGIN;
      else process.env.APP_ORIGIN = previousOrigin;
    }
  });
});
