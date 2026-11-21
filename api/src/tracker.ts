import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { fromNodeHeaders } from 'better-auth/node';
import type { Pool } from 'pg';
import type { createAuth } from './auth.ts';
import {
  errorSchema, logBody, logDay, logResponses, periodBody, periodId, periodResponses,
  responses, settingsBody, settingsResponse, setupBody, snapshot, type LogInput, type PeriodInput, type Settings, type SettingsInput, type SetupInput,
} from './schemas.ts';

declare module 'fastify' {
  interface FastifyRequest { trackerOwner: string | null }
}

const periodColumns = 'id, start_date::text AS "startDate", end_date::text AS "endDate", end_unknown AS "endUnknown"';
const insertPeriod = 'INSERT INTO periods (user_id, start_date, end_date, end_unknown) VALUES ($1, $2, $3, $4) RETURNING ' + periodColumns;
const settingColumns = 'symptoms, mood, sleep, sexual_activity AS "sexualActivity", notes, ' +
  'typical_period_days AS "typicalPeriodDays", symptom_shortcuts AS "symptomShortcuts", ' +
  'remind_daily AS "remindDaily", remind_period AS "remindPeriod", remind_end AS "remindEnd"';
const defaults: Settings = {
  symptoms: true, mood: true, sleep: false, sexualActivity: false, notes: false,
  typicalPeriodDays: null, symptomShortcuts: ['cramps', 'headache', 'bloating'],
  remindDaily: false, remindPeriod: false, remindEnd: false,
};
const noContent = { '4xx': errorSchema, '5xx': errorSchema };
const missing = { error: 'That entry was not found.' };

function owner(request: FastifyRequest) {
  if (!request.trackerOwner) throw new Error('Missing tracker owner.');
  return request.trackerOwner;
}

