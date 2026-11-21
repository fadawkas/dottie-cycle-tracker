import { useEffect, useRef, useState } from 'react';
import { ChoiceGroup, ErrorMessage, moodChoices, useAction } from './editors.tsx';
import type { SetupEntry } from './model.ts';

type EntryPath = 'period' | 'check-in';
const endChoices = {
  unknown: 'Ended, date unknown',
  date: 'I know the end date',
  ongoing: 'Still ongoing',
};
type EndStatus = keyof typeof endChoices;

export function Welcome({ today, complete, signOut }: {
  today: string; complete: (entry: SetupEntry) => Promise<void>; signOut: () => Promise<void>;
}) {
  const [path, setPath] = useState<EntryPath | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endStatus, setEndStatus] = useState<EndStatus>('unknown');
  const [mood, setMood] = useState<Extract<SetupEntry, { kind: 'check-in' }>['mood'] | ''>('');
  const { busy, error, run, clearError } = useAction();
  const heading = useRef<HTMLHeadingElement>(null);
  const initial = useRef(true);

  useEffect(() => {
    if (initial.current) initial.current = false;
    else heading.current?.focus();
  }, [path]);

  function choose(next: EntryPath | null) {
    clearError();
    setPath(next);
  }

  return (
    <div className="welcome-layout">
      <section className="journal-feature journal-split welcome-cover">
        <div>
          <h1 className="journal-title">Welcome to <span>Dottie.</span></h1>
          <p>Your private journal for periods and the days in between.</p>
        </div>
        <img className="journal-art" src="/journal-cover.svg" width="342" height="268" alt="" />
      </section>
      <section className="journal-card welcome-entry" aria-labelledby="welcome-heading">
        <h2 id="welcome-heading" tabIndex={-1} ref={heading}>
          {path === 'period' ? 'When did your last period start?' : path === 'check-in' ? 'How are you feeling today?' : 'Start with one entry'}
        </h2>
        {!path ? <>
          <p className="muted">Use a date you remember, or start with how you feel today. No need to guess.</p>
          <div className="welcome-options">
            <button type="button" className="journal-action" disabled={busy} onClick={() => choose('period')}>I know my last period start</button>
            <button type="button" disabled={busy} onClick={() => choose('check-in')}>Start with today’s check-in</button>
          </div>
        </> : <form onSubmit={(event) => {
          event.preventDefault();
          if (path === 'period') {
            void run(() => complete({ kind: 'period', startDate, endDate: endStatus === 'date' ? endDate : null, endUnknown: endStatus === 'unknown' }));
          } else if (mood) {
            void run(() => complete({ kind: 'check-in', day: today, mood }));
          }
        }}>
          <fieldset className="welcome-fields" disabled={busy}>
            {path === 'period' ? <>
              <p className="muted">Enter the first day of bleeding. An unknown end won’t be recorded as ongoing.</p>
              <label>Start date<input type="date" required max={today} value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
              <ChoiceGroup name="period-end" label="Period end" choices={endChoices} value={endStatus} required
                onChange={(value) => { if (value) setEndStatus(value); }} />
              {endStatus === 'date' && <label>End date<input type="date" required min={startDate || undefined} max={today}
                value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>}
            </> : <>
              <p className="muted">A short check-in is enough. You can add period dates in Calendar whenever you remember them.</p>
              <ChoiceGroup name="mood" label="Mood" choices={moodChoices} value={mood || undefined} required
                onChange={(value) => setMood(value ?? '')} />
            </>}
            <div className="actions">
              <button type="submit" className="primary">{busy ? 'Saving…' : 'Save and open Today'}</button>
              <button type="button" onClick={() => choose(null)}>Back</button>
            </div>
          </fieldset>
        </form>}
        <ErrorMessage>{error}</ErrorMessage>
        <div className="welcome-meta">
          <p>Only you can see entries in the app. The database administrator can access stored records.</p>
          <button type="button" className="quiet" disabled={busy} onClick={() => void run(signOut)}>Sign out</button>
        </div>
      </section>
    </div>
  );
}
