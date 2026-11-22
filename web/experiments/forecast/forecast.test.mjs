import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scoreCohort } from './benchmark.mjs';
import { scorePhaseWindows } from './phase-benchmark.mjs';
import { calendarPhaseOnDay, currentForecast, estimateCyclePhases, forecastLabel, forecastPeriodStart, suggestedPeriodEnd } from '../../src/forecast.ts';

test('one to three starts yield a narrower population-based window', () => {
  const starts = ['2025-01-31', '2025-02-28', '2025-03-28'];
  assert.deepEqual(forecastPeriodStart([]), { status: 'insufficient-history' });
  const { ovulationDayPhases, ...forecast } = forecastPeriodStart(starts.slice(0, 1));
  assert.equal(ovulationDayPhases.length, 14);
  assert.deepEqual(forecast, {
    status: 'forecast', basis: 'preliminary', from: '2025-02-24', expected: '2025-03-01', to: '2025-03-07',
    ovulation: { from: '2025-02-09', to: '2025-02-22' },
  });
  for (const count of [2, 3]) {
    assert.deepEqual(forecastPeriodStart(starts.slice(0, count)), forecastPeriodStart([starts[count - 1]]));
  }
  assert.deepEqual(forecastPeriodStart(['2025-01-01', '2025-02-14']), {
    status: 'abstained', reason: 'unusual-interval',
  });
});

test('one logged period shows phase windows that account for uncertainty in the next start', () => {
  const start = '2025-11-13';
  const forecast = forecastPeriodStart([start]);
  const phases = {
    follicularEnd: { from: '2025-11-21', to: '2025-12-04' },
    ovulation: { from: '2025-11-22', to: '2025-12-05' },
    lutealStart: { from: '2025-11-23', to: '2025-12-06' },
    lutealEnd: { from: '2025-12-06', to: '2025-12-17' },
  };
  assert.deepEqual(estimateCyclePhases(forecast, start, null), phases);
  assert.deepEqual(estimateCyclePhases(forecast, start, '2025-11-20'), phases);
  assert.equal(estimateCyclePhases(forecast, start, '2025-11-22'), null);
});

test('calendar ranks overlapping phase estimates and leaves the next-start range to the period forecast', () => {
  const start = '2025-11-13';
  const forecast = forecastPeriodStart([start]);
  const phases = estimateCyclePhases(forecast, start, '2025-11-20');
  const label = (day) => calendarPhaseOnDay(forecast, phases, start, day);
  assert.equal(label('2025-11-12'), undefined);
  assert.equal(label(start), undefined);
  assert.equal(label('2025-11-21'), 'Follicular');
  assert.equal(label('2025-11-22'), 'Follicular');
  assert.equal(label('2025-11-27'), 'Follicular');
  assert.equal(label('2025-11-28'), 'Luteal');
  assert.equal(label('2025-12-05'), 'Luteal');
  assert.equal(label('2025-12-06'), 'Luteal');
  assert.equal(label(forecast.from), undefined);
  assert.equal(label(forecast.to), undefined);
  assert.equal(calendarPhaseOnDay(forecast, estimateCyclePhases(forecast, start, '2025-11-22'), start, '2025-11-23'), undefined);
});

test('invalid and duplicate dates do not produce a forecast', () => {
  assert.throws(() => forecastPeriodStart(['2025-02-30']), /valid YYYY-MM-DD/);
  assert.throws(() => forecastPeriodStart(['2025-01-31', '2025-01-31']), /must be unique/);
});

test('onset quantiles produce an ordered future range and accept unordered logs', () => {
  const result = forecastPeriodStart(['2025-03-28', '2025-01-31', '2025-04-25', '2025-02-28']);
  assert.equal(result.status, 'forecast');
  assert.equal(result.basis, 'history');
  assert.equal(result.expected, '2025-05-23');
  assert.ok('2025-04-25' < result.from && result.from < result.expected && result.expected < result.to);
});

test('expired ranges do not roll forward without a new recorded start', () => {
  const forecast = forecastPeriodStart(['2025-01-31']);
  assert.deepEqual(currentForecast(forecast, '2025-03-07'), forecast);
  assert.deepEqual(currentForecast(forecast, '2025-03-08'), { status: 'expired' });
  const next = forecastPeriodStart(['2025-01-31', '2025-03-01']);
  assert.deepEqual(currentForecast(next, '2025-03-11'), next);
  assert.equal(next.from, '2025-03-25');
});

