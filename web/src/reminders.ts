import { daysBetween } from './dates.ts';
import type { ForecastRange } from './forecast.ts';
import type { Settings } from './model.ts';

export type Reminder = 'check-in' | 'upcoming-period' | 'confirm-end';

export function remindersForToday({ today, settings, hasDailyLog, hasOpenPeriod, suggestedEnd, forecast }: {
  today: string; settings: Settings; hasDailyLog: boolean; hasOpenPeriod: boolean;
  suggestedEnd: string | null; forecast: ForecastRange | null;
}): Reminder[] {
  const reminders: Reminder[] = [];
  if (settings.remindEnd && hasOpenPeriod && suggestedEnd && today >= suggestedEnd) reminders.push('confirm-end');
  if (settings.remindDaily && !hasDailyLog) reminders.push('check-in');
  if (settings.remindPeriod && !hasOpenPeriod && forecast?.basis === 'history' && today <= forecast.to
    && daysBetween(today, forecast.from) <= 3) reminders.push('upcoming-period');
  return reminders;
}
