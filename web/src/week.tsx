import { periodOnDay } from './cycle.ts';
import { addDays, formatDay } from './dates.ts';
import type { ForecastRange } from './forecast.ts';
import type { Period } from './model.ts';

export function WeekStrip({ today, periods, range, suggestedEnd, disabled, select }: {
  today: string; periods: Period[]; range: ForecastRange | null; suggestedEnd: string | null;
  disabled: boolean; select: (day: string) => void;
}) {
  return <div className="mt-[clamp(1rem,3vw,1.7rem)] grid grid-cols-7 gap-[clamp(2px,1vw,.65rem)]" role="group" aria-label="Seven days around today">
    {Array.from({ length: 7 }, (_, index) => addDays(today, index - 3)).map((day) => {
      const period = periodOnDay(periods, day, today);
      const confirmed = !!(period?.endDate || period?.startDate === day);
      const suggested = !confirmed && day === suggestedEnd;
      const estimated = !confirmed && !suggested && !!range && day >= range.from && day <= range.to;
      const status = confirmed ? 'confirmed period' : suggested ? 'suggested period end' : estimated ? 'estimated start range' : '';
      const dateStyle = confirmed ? 'rounded-full border-transparent bg-lavender text-plum'
        : suggested ? 'rounded-[.38rem] border-transparent bg-apricot text-plum'
        : estimated ? 'rounded-full border-dashed border-lavender text-surface' : 'rounded-full border-transparent text-surface';
      return <button key={day} type="button" disabled={disabled} aria-current={day === today ? 'date' : undefined}
        aria-label={[formatDay(day, { weekday: 'long', month: 'long', day: 'numeric' }), status].filter(Boolean).join(', ')}
        className="relative grid justify-items-center gap-[.14rem] rounded-[.65rem] border-[#9a7997] bg-[#452e48] px-0 py-[.28rem]
          text-[clamp(.64rem,2.75vw,.79rem)] text-journal-ink enabled:hover:bg-[#573958] aria-[current=date]:border-apricot
          aria-[current=date]:[&>span:first-child]:font-[750] aria-[current=date]:[&>span:first-child]:text-apricot"
        onClick={() => select(day)}>
        <span>{formatDay(day, { weekday: 'short' })}</span>
        <span className={`grid aspect-square w-[min(100%_-_4px,1.85rem)] place-items-center border text-[clamp(.78rem,3.3vw,1rem)] font-[650] ${dateStyle}`}>{Number(day.slice(-2))}</span>
      </button>;
    })}
  </div>;
}
