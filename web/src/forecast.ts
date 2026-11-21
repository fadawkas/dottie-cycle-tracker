import { addDays, daysBetween, formatDay } from './dates.ts';
import { calQuantile, literatureParams, personalState, predictive } from '../vendor/dochia/dochia.mjs';

export type ForecastRange = { status: 'forecast'; expected: string; from: string; to: string };
type Forecast = ForecastRange | { status: 'insufficient-history' }
  | { status: 'abstained'; reason: 'unusual-interval' | 'long-gap' | 'variable-history' };

export const MIN_INTERVALS = 3;
const params = literatureParams();

export function forecastPeriodStart(startDates: readonly string[]): Forecast {
  if (startDates.some((day) => {
    const date = new Date(day + 'T00:00:00Z');
    return !/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day;
  })) throw new TypeError('Expected valid YYYY-MM-DD period starts.');

  const starts = [...startDates].sort();
  if (new Set(starts).size !== starts.length) throw new TypeError('Period starts must be unique.');
  if (starts.length < MIN_INTERVALS + 1) return { status: 'insufficient-history' };

  // Same six-interval maximum as the existing median. Do not let upstream
  // silently filter a long gap and forecast across an incomplete history.
  const recent = starts.slice(-7);
  const lengths = recent.slice(1).map((end, index) => daysBetween(recent[index], end));
  if (lengths.some((length) => length < params.minLength || length > params.maxLength)) {
    return { status: 'abstained', reason: 'unusual-interval' };
  }

  const state = personalState(lengths, params);
  if (state.abstain) return { status: 'abstained', reason: state.gap ? 'long-gap' : 'variable-history' };

  // Only compute onset quantiles, not the upstream fertility/ovulation output.
  const distribution = predictive(state, params);
  const last = recent[recent.length - 1];
  return {
    status: 'forecast',
    expected: addDays(last, Math.round(calQuantile(distribution, 0.5))),
    from: addDays(last, Math.ceil(calQuantile(distribution, 0.1))),
    to: addDays(last, Math.floor(calQuantile(distribution, 0.9))),
  };
}

export function forecastLabel({ from, to }: ForecastRange) {
  const differentYears = from.slice(0, 4) !== to.slice(0, 4);
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', ...(differentYears && { year: 'numeric' }) };
  if (from === to) return formatDay(from, options);
  return formatDay(from, options) + '–' + (from.slice(0, 7) === to.slice(0, 7) ? Number(to.slice(-2)) : formatDay(to, options));
}

export function suggestedPeriodEnd(start: string, typicalDays: number | null) {
  return typicalDays === null ? null : addDays(start, typicalDays - 1);
}
