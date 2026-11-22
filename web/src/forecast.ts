import { addDays, daysBetween, formatDay } from './dates.ts';
import { calCdf, calQuantile, literatureParams, personalState, predictive } from '../vendor/dochia/dochia.mjs';

type DateRange = { from: string; to: string };
export type ForecastRange = DateRange & { status: 'forecast'; basis: 'preliminary' | 'history'; expected: string };
type CycleForecast = ForecastRange & { ovulation: DateRange | null };
type Forecast = CycleForecast | { status: 'insufficient-history' }
  | { status: 'abstained'; reason: 'unusual-interval' | 'long-gap' | 'variable-history' };

export const MIN_INTERVALS = 3;
const params = literatureParams();
// Population reference for screening sparse history, not the displayed window.
const preliminaryDays = { min: 24, max: 38 };
// Broad calendar assumption only; a logged period cannot confirm ovulation.
const lutealDays = { min: 11, max: 17 };
const lowerPercentile = 0.1;
const upperPercentile = 0.9;

function estimateOvulation(distribution: ReturnType<typeof predictive>, start: string, upperOnset: number) {
  let firstDay: number | null = null;
  const offsetCount = lutealDays.max - lutealDays.min + 1;
  // Each scenario pairs a next-start day with one of seven equally weighted
  // offsets. P(ovulation <= d) averages P(next start <= d + offset).
  const latestDay = Math.ceil(upperOnset) - lutealDays.min;
  for (let day = 0; day <= latestDay; day++) {
    let sum = 0;
    for (let offset = lutealDays.min; offset <= lutealDays.max; offset++) {
      sum += calCdf(distribution, day + offset + 0.5); // Round modeled onset to a calendar day.
    }
    const probability = sum / offsetCount;
    if (day === 0 && probability >= lowerPercentile) return null;
    if (firstDay === null && probability >= lowerPercentile) firstDay = day;
    if (firstDay !== null && probability >= upperPercentile) {
      return { from: addDays(start, firstDay), to: addDays(start, day) };
    }
  }
  return null;
}

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
  const preliminary = lengths.length < MIN_INTERVALS;
  if (preliminary && lengths.some((length) => length < preliminaryDays.min || length > preliminaryDays.max)) {
    return { status: 'abstained', reason: 'unusual-interval' };
  }

  const distribution = predictive(preliminary ? personalState([], params) : state, params);
  const upperOnset = calQuantile(distribution, upperPercentile);
  return {
    status: 'forecast', basis: preliminary ? 'preliminary' : 'history',
    expected: addDays(last, Math.round(calQuantile(distribution, 0.5))),
    from: addDays(last, Math.ceil(calQuantile(distribution, lowerPercentile))),
    to: addDays(last, Math.floor(upperOnset)),
    ovulation: estimateOvulation(distribution, last, upperOnset),
  };
}

export function currentForecast(forecast: Forecast, today: string) {
  return forecast.status === 'forecast' && forecast.to < today ? { status: 'expired' } as const : forecast;
}

export function estimateCyclePhases(forecast: CycleForecast | null, start: string, recordedEnd: string | null) {
  if (!forecast?.ovulation) return null;
  const { ovulation } = forecast;
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
