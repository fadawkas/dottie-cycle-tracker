import assert from 'node:assert/strict';
import { test } from 'node:test';
import { periodOnDay, summarizeCycle } from './cycle.ts';
import { addDays, daysBetween, shiftMonth, todayDate } from './dates.ts';

test('calendar days work across leap days, months, and DST', () => {
  assert.equal(addDays('2024-02-28', 2), '2024-03-01');
  assert.equal(shiftMonth('2025-12-31', 1), '2026-01-01');
  assert.equal(daysBetween('2026-03-07', '2026-03-10'), 3);
  assert.equal(todayDate(new Date(2025, 0, 30, 23, 59)), '2025-01-30');
});

test('the estimate needs three starts, uses the median, and responds to corrections', () => {
  const january = { id: '1', startDate: '2025-01-01', endDate: '2025-01-04', endUnknown: false };
  const february = { id: '2', startDate: '2025-02-01', endDate: '2025-02-03', endUnknown: false };
  const march = { id: '3', startDate: '2025-03-01', endDate: null, endUnknown: false };
  assert.equal(summarizeCycle([january, february]).nextEstimate, null);
  assert.deepEqual(summarizeCycle([january, march, february]), {
    lastCycle: 28, lastDuration: 3, nextEstimate: '2025-03-31',
  });
  assert.equal(summarizeCycle([january, february, { ...march, startDate: '2025-03-03' }]).nextEstimate, '2025-04-03');
  assert.equal(periodOnDay([march], '2025-03-06', '2025-03-05'), undefined);
  assert.deepEqual(periodOnDay([march], '2025-03-05', '2025-03-05'), march);
  const unknown = { ...march, endUnknown: true };
  assert.equal(periodOnDay([unknown], '2025-03-05', '2025-03-05'), undefined);
  assert.deepEqual(periodOnDay([unknown], '2025-03-01', '2025-03-05'), unknown);
});
