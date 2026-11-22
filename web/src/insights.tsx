import { daysBetween, formatDay } from './dates.ts';
import { symptomLabels, type DailyLog, type Period, type Symptom, type Tracker } from './model.ts';
import { patternState, prePeriodPatterns, type PatternState, type PatternWindow } from './patterns.ts';

const shortDate = { month: 'short', day: 'numeric' } as const;
const fullDate = { ...shortDate, year: 'numeric' } as const;
const statusLabels: Record<PatternState, string> = {
  logged: 'Symptom logged',
  'check-in': 'Check-in; symptom not logged',
  untracked: 'No check-in',
};

function Chevron() {
  return <svg className="flex-none group-open/disclosure:rotate-180 motion-safe:transition-transform motion-safe:duration-[160ms] motion-safe:ease-out"
    width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

function Mark({ state }: { state: PatternState }) {
  return <span className="inline-grid size-[.9rem] flex-none place-items-center before:size-[.55rem] before:rounded-full before:border-[1.5px] before:content-['']
      data-[state=logged]:before:bg-current
      data-[state=untracked]:before:h-0 data-[state=untracked]:before:w-[.62rem] data-[state=untracked]:before:rounded-none
      data-[state=untracked]:before:border-x-0 data-[state=untracked]:before:border-b-0 in-[.journal-feature]:data-[state=logged]:text-apricot"
    data-state={state} aria-hidden="true" />;
}

function PatternDates({ windows, symptom }: { windows: PatternWindow[]; symptom: Symptom }) {
  return <ul className="mx-0 mt-[.85rem] mb-0 grid list-none gap-[.65rem] p-0 not-phone:group-open/pattern:grid-cols-2 motion-safe:group-open/pattern:animate-insight-evidence">
    {windows.map(({ start, days }) => <li className="rounded-[.65rem] border border-rule px-[.8rem] py-[.68rem] text-[.85rem] in-[.journal-feature]:border-[#846483] in-[.journal-feature]:bg-[#402842]" key={start}>
      <p className="mb-[.42rem]">Period started <strong><time dateTime={start}>{formatDay(start, fullDate)}</time></strong></p>
      <ul className="m-0 list-none divide-y divide-rule p-0 in-[.journal-feature]:divide-[#765476]">
        {days.map((day) => {
          const state = patternState([day], symptom);
          return <li className="grid grid-cols-[minmax(3.4rem,max-content)_1fr] gap-2 py-[.35rem]" key={day.date}>
            <time className="whitespace-nowrap" dateTime={day.date}>{formatDay(day.date, shortDate)}</time>
            <span className="flex items-center gap-[.42rem] leading-[1.3]"><Mark state={state} />{statusLabels[state]}</span>
          </li>;
        })}
      </ul>
    </li>)}
  </ul>;
}

function PatternCard({ report, openCalendar }: {
  report: ReturnType<typeof prePeriodPatterns>; openCalendar: () => void;
}) {
  const { windows, ranked: [first], checked } = report;
  const total = windows.length;
  const emptyTitle = total === 0 ? 'Your cycle story starts here' : checked === 0 ? 'No check-ins before a start yet'
    : total === 1 ? 'One period start logged' : 'No repeat before a period yet';
  const emptyCopy = total === 0 ? 'Log a period start in Calendar. Then your check-ins can help you spot what repeats before a period.'
    : checked === 0 ? 'You can add symptoms to past dates. We look at the two days before each recorded period start.'
    : total === 1 ? 'You checked in before this start. We’ll highlight a symptom once it’s logged before at least two separate starts.'
    : `You checked in before ${checked} of ${total} recorded starts. We’ll highlight a symptom once it’s logged before at least two separate starts.`;

  return <section className="journal-feature" aria-labelledby="pattern-title">
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,.65fr)] items-center gap-[clamp(.55rem,3vw,2.5rem)]
      compact:grid-cols-[minmax(0,1fr)_minmax(0,.52fr)]
      phone:grid-cols-[minmax(0,1fr)_clamp(5.3rem,27vw,8.8rem)] phone:gap-x-2 phone:gap-y-[.65rem]">
      <div className="phone:contents">
        <h2 className="text-pretty text-[clamp(1.7rem,4.5vw,3.6rem)] leading-[1.04] tracking-[-.04em]
          compact:text-[clamp(1.55rem,4.4vw,2.1rem)] phone:[grid-area:1/1]"
          id="pattern-title">
          {first ? <><em className="text-apricot not-italic">{symptomLabels[first.symptom]}</em> logged before {first.count} of your last {total} period starts</> : emptyTitle}
        </h2>
        <p className="mt-[.8rem] text-journal-ink phone:col-span-full phone:mt-0 phone:text-[.87rem]">{first ? 'Looking at the two days before each recorded start.' : emptyCopy}</p>
        {!first && <button className="journal-action mt-[1.1rem] inline-flex items-center justify-center phone:col-span-full phone:mt-[.45rem] phone:justify-self-start" onClick={openCalendar}>Open Calendar</button>}
      </div>
      <img className="journal-art my-[clamp(-1rem,-1vw,0rem)] compact:my-0 compact:self-start phone:self-center phone:[grid-area:1/2]" src="/cycle-leaves.svg" width="342" height="268" alt="" />
    </div>
    {first && <div className="mt-[clamp(1.15rem,3vw,2rem)]">
      <h3 className="m-0 mb-[.6rem] text-[.88rem] font-[650] text-journal-ink">Period starts reviewed</h3>
      <ul className="m-0 grid auto-cols-fr grid-flow-col list-none gap-[clamp(.3rem,1vw,.65rem)] p-0">
        {windows.map(({ start, days }) => {
          const state = patternState(days, first.symptom);
          return <li className="flex min-w-0 items-center gap-[.6rem] rounded-[.65rem] border border-[#9a7997] bg-[#452e48]
              px-[.8rem] py-[.72rem] text-[.9rem] font-[670] text-surface data-[state=logged]:border-[#c59baf] data-[state=logged]:bg-[#5c3b54]
              data-[state=untracked]:border-dashed data-[state=untracked]:bg-transparent
              phone:flex-col phone:gap-[.18rem] phone:px-[.12rem] phone:py-[.48rem] phone:text-[.77rem]"
            key={start} data-state={state}>
            <Mark state={state} />
            <time className="whitespace-nowrap" dateTime={start}>{formatDay(start, shortDate)}</time>
            <span className="sr-only">{statusLabels[state]}</span>
          </li>;
        })}
      </ul>
      <ul className="m-0 mt-[.7rem] flex list-none flex-wrap gap-x-[.9rem] gap-y-[.28rem] p-0 text-[.75rem] text-journal-ink [&>li]:flex [&>li]:items-center [&>li]:gap-[.42rem] phone:gap-x-[.55rem]" aria-label="Date tile key">
        <li><Mark state="logged" />Symptom logged</li>
        <li><Mark state="check-in" />Other check-in</li>
        <li><Mark state="untracked" />No check-in</li>
      </ul>
      <details className="group/disclosure group/pattern mt-[1.15rem]">
        <summary className="journal-action inline-flex cursor-pointer list-none items-center justify-center gap-2 [&::-webkit-details-marker]:hidden"><span className="group-open/pattern:hidden">See the dates</span><span className="hidden group-open/pattern:inline">Hide dates</span><Chevron /></summary>
        <PatternDates windows={windows} symptom={first.symptom} />
      </details>
    </div>}
  </section>;
}

