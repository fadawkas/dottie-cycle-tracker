import { formatDay } from './dates.ts';
import { forecastLabel, MIN_INTERVALS, type currentForecast, type estimateCyclePhases } from './forecast.ts';
import type { Period } from './model.ts';

export function CycleOutlook({ forecast, period, phases, suggestedEnd, startCount }: {
  forecast: ReturnType<typeof currentForecast>; period?: Period; phases: ReturnType<typeof estimateCyclePhases>;
  suggestedEnd: string | null; startCount: number;
}) {
  const range = forecast.status === 'forecast' ? forecast : null;
  const minStarts = MIN_INTERVALS + 1;
  const unavailable = forecast.status === 'insufficient-history' ? 'Log a period start in Calendar to see a preliminary range.'
    : forecast.status === 'expired' ? 'The last estimated range has passed. Log your next start when it happens.'
    : 'No reliable range. Recent starts are too far apart, close together, or variable for this estimate.';

  return <section className="journal-card" aria-labelledby="outlook-heading">
    <h2 id="outlook-heading">Cycle outlook</h2>
    <p className="mt-2 font-[650]">Estimated next period start</p>
    {range ? <>
      <p className="my-1 text-[clamp(1.5rem,5.5vw,2.35rem)] leading-tight font-[750] tracking-[-.035em]">{forecastLabel(range)}</p>
      {range.basis === 'preliminary'
        ? <p className="text-muted"><strong>Low confidence</strong> · Based on a population model, not your personal cycle history. Your next period could start outside this window.</p>
        : <p className="text-muted"><strong>Based on your history</strong> · The dates can still shift.</p>}
    </> : <p className="text-muted">{unavailable}</p>}
    {startCount > 0 && startCount < minStarts && <p className="mt-2 text-sm text-muted">
      {startCount} of {minStarts} period starts logged. You can add past starts in Calendar.
    </p>}

    {period && <>
      {phases && <p className="mt-3 text-sm text-muted"><strong>Low confidence for phase dates.</strong>{' '}
        {range?.basis === 'preliminary' && 'Based on typical timing, not your personal history. '}
        Period dates can’t confirm ovulation. Not for contraception.
      </p>}
      <dl className="mt-3 divide-y divide-rule border-t border-rule [&>div]:grid [&>div]:gap-1 [&>div]:py-2.5 [&_dt]:font-[700] [&_dd]:m-0 [&_dd]:text-muted">
        <div>
          <dt>Menstruation</dt>
          <dd>{period.endDate
            ? <>Recorded: {forecastLabel({ from: period.startDate, to: period.endDate })}</>
            : <>Recorded start: {formatDay(period.startDate)}. End not {period.endUnknown ? 'known' : 'confirmed'}.</>}
            {suggestedEnd && <> Suggested end: {formatDay(suggestedEnd)}.</>}
          </dd>
        </div>
        {phases && <>
          <div>
            <dt>Follicular</dt>
            <dd>Starts with menstruation. Estimated end: {forecastLabel(phases.follicularEnd)}.</dd>
          </div>
          <div>
            <dt>Ovulation</dt>
            <dd>Estimated timing: {forecastLabel(phases.ovulation)}.</dd>
          </div>
          <div>
            <dt>Luteal</dt>
            <dd>Estimated start: {forecastLabel(phases.lutealStart)}. Estimated end: {forecastLabel(phases.lutealEnd)}.</dd>
          </div>
        </>}
      </dl>
      {!phases && <p className="mt-2 text-sm text-muted">Timing is too uncertain to show follicular, ovulation, and luteal dates for this cycle.</p>}
    </>}
  </section>;
}
