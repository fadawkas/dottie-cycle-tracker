import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scoreCohort } from './benchmark.mjs';
import { forecastLabel, forecastPeriodStart, suggestedPeriodEnd } from '../../src/forecast.ts';

test('short, invalid, and duplicate histories do not produce a forecast', () => {
  assert.deepEqual(forecastPeriodStart(['2025-01-31', '2025-02-28', '2025-03-28']), { status: 'insufficient-history' });
  assert.throws(() => forecastPeriodStart(['2025-02-30']), /valid YYYY-MM-DD/);
  assert.throws(() => forecastPeriodStart(['2025-01-31', '2025-01-31']), /must be unique/);
});

test('onset quantiles produce an ordered future range and accept unordered logs', () => {
  const result = forecastPeriodStart(['2025-03-28', '2025-01-31', '2025-04-25', '2025-02-28']);
  assert.equal(result.status, 'forecast');
  assert.equal(result.expected, '2025-05-23');
  assert.ok('2025-04-25' < result.from && result.from < result.expected && result.expected < result.to);
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