function SymptomTotals({ logs }: { logs: DailyLog[] }) {
  const symptoms = new Map<Symptom, number>();
  for (const log of logs) {
    for (const symptom of log.symptoms ?? []) symptoms.set(symptom, (symptoms.get(symptom) ?? 0) + 1);
  }
  const totals = [...symptoms].sort((a, b) => b[1] - a[1]);
  return totals.length ? <dl className="ranked">{totals.map(([symptom, count]) => (
    <div key={symptom}><dt>{symptomLabels[symptom]}</dt><dd>{count} {count === 1 ? 'day' : 'days'}</dd></div>
  ))}</dl> : <p className="text-muted">Symptoms you log will be counted here.</p>;
}

function CycleHistory({ periods }: { periods: Period[] }) {
  const latest = periods[0];
  return <section className="journal-card" aria-labelledby="history-heading">
    <h2 className="text-[1.24rem]" id="history-heading">Cycle history</h2>
    {latest ? <>
      <p className="mt-3 text-[clamp(1.75rem,4vw,2.6rem)] leading-[1.06] font-[750] tracking-[-.04em]"><time dateTime={latest.startDate}>{formatDay(latest.startDate, { month: 'long', day: 'numeric' })}</time></p>
      <p className="mt-[.3rem] text-muted">Most recent recorded start · {latest.startDate.slice(0, 4)}</p>
      <details className="disclosure group/disclosure mt-[.6rem] border-t border-rule">
        <summary>View cycle timeline <Chevron /></summary>
        <p className="text-muted">Up to 12 starts. Cycle length is the time between starts; duration uses confirmed ends only.</p>
        <table className="mt-[.55rem] w-full border-collapse text-left text-[.85rem] tabular-nums
          [&_tbody_th]:font-[650] [&_thead_th]:text-[.82rem] [&_thead_th]:font-bold [&_thead_th]:text-muted
          [&_:is(td,th)]:border-b [&_:is(td,th)]:border-rule [&_:is(td,th)]:py-[.65rem] [&_:is(td,th)]:pr-[.6rem]
          [&_:is(td,th)]:pl-0 [&_:is(td,th)]:align-top [&_:is(td,th):last-child]:pr-0">
          <thead><tr><th scope="col">Period start</th><th scope="col">Since last start</th><th scope="col">Duration</th></tr></thead>
          <tbody>{periods.slice(0, 12).map((period, index) => {
            const previous = periods[index + 1];
            return <tr key={period.id}>
              <th scope="row"><time dateTime={period.startDate}>{formatDay(period.startDate, fullDate)}</time></th>
              <td>{previous ? daysBetween(previous.startDate, period.startDate) + ' days' : '—'}</td>
              <td>{period.endDate ? daysBetween(period.startDate, period.endDate) + 1 + ' days' : period.endUnknown ? 'End unknown' : 'Not confirmed'}</td>
            </tr>;
          })}</tbody>
        </table>
      </details>
    </> : <p className="text-muted">Your recorded period dates will appear here.</p>}
  </section>;
}

