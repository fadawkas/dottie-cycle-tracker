import assert from 'node:assert/strict';
import { test } from 'node:test';
import { patternState, prePeriodPatterns } from './patterns.ts';
import type { Period } from './model.ts';

const period = (startDate: string): Period => ({ id: startDate, startDate, endDate: null, endUnknown: true });

test('uses the latest four starts, counts each start once, and keeps gaps distinct', () => {
  const periods = ['2025-04-01', '2025-01-01', '2025-03-01', '2025-05-01', '2025-02-01'].map(period);
  const { windows, ranked, checked } = prePeriodPatterns(periods, [
    { day: '2024-12-31', symptoms: ['cramps'] }, // Outside the latest four.
    { day: '2025-01-30', symptoms: ['cramps'] },
    { day: '2025-01-31', symptoms: ['cramps', 'headache'] },
    { day: '2025-02-28', mood: 'good' },
    { day: '2025-03-31', symptoms: ['cramps'] },
    { day: '2025-05-01', symptoms: ['cramps'] }, // Start day is not a pre-period day.
  ]);
  assert.deepEqual(windows.map(({ start }) => start), ['2025-02-01', '2025-03-01', '2025-04-01', '2025-05-01']);
  assert.deepEqual(windows.map(({ days }) => patternState(days, 'cramps')), ['logged', 'check-in', 'logged', 'untracked']);
  assert.deepEqual(ranked, [{ symptom: 'cramps', count: 2 }]);
  assert.equal(checked, 3);
});

test('overlapping two-day windows do not count a symptom from the same day twice', () => {
  const { windows, ranked } = prePeriodPatterns([period('2024-03-01'), period('2024-03-02')], [
    { day: '2024-02-29', symptoms: ['fatigue'] },
  ]);
  assert.deepEqual(windows.map(({ days }) => days.map(({ date }) => date)), [['2024-02-28', '2024-02-29'], ['2024-03-01']]);
  assert.deepEqual(ranked, []);
});

test('empty history gives no pattern and correcting a start recomputes its window', () => {
  assert.deepEqual(prePeriodPatterns([], []), { windows: [], ranked: [], checked: 0 });
  const logs = [
    { day: '2024-12-31', symptoms: ['bloating'] as const },
    { day: '2025-01-30', symptoms: ['bloating'] as const },
  ].map(({ day, symptoms }) => ({ day, symptoms: [...symptoms] }));
  assert.equal(prePeriodPatterns([period('2025-01-01'), period('2025-02-01')], logs).ranked.length, 1);
  assert.equal(prePeriodPatterns([period('2025-01-01'), period('2025-02-03')], logs).ranked.length, 0);
});
