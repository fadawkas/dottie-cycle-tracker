import { addDays, formatDay, shiftMonth, utcDate } from './dates.ts';
import { periodOnDay } from './cycle.ts';
import type { ForecastRange } from './forecast.ts';
import type { Tracker } from './model.ts';

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function Calendar({ tracker, today, range, suggestedEnd, selected, select, disabled }: {
  tracker: Tracker; today: string; range: ForecastRange | null; suggestedEnd: string | null;
  selected: string; select: (day: string) => void; disabled: boolean;
}) {
  const month = selected.slice(0, 7) + '-01';
  const nextMonth = shiftMonth(month, 1);
  const offset = utcDate(month).getUTCDay();
  const monthLabel = formatDay(month, { month: 'long', year: 'numeric' });
  const cells = Array.from({ length: utcDate(addDays(nextMonth, -1)).getUTCDate() }, (_, index) => addDays(month, index));
  const loggedDays = new Set(tracker.dailyLogs.map(({ day }) => day));

  function move(amount: number) {
    const target = shiftMonth(month, amount);
    select(target.slice(0, 7) === today.slice(0, 7) ? today : target);
  }

  return (
    <section className="journal-card calendar" aria-label="Cycle calendar">
      <div className="calendar-toolbar">
        <button type="button" disabled={disabled} aria-label="Previous month" onClick={() => move(-1)}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <h2 aria-live="polite">{monthLabel}</h2>
        <button type="button" disabled={disabled} aria-label="Next month" onClick={() => move(1)}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      </div>
      <div className="calendar-grid">
        {weekdays.map((label) => <span className="weekday" key={label}>{label}</span>)}
        {Array.from({ length: offset }, (_, index) => <span key={'blank-' + index} />)}
        {cells.map((day) => {
          const period = periodOnDay(tracker.periods, day, today);
          const recorded = !!(period?.endDate || period?.startDate === day);
          const suggested = !recorded && day === suggestedEnd;
          const predicted = !recorded && !suggested && !!range && range.from <= day && day <= range.to;
          const logged = loggedDays.has(day);
          const status = [recorded && 'confirmed period', suggested && 'suggested period end', predicted && 'estimated start range', logged && 'daily log'].filter(Boolean);
          return (
            <button key={day} type="button" disabled={disabled} aria-pressed={selected === day} aria-current={day === today ? 'date' : undefined}
              aria-label={[formatDay(day, { month: 'long', day: 'numeric', year: 'numeric' }), ...status].join(', ')}
              className={'calendar-day' + (recorded ? ' recorded' : suggested ? ' suggested' : predicted ? ' estimated' : '')}
              onClick={() => select(day)}>
              <span>{Number(day.slice(8))}</span>
              {logged && <span className="day-dot" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <div className="legend">
        <span><i className="recorded" /> Confirmed period</span>
        <span><i className="suggested" /> Suggested end</span>
        <span><i className="estimated" /> Estimated start range</span>
        <span><i className="day-dot" /> Daily log</span>
      </div>
    </section>
  );
}
