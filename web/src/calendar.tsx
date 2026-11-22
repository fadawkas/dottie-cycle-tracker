import { addDays, formatDay, shiftMonth, utcDate } from './dates.ts';
import { periodOnDay } from './cycle.ts';
import type { ForecastRange } from './forecast.ts';
import type { Tracker } from './model.ts';

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const confirmedDay = 'border border-plum bg-plum text-surface';
const suggestedDay = 'border border-plum bg-apricot';
const estimatedDay = 'border border-dashed border-control bg-lavender';
const dayDot = 'inline-block size-[5px] rounded-full bg-current';

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
  const rangeLabel = range?.basis === 'preliminary' ? 'Preliminary start range (low confidence)' : 'Estimated start range';

  function move(amount: number) {
    const target = shiftMonth(month, amount);
    select(target.slice(0, 7) === today.slice(0, 7) ? today : target);
  }

  return (
    <section className="journal-card" aria-label="Cycle calendar">
      <div className="mb-[.65rem] flex items-center justify-between gap-[.35rem]">
        <button className="grid min-w-[44px] place-items-center p-[.4rem]" type="button" disabled={disabled} aria-label="Previous month" onClick={() => move(-1)}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <h2 aria-live="polite">{monthLabel}</h2>
        <button className="grid min-w-[44px] place-items-center p-[.4rem]" type="button" disabled={disabled} aria-label="Next month" onClick={() => move(1)}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      </div>
      <div className="grid grid-cols-7 gap-[clamp(2px,.65vw,5px)]">
        {weekdays.map((label) => <span className="py-[.3rem] text-center text-[.77rem] text-muted" key={label}>{label}</span>)}
        {Array.from({ length: offset }, (_, index) => <span key={'blank-' + index} />)}
        {cells.map((day) => {
          const period = periodOnDay(tracker.periods, day, today);
          const recorded = !!(period?.endDate || period?.startDate === day);
          const suggested = !recorded && day === suggestedEnd;
          const predicted = !recorded && !suggested && !!range && range.from <= day && day <= range.to;
          const logged = loggedDays.has(day);
          const status = [recorded && 'confirmed period', suggested && 'suggested period end', predicted && rangeLabel, logged && 'daily log'].filter(Boolean);
          const appearance = recorded ? `${confirmedDay} enabled:hover:bg-plum aria-pressed:-outline-offset-4 aria-pressed:outline-surface`
            : `${suggested ? `${suggestedDay} enabled:hover:bg-apricot` : predicted ? `${estimatedDay} enabled:hover:bg-lavender` : 'border-rule'}
              aria-pressed:not-focus-visible:-outline-offset-2 aria-pressed:outline-plum`;
          return (
            <button key={day} type="button" disabled={disabled} aria-pressed={selected === day} aria-current={day === today ? 'date' : undefined}
              aria-label={[formatDay(day, { month: 'long', day: 'numeric', year: 'numeric' }), ...status].join(', ')}
              className={`relative p-0 tabular-nums aria-pressed:outline-2 focus-visible:outline-dashed focus-visible:outline-offset-1
                aria-[current=date]:[&>span:first-child]:underline aria-[current=date]:[&>span:first-child]:underline-offset-4 ${appearance}`}
              onClick={() => select(day)}>
              <span>{Number(day.slice(8))}</span>
              {logged && <span className={`${dayDot} absolute bottom-1 left-[calc(50%-2.5px)]`} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <div className="mt-[.8rem] flex flex-wrap gap-x-[.9rem] gap-y-[.45rem] text-[.78rem] text-muted [&>span]:flex [&>span]:items-center [&>span]:gap-[.35rem]">
        <span><i className={`${confirmedDay} h-3 w-3.5`} /> Confirmed period</span>
        <span><i className={`${suggestedDay} h-3 w-3.5`} /> Suggested end</span>
        <span><i className={`${estimatedDay} h-3 w-3.5`} /> {rangeLabel}</span>
        <span><i className={dayDot} /> Daily log</span>
      </div>
    </section>
  );
}
