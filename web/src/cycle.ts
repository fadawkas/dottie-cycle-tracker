import { addDays, daysBetween } from './dates.ts';
import type { Period } from './model.ts';

export function summarizeCycle(periods: Period[]) {
  const recent = [...periods].sort((a, b) => b.startDate.localeCompare(a.startDate)).slice(0, 7);
  const intervals = recent.slice(1).map((period, index) => daysBetween(period.startDate, recent[index].startDate));
  const sorted = [...intervals].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const typical = sorted.length
    ? Math.round(sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2)
    : null;
  const lastCompleted = recent.find((period) => period.endDate !== null);
  return {
    lastCycle: intervals[0] ?? null,
    lastDuration: lastCompleted?.endDate ? daysBetween(lastCompleted.startDate, lastCompleted.endDate) + 1 : null,
    nextEstimate: intervals.length >= 2 && typical ? addDays(recent[0].startDate, typical) : null,
  };
}

export function periodOnDay(periods: Period[], day: string, today: string) {
  return periods.find((period) => period.startDate <= day && day <= (period.endDate ?? (period.endUnknown ? period.startDate : today)));
}
