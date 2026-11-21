import { periodOnDay } from './cycle.ts';
import { addDays, formatDay } from './dates.ts';
import type { ForecastRange } from './forecast.ts';
import type { Period } from './model.ts';

export function WeekStrip({ today, periods, range, suggestedEnd, disabled, select }: {
  today: string; periods: Period[]; range: ForecastRange | null; suggestedEnd: string | null;
  disabled: boolean; select: (day: string) => void;
}) {
  return <div className="week-strip" role="group" aria-label="Seven days around today">
    {Array.from({ length: 7 }, (_, index) => addDays(today, index - 3)).map((day) => {
      const period = periodOnDay(periods, day, today);
      const confirmed = !!(period?.endDate || period?.startDate === day);
      const suggested = !confirmed && day === suggestedEnd;
      const estimated = !confirmed && !suggested && !!range && day >= range.from && day <= range.to;
      const status = confirmed ? 'confirmed period' : suggested ? 'suggested period end' : estimated ? 'estimated start range' : '';
      return <button key={day} type="button" disabled={disabled} aria-current={day === today ? 'date' : undefined}
        aria-label={[formatDay(day, { weekday: 'long', month: 'long', day: 'numeric' }), status].filter(Boolean).join(', ')}
        className={confirmed ? 'week-confirmed' : suggested ? 'week-suggested' : estimated ? 'week-estimated' : undefined}
        onClick={() => select(day)}>
        <span>{formatDay(day, { weekday: 'short' })}</span>
        <span className="week-date">{Number(day.slice(-2))}</span>
      </button>;
    })}
  </div>;
}
