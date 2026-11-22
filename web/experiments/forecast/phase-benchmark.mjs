import { readFileSync } from 'node:fs';
import { addDays, daysBetween } from '../../src/dates.ts';
import { estimateCyclePhases, forecastPeriodStart } from '../../src/forecast.ts';

function previousWindow(forecast) {
  const { from, to } = forecast.basis === 'preliminary'
    ? { from: forecast.expected, to: forecast.expected } : forecast;
  return { from: addDays(from, -17), to: addDays(to, -11) };
}

function score(windows) {
  const issued = windows.length;
  return {
    issued,
    coverage: issued ? windows.filter(({ from, to, reference }) => from <= reference && reference <= to).length / issued : null,
    meanRangeDates: issued ? windows.reduce((sum, { from, to }) => sum + daysBetween(from, to) + 1, 0) / issued : null,
  };
}

export function scorePhaseWindows(cases) {
  if (!Array.isArray(cases)) throw new TypeError('Expected an array of phase benchmark cases.');
  const baseline = [], candidate = [], pairedBaseline = [], pairedCandidate = [];
  for (const { starts, reference } of cases) {
    if (!Array.isArray(starts) || !starts.length) throw new TypeError('Each case needs known period starts.');
    const forecast = forecastPeriodStart(starts);
    const last = [...starts].sort().at(-1);
    const date = new Date(reference + 'T00:00:00Z');
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== reference || reference <= last) {
      throw new TypeError('Expected an ovulation reference date after the last known period start.');
    }
    if (forecast.status !== 'forecast') continue;
    const oldWindow = estimateCyclePhases({ ...forecast, ovulation: previousWindow(forecast) }, last, null)?.ovulation;
    const newWindow = estimateCyclePhases(forecast, last, null)?.ovulation;
    if (oldWindow) baseline.push({ ...oldWindow, reference });
    if (newWindow) candidate.push({ ...newWindow, reference });
    if (oldWindow && newWindow) {
      pairedBaseline.push({ ...oldWindow, reference });
      pairedCandidate.push({ ...newWindow, reference });
    }
  }
  return {
    cases: cases.length,
    baseline: score(baseline), candidate: score(candidate),
    paired: { baseline: score(pairedBaseline), candidate: score(pairedCandidate) },
  };
}

if (import.meta.main) console.log(JSON.stringify(scorePhaseWindows(JSON.parse(readFileSync(0, 'utf8'))), null, 2));
