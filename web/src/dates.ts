const DAY_MS = 86_400_000;

export function todayDate(now = new Date()) {
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
}

export function utcDate(day: string) {
  return new Date(day + 'T00:00:00Z');
}

export function addDays(day: string, count: number) {
  return new Date(utcDate(day).getTime() + count * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(start: string, end: string) {
  return (utcDate(end).getTime() - utcDate(start).getTime()) / DAY_MS;
}

export function shiftMonth(day: string, amount: number) {
  const date = utcDate(day.slice(0, 7) + '-01');
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 10);
}

export function formatDay(day: string, options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' }) {
  return utcDate(day).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' });
}
