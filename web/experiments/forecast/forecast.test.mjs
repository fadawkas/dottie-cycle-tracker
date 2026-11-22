import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scoreCohort } from './benchmark.mjs';
import { currentForecast, estimateCyclePhases, forecastLabel, forecastPeriodStart, suggestedPeriodEnd } from '../../src/forecast.ts';

test('one to three starts yield a narrower population-based window', () => {
  const starts = ['2025-01-31', '2025-02-28', '2025-03-28'];
  assert.deepEqual(forecastPeriodStart([]), { status: 'insufficient-history' });
  assert.deepEqual(forecastPeriodStart(starts.slice(0, 1)), {
    status: 'forecast', basis: 'preliminary', from: '2025-02-24', expected: '2025-03-01', to: '2025-03-07',
  });
  for (const count of [2, 3]) {
    assert.deepEqual(forecastPeriodStart(starts.slice(0, count)), forecastPeriodStart([starts[count - 1]]));
  }
  assert.deepEqual(forecastPeriodStart(['2025-01-01', '2025-02-14']), {
    status: 'abstained', reason: 'unusual-interval',
  });
});

test('one logged period shows preliminary phases unless they conflict with recorded bleeding', () => {
  const start = '2025-11-13';
  const forecast = forecastPeriodStart([start]);
  const phases = {
    follicularEnd: { from: '2025-11-24', to: '2025-11-30' },
    ovulation: { from: '2025-11-25', to: '2025-12-01' },
    lutealStart: { from: '2025-11-26', to: '2025-12-02' },
    lutealEnd: { from: '2025-12-06', to: '2025-12-17' },
  };
  assert.deepEqual(estimateCyclePhases(forecast, start, null), phases);
  assert.deepEqual(estimateCyclePhases(forecast, start, '2025-11-20'), phases);
  assert.equal(estimateCyclePhases(forecast, start, '2025-11-25'), null);
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
  const forecast = { status: 'forecast', basis: 'history', from: '2025-05-21', to: '2025-05-25', expected: '2025-05-23' };
  const phases = estimateCyclePhases(forecast, '2025-04-25', '2025-04-29');
  assert.deepEqual(phases, {
    follicularEnd: { from: '2025-05-03', to: '2025-05-13' },
    ovulation: { from: '2025-05-04', to: '2025-05-14' },
    lutealStart: { from: '2025-05-05', to: '2025-05-15' },
    lutealEnd: { from: '2025-05-20', to: '2025-05-24' },
  });
  assert.deepEqual(estimateCyclePhases(forecast, '2025-04-25', null), phases);
  assert.equal(estimateCyclePhases(forecast, '2025-04-25', '2025-05-04'), null);
  assert.equal(estimateCyclePhases({ ...forecast, to: '2025-06-04' }, '2025-04-25', null), null);
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
