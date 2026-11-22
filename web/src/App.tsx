import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar } from './calendar.tsx';
import { RequestError, messageFor, request } from './client.ts';
import { periodOnDay } from './cycle.ts';
import { daysBetween, formatDay, todayDate } from './dates.ts';
import { ErrorMessage, LogEditor, PeriodEditor, useAction, type PeriodInput } from './editors.tsx';
import { forecastLabel, forecastPeriodStart, suggestedPeriodEnd } from './forecast.ts';
import { Insights } from './insights.tsx';
import type { DailyLog, Observations, Period, Settings, SetupEntry, Tracker } from './model.ts';
import { Navigation, type Tab } from './navigation.tsx';
import { remindersForToday } from './reminders.ts';
import { SettingsScreen } from './settings.tsx';
import { WeekStrip } from './week.tsx';
import { Welcome } from './welcome.tsx';

type Editor = { type: 'period' } | { type: 'log'; day: string };

const reminderText = {
  'check-in': 'Today’s daily log hasn’t been filled in.',
  'upcoming-period': 'Your estimated start range is approaching or underway.',
  'confirm-end': 'The suggested end has arrived. Confirm the date if your period ended.',
};

function Mark() {
  return <svg className="flex-none rounded-[.65rem] bg-plum text-surface" width="40" height="40" viewBox="0 0 40 40" aria-hidden="true" fill="none">
    <path d="M20 14c-3-2-6-2.5-10-1.5v15c4-1 7-.5 10 1.5 3-2 6-2.5 10-1.5v-15c-4-1-7-.5-10 1.5Zm0 0v15" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M24 12.5v8l2-1.4 2 1.4v-8.4" fill="var(--color-apricot)" />
  </svg>;
}

function SignIn({ onSignIn, notice }: { onSignIn: () => Promise<void>; notice: string }) {
  const { busy, error, run } = useAction();
  return (
    <section className="journal-card">
      <h1 className="text-[clamp(2rem,6vw,3.35rem)]">Sign in</h1>
      <p className="mt-[.45rem] text-muted">Use your private account to open your cycle journal.</p>
      <form onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void run(async () => {
          await request('/auth/sign-in/email', 'POST', { email: data.get('email'), password: data.get('password') });
          await onSignIn();
        });
      }}>
        <fieldset disabled={busy}>
          <label className="mt-4">Email<input name="email" autoComplete="username" type="email" required /></label>
          <label className="mt-4">Password<input name="password" autoComplete="current-password" type="password" required /></label>
          <button className="primary mt-5 w-full" type="submit">{busy ? 'Signing in…' : 'Sign in'}</button>
        </fieldset>
        <ErrorMessage>{error || notice}</ErrorMessage>
      </form>
    </section>
  );
}

