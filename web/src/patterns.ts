import { addDays } from './dates.ts';
import { symptomLabels, type DailyLog, type Period, type Symptom } from './model.ts';

export type PatternDay = { date: string; symptoms?: readonly Symptom[] };
export type PatternWindow = { start: string; days: PatternDay[] };
export type PatternState = 'logged' | 'check-in' | 'untracked';

export function patternState(days: readonly PatternDay[], symptom: Symptom): PatternState {
  if (days.some((day) => day.symptoms?.includes(symptom))) return 'logged';
  return days.some((day) => day.symptoms !== undefined) ? 'check-in' : 'untracked';
}

export function prePeriodPatterns(periods: readonly Period[], logs: readonly DailyLog[]) {
  const starts = [...new Set(periods.map(({ startDate }) => startDate))].sort();
  const first = Math.max(0, starts.length - 4);
  const byDate = new Map(logs.map((log) => [log.day, log.symptoms ?? []]));
  const windows: PatternWindow[] = starts.slice(first).map((start, index) => {
    const previous = starts[first + index - 1];
    // If starts are close together, each day belongs only to the next start.
    const days = [addDays(start, -2), addDays(start, -1)]
      .filter((date) => !previous || date >= previous)
      .map((date) => ({ date, symptoms: byDate.get(date) }));
    return { start, days };
  });
  const ranked = (Object.keys(symptomLabels) as Symptom[]).map((symptom) => ({
    symptom,
    count: windows.filter(({ days }) => patternState(days, symptom) === 'logged').length,
  })).filter(({ count }) => count >= 2).sort((a, b) => b.count - a.count);

  return {
    windows,
    ranked,
    checked: windows.filter(({ days }) => days.some((day) => day.symptoms !== undefined)).length,
  };
}