export const trackerRoutes: FastifyPluginAsync<{ database: Pool; auth: ReturnType<typeof createAuth> }> =
async (app, { database, auth }) => {
  app.decorateRequest('trackerOwner', null);
  app.addHook('onRequest', async (request, reply) => {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    if (!session) return reply.code(401).send({ error: 'Sign in to continue.' });
    request.trackerOwner = session.user.id;
  });

  async function readTracker(userId: string) {
    const client = await database.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const periods = await client.query(
        'SELECT ' + periodColumns + ' FROM periods WHERE user_id = $1 ORDER BY start_date DESC', [userId],
      );
      const logs = await client.query<{ day: string; details: LogInput }>(
        'SELECT day::text, details FROM daily_logs WHERE user_id = $1 ORDER BY day DESC', [userId],
      );
      const settings = await client.query<Settings>(
        'SELECT ' + settingColumns + ' FROM user_settings WHERE user_id = $1', [userId],
      );
      const setup = await client.query('SELECT 1 FROM tracker_setup WHERE user_id = $1', [userId]);
      await client.query('COMMIT');
      return {
        onboardingComplete: !!setup.rowCount,
        periods: periods.rows,
        dailyLogs: logs.rows.map(({ day, details }) => ({ ...details, day })),
        settings: settings.rows[0] ?? defaults,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  app.get('/tracker', { schema: { response: responses(snapshot) } }, (request) => readTracker(owner(request)));
  app.get('/export', { schema: { response: responses(snapshot) } }, async (request, reply) => {
    return reply.header('Content-Disposition', 'attachment; filename="dottie.json"').send(await readTracker(owner(request)));
  });

  app.post<{ Body: SetupInput }>('/setup', { schema: { body: setupBody, response: responses(snapshot) } }, async (request, reply) => {
    const entry = request.body;
    const userId = owner(request);
    // The browser checks the exact local date. UTC tomorrow bounds accounts in UTC+14.
    const latest = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    if (entry.kind === 'period' ? entry.startDate > latest || (entry.endDate !== null && entry.endDate > latest) : entry.day > latest) {
      return reply.code(400).send({ error: 'Choose today or an earlier date.' });
    }
    const client = await database.connect();
    try {
      await client.query('BEGIN');
      // Serialize setup and reset for this account. A successful retry returns the
      // existing snapshot instead of inserting the same first entry again.
      await client.query('SELECT id FROM "user" WHERE id = $1 FOR UPDATE', [userId]);
      const setup = await client.query('SELECT 1 FROM tracker_setup WHERE user_id = $1', [userId]);
      if (!setup.rowCount) {
        if (entry.kind === 'period') {
          await client.query(insertPeriod, [userId, entry.startDate, entry.endDate, entry.endUnknown]);
        } else {
          await client.query(
            'INSERT INTO daily_logs (user_id, day, details) VALUES ($1, $2, $3) ' +
            'ON CONFLICT (user_id, day) DO UPDATE SET details = daily_logs.details || excluded.details',
            [userId, entry.day, { mood: entry.mood }],
          );
        }
        await client.query('INSERT INTO tracker_setup (user_id) VALUES ($1)', [userId]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return readTracker(userId);
  });

  app.post<{ Body: PeriodInput }>('/periods', {
    schema: { body: periodBody, response: periodResponses(201) },
  }, async (request, reply) => {
    const { startDate, endDate, endUnknown = false } = request.body;
    const result = await database.query(insertPeriod, [owner(request), startDate, endDate, endUnknown]);
    return reply.code(201).send(result.rows[0]);
  });

  app.put<{ Params: { id: string }; Body: PeriodInput }>('/periods/:id', {
    schema: { params: periodId, body: periodBody, response: periodResponses(200) },
  }, async (request, reply) => {
    const { startDate, endDate, endUnknown } = request.body;
    const result = await database.query(
      'UPDATE periods SET start_date = $3, end_date = $4, ' +
      'end_unknown = COALESCE($5, CASE WHEN $4::date IS NULL THEN end_unknown ELSE false END) ' +
      'WHERE user_id = $1 AND id = $2 RETURNING ' + periodColumns,
      [owner(request), request.params.id, startDate, endDate, endUnknown ?? null],
    );
    if (!result.rowCount) return reply.code(404).send(missing);
    return result.rows[0];
  });

  app.delete<{ Params: { id: string } }>('/periods/:id', {
    schema: { params: periodId, response: noContent },
  }, async (request, reply) => {
    const result = await database.query('DELETE FROM periods WHERE user_id = $1 AND id = $2', [owner(request), request.params.id]);
    return result.rowCount ? reply.code(204).send() : reply.code(404).send(missing);
  });

  app.put<{ Params: { day: string }; Body: LogInput }>('/daily-logs/:day', {
    schema: { params: logDay, body: logBody, response: logResponses },
  }, async (request, reply) => {
    const details = request.body;
    if (details.protection && details.sexualActivity !== 'yes') {
      return reply.code(400).send({ error: 'Protection details require a sexual activity entry.' });
    }
    if (details.symptoms?.length === 0) delete details.symptoms;
    if (details.note !== undefined) {
      details.note = details.note.trim();
      if (!details.note) delete details.note;
    }
    if (!Object.keys(details).length) return reply.code(400).send({ error: 'Add at least one observation.' });
    const day = request.params.day;
    await database.query(
      'INSERT INTO daily_logs (user_id, day, details) VALUES ($1, $2, $3) ' +
      'ON CONFLICT (user_id, day) DO UPDATE SET details = excluded.details',
      [owner(request), day, details],
    );
    return { ...details, day };
  });

  app.delete<{ Params: { day: string } }>('/daily-logs/:day', {
    schema: { params: logDay, response: noContent },
  }, async (request, reply) => {
    await database.query('DELETE FROM daily_logs WHERE user_id = $1 AND day = $2', [owner(request), request.params.day]);
    return reply.code(204).send();
  });

  app.put<{ Body: SettingsInput }>('/settings', { schema: { body: settingsBody, response: responses(settingsResponse) } }, async (request) => {
    const { symptoms, mood, sleep, sexualActivity, notes, typicalPeriodDays, symptomShortcuts, remindDaily, remindPeriod, remindEnd } = request.body;
    const result = await database.query<Settings>(
      `INSERT INTO user_settings (user_id, symptoms, mood, sleep, sexual_activity, notes, typical_period_days,
                                  symptom_shortcuts, remind_daily, remind_period, remind_end)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, false), $7::smallint, COALESCE($8::text[], $12::text[]),
               COALESCE($9, false), COALESCE($10, false), COALESCE($11, false))
       ON CONFLICT (user_id) DO UPDATE SET symptoms = $2, mood = $3, sleep = $4, sexual_activity = $5,
         notes = COALESCE($6, user_settings.notes),
         typical_period_days = CASE WHEN $13 THEN $7 ELSE user_settings.typical_period_days END,
         symptom_shortcuts = COALESCE($8, user_settings.symptom_shortcuts),
         remind_daily = COALESCE($9, user_settings.remind_daily),
         remind_period = COALESCE($10, user_settings.remind_period),
         remind_end = COALESCE($11, user_settings.remind_end)
       RETURNING ` + settingColumns,
      [owner(request), symptoms, mood, sleep, sexualActivity, notes ?? null, typicalPeriodDays ?? null,
        symptomShortcuts ?? null, remindDaily ?? null, remindPeriod ?? null, remindEnd ?? null,
        defaults.symptomShortcuts, typicalPeriodDays !== undefined],
    );
    return result.rows[0];
  });

  app.delete('/tracker', { schema: { response: responses(snapshot) } }, async (request) => {
    const client = await database.connect();
    try {
      await client.query('BEGIN');
      const who = [owner(request)];
      await client.query('SELECT id FROM "user" WHERE id = $1 FOR UPDATE', who);
      await client.query('DELETE FROM tracker_setup WHERE user_id = $1', who);
      await client.query('DELETE FROM periods WHERE user_id = $1', who);
      await client.query('DELETE FROM daily_logs WHERE user_id = $1', who);
      await client.query('DELETE FROM user_settings WHERE user_id = $1', who);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return { onboardingComplete: false, periods: [], dailyLogs: [], settings: defaults };
  });
};
