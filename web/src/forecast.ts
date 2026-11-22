import { addDays, daysBetween, formatDay } from './dates.ts';
import { calQuantile, literatureParams, personalState, predictive } from '../vendor/dochia/dochia.mjs';

type DateRange = { from: string; to: string };
export type ForecastRange = DateRange & { status: 'forecast' } & (
  { basis: 'preliminary' } | { basis: 'history'; expected: string }
);
type Forecast = ForecastRange | { status: 'insufficient-history' }
  | { status: 'abstained'; reason: 'unusual-interval' | 'long-gap' | 'variable-history' };

export const MIN_INTERVALS = 3;
const params = literatureParams();
// Population reference, not a personalized probability interval.
const preliminaryDays = { min: 24, max: 38 };
// Broad calendar assumption only; a logged period cannot confirm ovulation.
const lutealDays = { min: 11, max: 17 };

export function forecastPeriodStart(startDates: readonly string[]): Forecast {
  if (startDates.some((day) => {
    const date = new Date(day + 'T00:00:00Z');
    return !/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day;
  })) throw new TypeError('Expected valid YYYY-MM-DD period starts.');

  const starts = [...startDates].sort();
  if (new Set(starts).size !== starts.length) throw new TypeError('Period starts must be unique.');
  if (starts.length === 0) return { status: 'insufficient-history' };

  // Same six-interval maximum as the existing median. Do not let upstream
  // silently filter a long gap and forecast across an incomplete history.
  const recent = starts.slice(-7);
  const lengths = recent.slice(1).map((end, index) => daysBetween(recent[index], end));
  if (lengths.some((length) => length < params.minLength || length > params.maxLength)) {
    return { status: 'abstained', reason: 'unusual-interval' };
  }

  const state = personalState(lengths, params);
  if (state.abstain) return { status: 'abstained', reason: state.gap ? 'long-gap' : 'variable-history' };

  const last = recent[recent.length - 1];
  if (lengths.length < MIN_INTERVALS) {
    if (lengths.some((length) => length < preliminaryDays.min || length > preliminaryDays.max)) {
      return { status: 'abstained', reason: 'unusual-interval' };
    }
    return {
      status: 'forecast', basis: 'preliminary',
      from: addDays(last, preliminaryDays.min), to: addDays(last, preliminaryDays.max),
    };
  }

  // Only compute onset quantiles, not the upstream fertility/ovulation output.
  const distribution = predictive(state, params);
  return {
    status: 'forecast', basis: 'history',
    expected: addDays(last, Math.round(calQuantile(distribution, 0.5))),
    from: addDays(last, Math.ceil(calQuantile(distribution, 0.1))),
    to: addDays(last, Math.floor(calQuantile(distribution, 0.9))),
  };
}

export function currentForecast(forecast: Forecast, today: string) {
  return forecast.status === 'forecast' && forecast.to < today ? { status: 'expired' } as const : forecast;
}

export function estimateCyclePhases(forecast: ForecastRange | null, start: string, recordedEnd: string | null) {
  if (forecast?.basis !== 'history') return null;
  const ovulation = { from: addDays(forecast.from, -lutealDays.max), to: addDays(forecast.to, -lutealDays.min) };
  // Don't label dates as plausible if the window conflicts with the period
  // record or is so wide that it overlaps the next-start window.
  if (ovulation.from <= (recordedEnd ?? start) || ovulation.to >= forecast.from) return null;

  return {
    ovulation,
    follicularEnd: { from: addDays(ovulation.from, -1), to: addDays(ovulation.to, -1) },
    lutealStart: { from: addDays(ovulation.from, 1), to: addDays(ovulation.to, 1) },
    lutealEnd: { from: addDays(forecast.from, -1), to: addDays(forecast.to, -1) },
  };
}

export function forecastLabel({ from, to }: DateRange) {
  const differentYears = from.slice(0, 4) !== to.slice(0, 4);
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', ...(differentYears && { year: 'numeric' }) };
  if (from === to) return formatDay(from, options);
  return formatDay(from, options) + '–' + (from.slice(0, 7) === to.slice(0, 7) ? Number(to.slice(-2)) : formatDay(to, options));
}

export function suggestedPeriodEnd(start: string, typicalDays: number | null) {
  return typicalDays === null ? null : addDays(start, typicalDays - 1);
}