test('phase estimates use date boundaries and omit conflicting windows', () => {
  const start = '2025-04-25';
  const forecast = forecastPeriodStart(['2025-01-31', '2025-02-28', '2025-03-28', start]);
  const phases = estimateCyclePhases(forecast, start, '2025-04-29');
  assert.deepEqual(phases, {
    follicularEnd: { from: '2025-05-05', to: '2025-05-12' },
    ovulation: { from: '2025-05-06', to: '2025-05-13' },
    lutealStart: { from: '2025-05-07', to: '2025-05-14' },
    lutealEnd: { from: '2025-05-20', to: '2025-05-24' },
  });
  assert.deepEqual(estimateCyclePhases(forecast, start, null), phases);
  assert.equal(estimateCyclePhases(forecast, start, '2025-05-06'), null);
  assert.equal(estimateCyclePhases({ ...forecast, from: '2025-05-13' }, start, null), null);

  const longerCycles = forecastPeriodStart(['2025-01-10', '2025-02-14', '2025-03-21', start]);
  const later = estimateCyclePhases(longerCycles, start, null);
  assert.ok(later.ovulation.from > phases.ovulation.from && later.ovulation.to > phases.ovulation.to);
});

test('variable or unusual intervals do not silently produce a point forecast', () => {
  const start = ['2025-01-01', '2025-01-29', '2025-02-26'];
  assert.deepEqual(forecastPeriodStart([...start, '2025-04-23']), { status: 'abstained', reason: 'variable-history' });
  assert.deepEqual(forecastPeriodStart([...start, '2025-06-18']), { status: 'abstained', reason: 'long-gap' });
  assert.deepEqual(forecastPeriodStart([...start, '2025-07-21']), { status: 'abstained', reason: 'unusual-interval' });
});

test('a suggested end counts start as day one and forecast labels handle month and year changes', () => {
  assert.equal(suggestedPeriodEnd('2025-01-29', 5), '2025-02-02');
  assert.equal(suggestedPeriodEnd('2025-01-29', 1), '2025-01-29');
  assert.equal(suggestedPeriodEnd('2025-01-29', null), null);
  assert.equal(forecastLabel({ from: '2025-01-03', to: '2025-01-08' }), 'Jan 3–8');
  assert.equal(forecastLabel({ from: '2025-12-31', to: '2026-01-03' }), 'Dec 31, 2025–Jan 3, 2026');
});

test('phase benchmark measures coverage, width and omitted estimates against the same references', () => {
  const result = scorePhaseWindows([
    { starts: ['2025-11-13'], reference: '2025-12-04' },
    { starts: ['2025-11-13'], reference: '2025-11-28' },
    { starts: ['2025-10-01', '2025-11-13'], reference: '2025-11-28' },
  ]);
  assert.equal(result.cases, 3);
  assert.deepEqual(result.baseline, { issued: 2, coverage: 0.5, meanRangeDates: 7 });
  assert.deepEqual(result.candidate, { issued: 2, coverage: 1, meanRangeDates: 14 });
  assert.deepEqual(result.paired, { baseline: result.baseline, candidate: result.candidate });
  assert.throws(() => scorePhaseWindows([{ starts: ['2025-11-13'], reference: '2025-11-12' }]), /reference date/);
});

test('walk-forward keeps the held-out length out of history and scores the same issued cases', () => {
  const result = scoreCohort([[28, 28, 28, 58], [28, 28, 110, 28], [28, 28, 28]]);
  assert.deepEqual(result.medianAll, { count: 2, maeDays: 15, withinThree: 0.5 });
  assert.deepEqual(result.medianPaired, { count: 1, maeDays: 30, withinThree: 0 });
  assert.deepEqual(result.dochiaPaired, { count: 1, maeDays: 30, withinThree: 0 });
  assert.equal(result.rangeCoverage, 0);
  assert.equal(result.issuedFraction, 0.5);
  assert.deepEqual(result.abstentions, { 'long-gap': 1 });
  assert.deepEqual(scoreCohort([[30, 30]]).dochiaPaired, { count: 0, maeDays: null, withinThree: null });
  assert.throws(() => scoreCohort([[0]]), /whole number/);
});
