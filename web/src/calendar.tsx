import { useRef } from 'react';
import { addDays, formatDay, shiftMonth, utcDate } from './dates.ts';
import { periodOnDay } from './cycle.ts';
import { forecastLabel, type CalendarPhase, type ForecastRange } from './forecast.ts';
import type { Tracker } from './model.ts';

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayDot = 'inline-block size-[5px] rounded-full bg-current';
const phaseStyle = {
  Follicular: 'border-transparent bg-lavender enabled:hover:bg-[#e5daef]',
  Ovulation: 'border-transparent bg-[#f4dce8] enabled:hover:bg-[#eecddd]',
  Luteal: 'border-transparent bg-[#f3e6d7] enabled:hover:bg-[#ecdac5]',
};
const dayStyle = {
  confirmed: 'border-plum bg-plum text-surface enabled:hover:bg-[#513454]',
  suggested: 'border-transparent bg-apricot enabled:hover:bg-[#ffe7d7]',
  predicted: 'border-dashed border-control bg-surface enabled:hover:bg-lavender',
};

export function Calendar({ tracker, today, range, phaseOnDay, ovulationWindow, suggestedEnd, selected, select, disabled }: {
  tracker: Tracker; today: string; range: ForecastRange | null;
  phaseOnDay: (day: string) => CalendarPhase | undefined; ovulationWindow?: { from: string; to: string }; suggestedEnd: string | null;
  selected: string; select: (day: string) => void; disabled: boolean;
}) {
  const keyDialog = useRef<HTMLDialogElement>(null);
  const month = selected.slice(0, 7) + '-01';
  const nextMonth = shiftMonth(month, 1);
  const offset = utcDate(month).getUTCDay();
  const monthLabel = formatDay(month, { month: 'long', year: 'numeric' });
  const loggedDays = new Set(tracker.dailyLogs.map(({ day }) => day));
  const rangeLabel = range?.basis === 'preliminary' ? 'Preliminary start range' : 'Estimated start range';
  const cells = Array.from({ length: utcDate(addDays(nextMonth, -1)).getUTCDate() }, (_, index) => {
    const day = addDays(month, index);
    const period = periodOnDay(tracker.periods, day, today);
    const recorded = !!(period?.endDate || period?.startDate === day);
    const suggested = !recorded && day === suggestedEnd;
    const predicted = !recorded && !suggested && range && range.from <= day && day <= range.to;
    const phase = recorded || suggested || predicted ? undefined : phaseOnDay(day);
    return { day, recorded, suggested, predicted, phase, logged: loggedDays.has(day) };
  });

  function move(amount: number) {
    const target = shiftMonth(month, amount);
    select(target.slice(0, 7) === today.slice(0, 7) ? today : target);
  }

  const visiblePhases = new Set(cells.flatMap(({ phase }) => phase ? [phase] : []));
  const keyItems = [
    ['Confirmed period', dayStyle.confirmed], ['Suggested end', dayStyle.suggested], [rangeLabel, dayStyle.predicted],
    ...Array.from(visiblePhases, (phase) => [`Estimated ${phase.toLowerCase()}`, phaseStyle[phase]]),
  ];

  return (
    <section className="journal-card" aria-label="Cycle calendar">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 aria-live="polite">{monthLabel}</h2>
        <div className="flex gap-1">
          <button className="quiet grid min-w-[44px] place-items-center p-0" type="button" disabled={disabled} aria-label="Previous month" onClick={() => move(-1)}>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <button className="quiet grid min-w-[44px] place-items-center p-0" type="button" disabled={disabled} aria-label="Next month" onClick={() => move(1)}>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m9 18 6-6-6-6" /></svg>
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {weekdays.map((label) => <span className="pb-2 text-center text-xs font-semibold text-muted" key={label}>{label}</span>)}
        {Array.from({ length: offset }, (_, index) => <span key={'blank-' + index} />)}
        {cells.map(({ day, recorded, suggested, predicted, phase, logged }) => {
          const status = recorded ? 'confirmed period' : suggested ? 'suggested period end'
            : predicted ? `${rangeLabel}${range?.basis === 'preliminary' ? ', low confidence' : ''}`
            : phase ? `estimated ${phase.toLowerCase()}, low confidence` : '';
          const appearance = recorded ? dayStyle.confirmed : suggested ? dayStyle.suggested : predicted ? dayStyle.predicted
            : phase ? phaseStyle[phase] : 'border-transparent bg-transparent';
          return (
            <button key={day} type="button" disabled={disabled} aria-pressed={selected === day} aria-current={day === today ? 'date' : undefined}
              aria-label={[formatDay(day, { month: 'long', day: 'numeric', year: 'numeric' }), status, logged && 'daily log'].filter(Boolean).join(', ')}
              className={`relative min-h-[clamp(44px,5vw,58px)] p-0 text-sm tabular-nums aria-pressed:outline-2
                aria-pressed:not-focus-visible:-outline-offset-3 focus-visible:outline-dashed focus-visible:outline-offset-1
                aria-[current=date]:[&>span:first-child]:underline aria-[current=date]:[&>span:first-child]:underline-offset-4
                ${recorded ? 'aria-pressed:not-focus-visible:outline-surface' : 'aria-pressed:outline-plum'} ${appearance}`}
              onClick={() => select(day)}>
              <span>{Number(day.slice(8))}</span>
              {logged && <span className={`${dayDot} absolute right-1.5 bottom-1.5`} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 border-t border-rule pt-1.5">
        <p className="text-xs text-muted">Select a day for details.</p>
        <button className="quiet flex items-center gap-1.5 px-1.5 text-sm" type="button" aria-haspopup="dialog" onClick={() => keyDialog.current?.showModal()}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="7.5" /><path d="M10 9v5m0-8v1" /></svg>
          Calendar key
        </button>
      </div>
      <dialog ref={keyDialog} aria-labelledby="calendar-key-heading"
        className="max-h-[calc(100dvh_-_2rem)] w-[min(100%_-_2rem,26rem)] rounded-2xl border border-rule bg-paper p-5 text-plum shadow-[0_18px_60px_#321c3540] backdrop:bg-[#321c356b]"
        onClick={(event) => { if (event.target === event.currentTarget) {
          const { top, right, bottom, left } = event.currentTarget.getBoundingClientRect();
          if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) event.currentTarget.close();
        } }}>
        <form method="dialog" className="flex items-center justify-between gap-2">
          <h2 id="calendar-key-heading">Calendar key</h2>
          <button className="quiet text-sm" type="submit">Close</button>
        </form>
        <ul className="m-0 grid list-none gap-2.5 px-0 py-3 text-sm">
          {keyItems.map(([label, style]) => <li key={label} className="flex items-center gap-2.5">
            <span className={`size-4 rounded border ${style}`} aria-hidden="true" />{label}
          </li>)}
          <li className="flex items-center gap-2.5"><span className="grid size-4 place-items-center" aria-hidden="true"><i className={dayDot} /></span>Daily log</li>
        </ul>
        {ovulationWindow && <div className="border-t border-rule pt-3 text-sm text-muted">
          <p><strong>Estimated ovulation window:</strong> {forecastLabel(ovulationWindow)}. The grid shows only the top-ranked phase for each day, not the full ovulation window.</p>
          <p className="mt-2">Phase estimates are low confidence. Period dates can’t confirm ovulation. Not for contraception.</p>
        </div>}
        {range?.basis === 'preliminary' && <p className="mt-3 text-sm text-muted">The preliminary start range is based on typical cycle lengths, not your own history.</p>}
      </dialog>
    </section>
  );
}
