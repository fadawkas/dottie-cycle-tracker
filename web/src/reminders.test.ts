import assert from 'node:assert/strict';
import { test } from 'node:test';
import { remindersForToday } from './reminders.ts';

const settings = {
  symptoms: true, mood: true, sleep: false, sexualActivity: false, notes: false,
  typicalPeriodDays: 5, symptomShortcuts: [], remindDaily: true, remindPeriod: true, remindEnd: true,
};
const forecast = { status: 'forecast' as const, basis: 'history' as const, from: '2025-02-03', to: '2025-02-08', expected: '2025-02-06' };
const base = { today: '2025-01-29', hasDailyLog: false, hasOpenPeriod: false, suggestedEnd: null, forecast, settings };

test('reminders respect opt-in, local date boundaries and what was logged', () => {
  assert.deepEqual(remindersForToday({ ...base, settings: { ...settings, remindDaily: false } }), []);
  assert.deepEqual(remindersForToday(base), ['check-in']);
  assert.deepEqual(remindersForToday({ ...base, today: '2025-01-31' }), ['check-in', 'upcoming-period']);
  const preliminary = { status: 'forecast' as const, basis: 'preliminary' as const, from: forecast.from, to: forecast.to };
  assert.deepEqual(remindersForToday({ ...base, today: '2025-01-31', forecast: preliminary }), ['check-in']);
  assert.deepEqual(remindersForToday({ ...base, today: '2025-02-09', hasDailyLog: true }), []);
  const open = { ...base, today: '2025-02-03', suggestedEnd: '2025-02-02', hasOpenPeriod: true, hasDailyLog: true };
  assert.deepEqual(remindersForToday(open), ['confirm-end']);
  assert.deepEqual(remindersForToday({ ...open, hasOpenPeriod: false, forecast: null }), []);
});