export default function App() {
  const [today, setToday] = useState(todayDate);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [tab, setTab] = useState<Tab>('Today');
  const [selected, setSelected] = useState(today);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [tracker, setTracker] = useState<Tracker | undefined | null>(undefined);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const periodTrigger = useRef<HTMLButtonElement>(null);
  const logTrigger = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef<Editor['type'] | null>(null);
  const main = useRef<HTMLElement>(null);
  const screen = tracker === undefined ? 'loading' : tracker === null ? 'sign-in' : tracker.onboardingComplete ? tab : 'welcome';
  const ready = !!tracker?.onboardingComplete;

  useEffect(() => {
    if (screen !== 'loading') {
      window.scrollTo(0, 0);
      main.current?.focus({ preventScroll: true });
    }
  }, [screen]);

  useEffect(() => {
    if (editor || !restoreFocus.current) return;
    const trigger = restoreFocus.current === 'period' ? periodTrigger : logTrigger;
    restoreFocus.current = null;
    trigger.current?.focus();
  }, [editor]);

  async function load() {
    setLoadError('');
    try {
      setTracker(await request<Tracker>('/tracker'));
    } catch (error) {
      if (error instanceof RequestError && error.status === 401) setTracker(null);
      else setLoadError(messageFor(error));
    }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function refreshDay() {
      clearTimeout(timer);
      const now = new Date();
      setToday(todayDate(now));
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(refreshDay, midnight.getTime() - now.getTime());
    }
    const refreshConnection = () => setOnline(navigator.onLine);
    refreshDay();
    window.addEventListener('focus', refreshDay);
    window.addEventListener('online', refreshConnection);
    window.addEventListener('offline', refreshConnection);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', refreshDay);
      window.removeEventListener('online', refreshConnection);
      window.removeEventListener('offline', refreshConnection);
    };
  }, []);

  function switchTab(next: Tab) {
    if (next === tab) return;
    setTab(next);
    setEditor(null);
    setNotice('');
    if (next === 'Calendar') setSelected(today);
  }

  function calendarDay(date: string) {
    switchTab('Calendar');
    setSelected(date);
  }

  function open(next: Editor) {
    setEditor(next);
    setNotice('');
  }

  function close(message = '') {
    restoreFocus.current = editor?.type ?? null;
    setEditor(null);
    setNotice(message);
  }

  async function action<T>(path: string, method: string, payload?: object): Promise<T> {
    setSaving(true);
    try {
      return await request<T>(path, method, payload);
    } catch (error) {
      if (error instanceof RequestError && error.status === 401) {
        setTracker(null);
        setEditor(null);
        setNotice('Your session ended. Please sign in again.');
      }
      throw error;
    } finally {
      setSaving(false);
    }
  }

  const day = tab === 'Today' ? today : selected;
  const period = tracker ? periodOnDay(tracker.periods, day, today) : undefined;
  const dailyLog = tracker?.dailyLogs.find((log) => log.day === day);

  async function savePeriod(input: PeriodInput) {
    const saved = await action<Period>(period ? '/periods/' + period.id : '/periods', period ? 'PUT' : 'POST', input);
    setTracker((state) => state && { ...state, periods: [...state.periods.filter((item) => item.id !== saved.id), saved] });
    close('Period saved.');
    if (tab === 'Calendar' && period && saved.startDate !== period.startDate) setSelected(saved.startDate);
  }

  async function removePeriod() {
    if (!period) return;
    await action('/periods/' + period.id, 'DELETE');
    setTracker((state) => state && { ...state, periods: state.periods.filter((item) => item.id !== period.id) });
    close('Period deleted.');
  }

  async function saveLog(logDay: string, details: Observations) {
    const saved = await action<DailyLog>('/daily-logs/' + logDay, 'PUT', details);
    setTracker((state) => state && { ...state, dailyLogs: [...state.dailyLogs.filter((item) => item.day !== logDay), saved] });
    close('Daily log saved.');
  }

  async function removeLog(logDay: string) {
    await action('/daily-logs/' + logDay, 'DELETE');
    setTracker((state) => state && { ...state, dailyLogs: state.dailyLogs.filter((item) => item.day !== logDay) });
    close('Daily log deleted.');
  }

  async function saveSettings(settings: Settings) {
    const saved = await action<Settings>('/settings', 'PUT', settings);
    setTracker((state) => state && { ...state, settings: saved });
  }

  async function clear() {
    setTracker(await action<Tracker>('/tracker', 'DELETE'));
    setTab('Today');
    setEditor(null);
    setNotice('Tracking data deleted.');
  }

  async function completeSetup(entry: SetupEntry) {
    setTracker(await action<Tracker>('/setup', 'POST', entry));
    setTab('Today');
    setEditor(null);
    setNotice('First entry saved.');
  }

  async function signOut() {
    await action('/auth/sign-out', 'POST', {});
    setTracker(null);
    setTab('Today');
    setNotice('');
  }

  const periods = tracker?.periods;
  const forecast = useMemo(() => forecastPeriodStart(periods?.map(({ startDate }) => startDate) ?? []), [periods]);
  const range = forecast.status === 'forecast' && forecast.to >= today ? forecast : null;
  const active = periods?.find((entry) => entry.endDate === null && !entry.endUnknown && entry.startDate <= today);
  const suggestedEnd = active && tracker ? suggestedPeriodEnd(active.startDate, tracker.settings.typicalPeriodDays) : null;
  const confirmDue = !!suggestedEnd && suggestedEnd <= today;
  const recorded = !!(period?.endDate || period?.startDate === day);
  const selectedInForecast = range && range.from <= day && day <= range.to;
  const reminders = tracker ? remindersForToday({
    today, settings: tracker.settings, hasDailyLog: !!dailyLog, hasOpenPeriod: !!active, suggestedEnd, forecast: range,
  }) : [];
  const primaryIsLog = tab === 'Today' && !!period && (!active || (!!suggestedEnd && !confirmDue));
  const periodLabel = tab === 'Today' && active ? (confirmDue ? 'Confirm end' : 'Log end date') : period ? 'Edit period' : 'Log period';
  const logLabel = dailyLog ? 'Edit daily log' : tab === 'Today' ? 'Log today' : 'Add daily log';
  const forecastCopy = forecast.status === 'insufficient-history' ? 'Log four period starts to see an estimated range.'
    : forecast.status === 'abstained' ? 'No reliable estimate right now. Recent intervals are too variable or have gaps.'
    : 'The last estimated range has passed. Log your next start when it happens.';

  const periodButton = (style = '') => <button className={style} ref={periodTrigger} type="button"
    aria-expanded={editor?.type === 'period'} onClick={() => !saving && open({ type: 'period' })}>{periodLabel}</button>;
  const logButton = (style = '') => <button className={style} ref={logTrigger} type="button"
    aria-haspopup="dialog" onClick={() => !saving && open({ type: 'log', day })}>{logLabel}</button>;

  const periodEditor = tracker && editor?.type === 'period' && <PeriodEditor key={'period-' + day} period={period} day={day} today={today}
    typicalDays={tracker.settings.typicalPeriodDays} save={savePeriod} remove={removePeriod} close={() => close()} />;
  const logDay = editor?.type === 'log' ? editor.day : null;

  return (
    <div className="mx-auto w-[min(100%_-_max(clamp(32px,8vw,112px),calc(2_*_max(env(safe-area-inset-left,0px),env(safe-area-inset-right,0px)))),1100px)]
      pt-[env(safe-area-inset-top,0px)] compact:[&:has(input:focus,textarea:focus,select:focus)_nav]:invisible">
      <a className="absolute top-2 left-2 z-1 -translate-y-[200%] focus:translate-y-0 focus:bg-surface focus:p-[.6rem]" href="#main">Skip to content</a>
      <header className="flex min-h-[76px] items-center border-b border-rule py-2 compact:min-h-[62px]">
        <div className="flex items-center gap-3">
          <Mark />
          <div className="grid gap-[.2rem]">
            <span className="text-xl leading-[1.1] font-[750] tracking-[-.035em]">Dottie</span>
            <span className="text-xs leading-[1.3] text-muted">Period &amp; symptom journal</span>
          </div>
        </div>
      </header>
      <main ref={main} id="main" tabIndex={-1}
        className={!tracker ? 'm-auto max-w-[420px] pt-[clamp(2.25rem,9vw,6rem)]'
          : ready ? 'pt-[clamp(1rem,3vw,2rem)] pb-[calc(7rem+env(safe-area-inset-bottom,0px))]' : ''}>
        {!online && <p role="status" className="mb-5 bg-apricot p-4">You’re offline. Reconnect to save or refresh your journal.</p>}
        {tracker === undefined && (loadError ? <div>
          <h1 className="text-[clamp(2rem,6vw,3.35rem)]">Journal unavailable</h1>
          <ErrorMessage>{loadError}</ErrorMessage>
          <button onClick={() => void load()}>Try again</button>
        </div> : <p role="status">Opening your journal…</p>)}
        {tracker === null && <SignIn onSignIn={load} notice={loadError || notice} />}

        {tracker && !ready && <Welcome today={today} complete={completeSetup} signOut={signOut} />}

        {tracker && ready && tab === 'Today' && <>
          <div className="page-intro">
            <h1>Today</h1>
            <p>{formatDay(today, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          </div>
          <div className="grid items-start gap-[clamp(.9rem,2.8vw,1.7rem)]">
            <section className="journal-feature" aria-labelledby="today-status-heading">
              <div className="journal-split">
                <div>
                  <h2 className="journal-title" id="today-status-heading">{active ? `Day ${daysBetween(active.startDate, today) + 1}`
                    : range ? forecastLabel(range) : period ? 'Period logged' : 'Track your cycle'}</h2>
                  <p>{active ? 'Since your recorded start · end not confirmed' : range ? 'Estimated next start · not a recorded date' : forecastCopy}</p>
                  {active && suggestedEnd && <p className="text-apricot">Suggested end: {formatDay(suggestedEnd)}</p>}
                  <div className="hero-actions">
                    {primaryIsLog ? <>{logButton('journal-action')}{periodButton('hero-secondary')}</> : periodButton('journal-action')}
                  </div>
                </div>
                <img className="journal-art not-phone:-my-4" src="/day-notes.svg" width="342" height="268" alt="" />
              </div>
              <WeekStrip today={today} periods={tracker.periods} range={range} suggestedEnd={suggestedEnd}
                disabled={saving} select={calendarDay} />
            </section>
            <div className="grid items-start gap-[clamp(.9rem,2.8vw,1.7rem)]
              not-compact:has-[aside]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
              <section className="journal-card" aria-labelledby="today-log">
                <h2 id="today-log">Daily check-in</h2>
                <p className="text-muted">{dailyLog ? 'Today’s log is saved. You can edit it anytime.' : 'Record bleeding, symptoms, or anything else you’re tracking.'}</p>
                {!primaryIsLog && <div className="actions">{logButton('primary')}</div>}
                {periodEditor}
              </section>
              {(active || reminders.length > 0) && <aside className="grid gap-[.85rem]" aria-label="Cycle information">
                {active && <section className="journal-card" aria-labelledby="forecast-title">
                  <h2 className="text-[1.19rem] tracking-[-.02em]" id="forecast-title">Next period</h2>
                  {range ? <><p className="mt-[.35rem] mb-[.45rem] text-[clamp(1.6rem,4vw,2.5rem)] leading-[1.12] font-[750] tracking-[-.035em]">{forecastLabel(range)}</p><p className="text-muted">Estimated next start.</p></> : <p className="text-muted">{forecastCopy}</p>}
                </section>}
                {reminders.length > 0 && <section className="journal-card" aria-labelledby="reminders-heading">
                  <h2 className="text-[1.19rem] tracking-[-.02em]" id="reminders-heading">Reminders</h2>
                  <ul className="mx-0 mt-[.55rem] mb-0 pl-[1.35rem] text-muted">{reminders.map((reminder) => <li key={reminder}>{reminderText[reminder]}</li>)}</ul>
                </section>}
              </aside>}
            </div>
          </div>
        </>}

        {tracker && ready && tab === 'Calendar' && <>
          <div className="page-intro">
            <h1>Calendar</h1>
            <p>Choose a day to view or update your records.</p>
          </div>
          <div className="grid grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] items-start gap-[clamp(.85rem,2.5vw,1.5rem)] compact:grid-cols-1">
            <Calendar tracker={tracker} today={today} range={range} suggestedEnd={suggestedEnd} selected={selected} disabled={saving} select={(date) => {
              setEditor(null);
              setNotice('');
              setSelected(date);
            }} />
            <div className="grid min-w-0 gap-[.85rem]">
              <section className="journal-feature p-[clamp(1rem,2.8vw,1.65rem)]" aria-labelledby="day-heading">
                <div className="journal-split not-phone:grid-cols-[minmax(0,1fr)_minmax(4rem,.42fr)]">
                  <div>
                    <h2 className="journal-title text-[clamp(1.35rem,2.65vw,2.25rem)]" id="day-heading">{formatDay(day, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
                    <p className="not-phone:mt-2">{period?.endUnknown ? 'Confirmed start. End date unknown.' : recorded ? 'Confirmed period day.' : period ? 'Open period. This day isn’t confirmed.'
                      : selectedInForecast ? 'Part of your estimated start range.' : 'No period logged.'}
                      {dailyLog ? ' Daily log saved.' : ''}</p>
                  </div>
                  <img className="journal-art max-w-36 phone:max-w-[5.1rem]" src="/cycle-leaves.svg" width="342" height="268" alt="" />
                </div>
                {day === suggestedEnd && <p className="suggestion rounded-[.65rem] text-plum">Suggested end date · not confirmed.</p>}
                {day <= today && <div className="hero-actions phone:mt-[.7rem]">{periodButton('journal-action')}{logButton('hero-secondary')}</div>}
              </section>
              {periodEditor && <div className="journal-card [&>section]:m-0 [&>section]:border-0 [&>section]:p-0">{periodEditor}</div>}
            </div>
          </div>
        </>}

        {tracker && ready && tab === 'Insights' && <Insights tracker={tracker} openCalendar={() => switchTab('Calendar')} />}
        {tracker && ready && tab === 'Settings' && <SettingsScreen tracker={tracker} save={saveSettings} clear={clear} signOut={signOut} />}
        {tracker && logDay && <LogEditor key={logDay} day={logDay}
          existing={tracker.dailyLogs.find((log) => log.day === logDay)}
          save={(details) => saveLog(logDay, details)} remove={() => removeLog(logDay)} close={() => close()} />}
        {tracker && <p role="status" className="notice">{notice}</p>}
      </main>
      {ready && <Navigation active={tab} disabled={saving} change={switchTab} />}
    </div>
  );
}
