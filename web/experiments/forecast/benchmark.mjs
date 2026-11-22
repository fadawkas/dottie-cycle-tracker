import { readFileSync } from 'node:fs';
import { summarizeCycle } from '../../src/cycle.ts';
import { addDays, daysBetween } from '../../src/dates.ts';
import { forecastPeriodStart, MIN_INTERVALS } from '../../src/forecast.ts';

function pointStats(errors) {
  if (!errors.length) return { count: 0, maeDays: null, withinThree: null };
  return {
    count: errors.length,
    maeDays: errors.reduce((sum, error) => sum + error, 0) / errors.length,
    withinThree: errors.filter((error) => error <= 3).length / errors.length,
  };
}

export function scoreCohort(sequences) {
  if (!Array.isArray(sequences) || sequences.some((sequence) => !Array.isArray(sequence)
    || sequence.some((days) => !Number.isInteger(days) || days < 1 || days > 365))) {
    throw new TypeError('Expected a JSON array of cycle-length arrays (each length a whole number, 1–365 days).');
  }
  const medianAll = [];
  const medianPaired = [];
  const dochiaPaired = [];
  const abstentions = {};
  let hits = 0;
  let totalWidth = 0;

  for (const sequence of sequences) {
    const starts = ['2000-01-01'];
    for (const length of sequence) starts.push(addDays(starts.at(-1), length));
    for (let i = MIN_INTERVALS; i < sequence.length; i++) {
      const knownStarts = starts.slice(Math.max(0, i - 6), i + 1);
      const actual = starts[i + 1];
      const periods = knownStarts.map((startDate) => ({ id: startDate, startDate, endDate: null }));
      const baseline = summarizeCycle(periods).nextEstimate;
      const baselineError = Math.abs(daysBetween(baseline, actual));
      medianAll.push(baselineError);

      const candidate = forecastPeriodStart(knownStarts);
      if (candidate.status !== 'forecast' || candidate.basis !== 'history') {
        const reason = candidate.status === 'abstained' ? candidate.reason : candidate.status;
        abstentions[reason] = (abstentions[reason] ?? 0) + 1;
        continue;
      }
      medianPaired.push(baselineError);
      dochiaPaired.push(Math.abs(daysBetween(candidate.expected, actual)));
      if (candidate.from <= actual && actual <= candidate.to) hits++;
      totalWidth += daysBetween(candidate.from, candidate.to) + 1;
    }
  }
  return {
    medianAll: pointStats(medianAll),
    medianPaired: pointStats(medianPaired),
    dochiaPaired: pointStats(dochiaPaired),
    issuedFraction: medianAll.length ? dochiaPaired.length / medianAll.length : null,
    rangeCoverage: dochiaPaired.length ? hits / dochiaPaired.length : null,
    meanRangeDates: dochiaPaired.length ? totalWidth / dochiaPaired.length : null,
    abstentions,
  };
}

const synthetic = {
  'Steady lengths': [[28, 28, 29, 28, 28, 29, 28], [31, 30, 31, 31, 32, 31]],
  'Shifting lengths': [[33, 32, 31, 29, 28, 27, 27, 26], [25, 26, 27, 28, 29, 30, 31, 32]],
  'Variable lengths': [[23, 38, 26, 41, 23, 35, 32], [36, 24, 31, 27, 39, 29]],
  'Short history': [[28, 29, 28]],
  'Possible missed logs': [[28, 29, 28, 57, 28, 29, 28], [28, 28, 110, 28, 28, 28], [28, 28, 145, 29, 28]],
};

if (import.meta.main) {
  if (process.argv.length > 3 || (process.argv[2] && process.argv[2] !== '--stdin')) {
    throw new Error('Usage: npm run forecast:bench -- [--stdin]');
  }
  console.log(JSON.stringify(process.argv[2] === '--stdin'
    ? scoreCohort(JSON.parse(readFileSync(0, 'utf8')))
    : Object.fromEntries(Object.entries(synthetic).map(([name, sequences]) => [name, scoreCohort(sequences)])), null, 2));
}