export function Insights({ tracker, openCalendar }: { tracker: Tracker; openCalendar: () => void }) {
  const periods = [...tracker.periods].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const report = prePeriodPatterns(periods, tracker.dailyLogs);
  const otherPatterns = report.ranked.slice(1);
  return <div>
    <div className="page-intro">
      <h1>Insights</h1>
      <p>What shows up in your cycle notes.</p>
    </div>
    <PatternCard report={report} openCalendar={openCalendar} />
    <div className="mt-[clamp(.9rem,2.8vw,1.7rem)] grid grid-cols-2 items-start gap-[clamp(.85rem,2.5vw,1.5rem)] compact:grid-cols-1">
      <section className="journal-card" aria-labelledby="symptoms-heading">
        <h2 className="text-[1.24rem]" id="symptoms-heading">{otherPatterns.length ? 'Also repeated' : 'Symptom totals'}</h2>
        {otherPatterns.length ? <>
          <p className="text-muted">Other symptoms logged before more than one period start.</p>
          <div className="mt-[.52rem]">
            {otherPatterns.map(({ symptom, count }) => <details className="disclosure group/disclosure border-b border-rule last:mb-2 open:pb-[.7rem]" key={symptom}>
              <summary><strong>{symptomLabels[symptom]}</strong><span className="ml-auto text-[.82rem] font-medium text-muted">{count} of {report.windows.length} starts</span><Chevron /></summary>
              <PatternDates windows={report.windows} symptom={symptom} />
            </details>)}
          </div>
          <details className="disclosure group/disclosure"><summary>All symptom totals <Chevron /></summary><SymptomTotals logs={tracker.dailyLogs} /></details>
        </> : <SymptomTotals logs={tracker.dailyLogs} />}
        <p className="mt-3 text-[.8rem] text-muted">An unlogged symptom doesn’t mean it wasn’t present.</p>
      </section>
      <CycleHistory periods={periods} />
    </div>
    <details className="disclosure group/disclosure mt-[clamp(1rem,3vw,1.7rem)] border-t border-control" id="forecast-method">
      <summary>How your forecast works <Chevron /></summary>
      <p className="text-muted">After one period start, Dottie can show a broad, low-confidence range based on cycles of 24–38 days. From four starts, the Dochia model can use your recent start-to-start intervals. Daily logs and bleeding length don’t change the next-start estimate. Sparse or variable history can limit what’s shown.</p>
      <p className="text-muted">Phase dates use the history-based range and a general assumption about timing after ovulation. They’re calendar estimates, not evidence that ovulation happened. Estimates run in your browser and aren’t for contraception. <a href="/licenses/dochia.txt">Model license (MIT)</a></p>
    </details>
  </div>;
}
