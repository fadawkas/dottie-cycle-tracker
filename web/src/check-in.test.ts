import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getSexChoice, prepareCheckIn, sexDetails } from './check-in.ts';
import type { Observations } from './model.ts';

test('saved sexual activity and protection map to distinct tap choices', () => {
  assert.equal(getSexChoice({}), undefined);
  assert.equal(getSexChoice({ sexualActivity: 'no' }), 'noSex');
  assert.equal(getSexChoice({ sexualActivity: 'yes' }), 'noDetails');
  assert.equal(getSexChoice({ sexualActivity: 'yes', protection: 'used' }), 'withProtection');
  assert.equal(getSexChoice({ sexualActivity: 'yes', protection: 'notUsed' }), 'withoutProtection');
});

test('changing or clearing sexual activity drops stale protection, not other observations', () => {
  const existing: Observations = { sexualActivity: 'yes', protection: 'used', mood: 'good', sleepHours: 0, note: 'Kept' };
  const serialized = (change: Observations) => JSON.stringify(prepareCheckIn({ ...existing, ...change }, '0'));
  assert.deepEqual(JSON.parse(serialized(sexDetails('withoutProtection'))), { ...existing, protection: 'notUsed' });
  assert.deepEqual(JSON.parse(serialized(sexDetails('noDetails'))), { sexualActivity: 'yes', mood: 'good', sleepHours: 0, note: 'Kept' });
  assert.deepEqual(JSON.parse(serialized(sexDetails('noSex'))), { sexualActivity: 'no', mood: 'good', sleepHours: 0, note: 'Kept' });
  assert.deepEqual(JSON.parse(serialized(sexDetails(undefined))), { mood: 'good', sleepHours: 0, note: 'Kept' });
});

test('an entirely cleared draft is empty, but explicit zero sleep and no sex are not', () => {
  assert.equal(prepareCheckIn({ flow: undefined, symptoms: [], note: ' ' }, ''), null);
  assert.equal(prepareCheckIn(sexDetails('noSex'), '0')?.sexualActivity, 'no');
  assert.equal(prepareCheckIn({}, '0')?.sleepHours, 0);
});
