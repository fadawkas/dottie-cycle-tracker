import { daysBetween, formatDay } from './dates.ts';
import { symptomLabels, type DailyLog, type Period, type Symptom, type Tracker } from './model.ts';
import { patternState, prePeriodPatterns, type PatternState, type PatternWindow } from './patterns.ts';
import './insights.css';

const shortDate = { month: 'short', day: 'numeric' } as const;
const fullDate = { ...shortDate, year: 'numeric' } as const;
const statusLabels: Record<PatternState, string> = {
  logged: 'Symptom logged',
  'check-in': 'Check-in; symptom not logged',
  untracked: 'No check-in',
};

function Chevron() {
  return <svg className="insight-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

function Mark({ state }: { state: PatternState }) {
  return <span className="pattern-mark" data-state={state} aria-hidden="true" />;
}

function PatternDates({ windows, symptom }: { windows: PatternWindow[]; symptom: Symptom }) {
  return <ul className="pattern-windows">
    {windows.map(({ start, days }) => <li className="pattern-window" key={start}>
      <p>Period started <strong><time dateTime={start}>{formatDay(start, fullDate)}</time></strong></p>
      <ul className="pattern-days">
        {days.map((day) => {
          const state = patternState([day], symptom);
          return <li key={day.date}>
            <time dateTime={day.date}>{formatDay(day.date, shortDate)}</time>
            <span><Mark state={state} />{statusLabels[state]}</span>
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

  return <section className="journal-feature pattern-hero" aria-labelledby="pattern-title">
    <div className="pattern-lead">
      <div>
        <h2 id="pattern-title">{first ? <><em>{symptomLabels[first.symptom]}</em> logged before {first.count} of your last {total} period starts</> : emptyTitle}</h2>
        <p>{first ? 'Looking at the two days before each recorded start.' : emptyCopy}</p>
        {!first && <button className="journal-action pattern-action" onClick={openCalendar}>Open Calendar</button>}
      </div>
      <img className="journal-art insight-art" src="/cycle-leaves.svg" width="342" height="268" alt="" />
    </div>
    {first && <div className="pattern-evidence">
      <h3>Period starts reviewed</h3>
      <ul className="pattern-tiles">
        {windows.map(({ start, days }) => {
          const state = patternState(days, first.symptom);
          return <li key={start} data-state={state}>
            <Mark state={state} />
            <time dateTime={start}>{formatDay(start, shortDate)}</time>
            <span className="insight-sr-only">{statusLabels[state]}</span>
          </li>;
        })}
      </ul>
      <ul className="pattern-key" aria-label="Date tile key">
        <li><Mark state="logged" />Symptom logged</li>
        <li><Mark state="check-in" />Other check-in</li>
        <li><Mark state="untracked" />No check-in</li>
      </ul>
      <details className="pattern-detail">
        <summary className="journal-action pattern-action"><span className="pattern-closed">See the dates</span><span className="pattern-open">Hide dates</span><Chevron /></summary>
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
  ))}</dl> : <p className="muted">Symptoms you log will be counted here.</p>;
}

function CycleHistory({ periods }: { periods: Period[] }) {
  const latest = periods[0];
  return <section className="journal-card insight-panel" aria-labelledby="history-heading">
    <h2 id="history-heading">Cycle history</h2>
    {latest ? <>
      <p className="insight-latest"><time dateTime={latest.startDate}>{formatDay(latest.startDate, { month: 'long', day: 'numeric' })}</time></p>
      <p className="muted">Most recent recorded start · {latest.startDate.slice(0, 4)}</p>
      <details className="insight-disclosure">
        <summary>View cycle timeline <Chevron /></summary>
        <p className="muted">Up to 12 starts. Cycle length is the time between starts; duration uses confirmed ends only.</p>
        <table className="timeline">
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
    </> : <p className="muted">Your recorded period dates will appear here.</p>}
  </section>;
}

export function Insights({ tracker, openCalendar }: { tracker: Tracker; openCalendar: () => void }) {
  const periods = [...tracker.periods].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const report = prePeriodPatterns(periods, tracker.dailyLogs);
  const otherPatterns = report.ranked.slice(1);
  return <div className="insights-page">
    <div className="page-intro journal-intro">
      <h1>Insights</h1>
      <p>What shows up in your cycle notes.</p>
    </div>
    <PatternCard report={report} openCalendar={openCalendar} />
    <div className="insight-panels">
      <section className="journal-card insight-panel" aria-labelledby="symptoms-heading">
        <h2 id="symptoms-heading">{otherPatterns.length ? 'Also repeated' : 'Symptom totals'}</h2>
        {otherPatterns.length ? <>
          <p className="muted">Other symptoms logged before more than one period start.</p>
          <div className="insight-related">
            {otherPatterns.map(({ symptom, count }) => <details className="insight-disclosure insight-related-row" key={symptom}>
              <summary><strong>{symptomLabels[symptom]}</strong><span>{count} of {report.windows.length} starts</span><Chevron /></summary>
              <PatternDates windows={report.windows} symptom={symptom} />
            </details>)}
          </div>
          <details className="insight-disclosure"><summary>All symptom totals <Chevron /></summary><SymptomTotals logs={tracker.dailyLogs} /></details>
        </> : <SymptomTotals logs={tracker.dailyLogs} />}
        <p className="insight-note">An unlogged symptom doesn’t mean it wasn’t present.</p>
      </section>
      <CycleHistory periods={periods} />
    </div>
    <details className="insight-disclosure insight-method" id="forecast-method">
      <summary>How your forecast works <Chevron /></summary>
      <p className="muted">Only your period start dates go into the estimate. Dottie needs at least four starts to estimate when your next period might begin. Daily logs and period end dates don’t change that estimate.</p>
      <p className="muted">The Dochia model runs in your browser. It doesn’t predict ovulation and isn’t for contraception. <a href="/licenses/dochia.txt">Model license (MIT)</a></p>
    </details>
  </div>;
}
