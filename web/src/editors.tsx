import { useLayoutEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { getSexChoice, prepareCheckIn, sexDetails, sexualActivityChoices } from './check-in.ts';
import { messageFor } from './client.ts';
import { formatDay } from './dates.ts';
import { suggestedPeriodEnd } from './forecast.ts';
import type { DailyLog, Observations, Period, Symptom } from './model.ts';
import { symptomLabels } from './model.ts';

export type PeriodInput = Omit<Period, 'id'>;

export function useAction() {
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run(operation: () => Promise<void>) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError('');
    try {
      await operation();
    } catch (issue) {
      setError(messageFor(issue));
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return { busy, error, run, clearError: () => setError('') };
}

export function ErrorMessage({ children }: { children: ReactNode }) {
  return children ? <p className="error" role="alert">{children}</p> : null;
}

export function PeriodEditor({ period, day, today, typicalDays, save, remove, close }: {
  period?: Period; day: string; today: string; typicalDays: number | null; close: () => void;
  save: (input: PeriodInput) => Promise<void>; remove: () => Promise<void>;
}) {
  const [startDate, setStartDate] = useState(period?.startDate ?? day);
  const [endDate, setEndDate] = useState(period?.endDate ?? '');
  const [endUnknown, setEndUnknown] = useState(period?.endUnknown ?? false);
  const suggestion = !endUnknown && !endDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? suggestedPeriodEnd(startDate, typicalDays) : null;
  const [confirm, setConfirm] = useState(false);
  const { busy, error, run } = useAction();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(() => save({ startDate, endDate: endUnknown ? null : endDate || null, endUnknown }));
  }

  return (
    <section className="editor" aria-labelledby="period-editor-heading">
      <h2 id="period-editor-heading">{period ? 'Edit period' : 'Log a period'}</h2>
      <p className="muted">Leave the end date blank for an ongoing period, or mark a past end as unknown.</p>
      <form onSubmit={submit}>
        <fieldset disabled={busy || confirm}>
          <div className="two-fields">
            <label>Start date
              <input autoFocus type="date" required max={today} value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </label>
            <label>End date
              <input type="date" min={startDate} max={today} value={endDate} disabled={endUnknown} onChange={(event) => setEndDate(event.target.value)} />
            </label>
          </div>
          <label className="unknown-end">
            <input type="checkbox" checked={endUnknown} onChange={(event) => {
              setEndUnknown(event.target.checked);
              if (event.target.checked) setEndDate('');
            }} />
            It ended, but I don’t know the date
          </label>
          {suggestion && <div className="suggestion">
            <p><strong>Suggested end: {formatDay(suggestion)}</strong> · based on your typical length.</p>
            {suggestion <= today && <button className="text-action" type="button" onClick={() => setEndDate(suggestion)}>Use suggested date</button>}
          </div>}
          <div className="actions">
            <button className="primary" type="submit">{busy ? 'Saving…' : 'Save period'}</button>
            <button type="button" onClick={close}>Cancel</button>
            {period && <button className="quiet danger" type="button" onClick={() => setConfirm(true)}>Delete period</button>}
          </div>
        </fieldset>
      </form>
      {confirm && <div className="confirm">
        <p>Delete this period? It will be removed from your history.</p>
        <div className="actions">
          <button className="danger-fill" disabled={busy} onClick={() => void run(remove)}>Delete this period</button>
          <button disabled={busy} onClick={() => setConfirm(false)}>Keep it</button>
        </div>
      </div>}
      <ErrorMessage>{error}</ErrorMessage>
    </section>
  );
}

const flowChoices = { spotting: 'Spotting', light: 'Light', medium: 'Medium', heavy: 'Heavy' };
export const moodChoices = { good: 'Good', okay: 'Okay', low: 'Low', anxious: 'Anxious', irritable: 'Irritable' };

export function ChoiceGroup<T extends string>({ name, label, choices, value, onChange, required = false }: {
  name: string; label: string; choices: Record<T, string>; value: T | undefined;
  onChange: (value: T | undefined) => void; required?: boolean;
}) {
  const first = useRef<HTMLInputElement>(null);
  return (
    <div className="check-in-group" role="group" aria-labelledby={`check-in-${name}`}>
      <div className="check-in-group-title">
        <h3 id={`check-in-${name}`}>{label}</h3>
        {!required && value !== undefined && <button className="text-action" type="button" aria-label={`Clear ${label.toLowerCase()}`} onClick={() => {
          onChange(undefined);
          first.current?.focus();
        }}>Clear</button>}
      </div>
      <div className={name === 'sex' ? 'check-in-options check-in-sex' : 'check-in-options'}>
        {(Object.keys(choices) as T[]).map((choice, index) => (
          <label key={choice} className="check-in-choice">
            <input ref={index === 0 ? first : undefined} type="radio" name={name} value={choice}
              checked={value === choice} required={required} onChange={() => onChange(choice)} />
            {choices[choice]}
          </label>
        ))}
      </div>
    </div>
  );
}

export function LogEditor({ day, existing, save, remove, close }: {
  day: string; existing?: DailyLog; close: () => void;
  save: (details: Observations) => Promise<void>; remove: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const keep = useRef<HTMLButtonElement>(null);
  const returnFromConfirm = useRef<HTMLElement | null>(null);
  const [details, setDetails] = useState<Observations>(() => {
    const { day: _day, ...fields } = existing ?? {};
    return fields;
  });
  const [sleep, setSleep] = useState(existing?.sleepHours?.toString() ?? '');
  const [confirm, setConfirm] = useState<'delete' | 'empty' | null>(null);
  const { busy, error, run, clearError } = useAction();
  const values = prepareCheckIn(details, sleep);

  useLayoutEffect(() => {
    const element = dialog.current!;
    element.showModal();
    title.current?.focus();
    return () => element.close();
  }, []);

  useLayoutEffect(() => {
    if (confirm) keep.current?.focus();
    else if (returnFromConfirm.current) {
      returnFromConfirm.current.focus();
      returnFromConfirm.current = null;
    }
  }, [confirm]);

  function change<K extends keyof Observations>(key: K, value: Observations[K]) {
    setDetails((current) => ({ ...current, [key]: value }));
  }

  function confirmDelete(reason: NonNullable<typeof confirm>, trigger: HTMLElement | null) {
    returnFromConfirm.current = trigger;
    clearError();
    setConfirm(reason);
  }

  function keepEditing() {
    clearError();
    setConfirm(null);
  }

  function symptomChip(symptom: Symptom) {
    const current = details.symptoms ?? [];
    return (
      <label key={symptom} className="check-in-choice">
        <input type="checkbox" checked={current.includes(symptom)} onChange={(event) => {
          change('symptoms', event.target.checked ? [...current, symptom] : current.filter((item) => item !== symptom));
        }} />
        {symptomLabels[symptom]}
      </label>
    );
  }
  const symptoms = Object.keys(symptomLabels) as Symptom[];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || confirm) return;
    if (values) void run(() => save(values));
    else if (existing) confirmDelete('empty', (event.nativeEvent as SubmitEvent).submitter);
  }

  return (
    <dialog className="check-in" ref={dialog} aria-labelledby="log-editor-heading" aria-describedby="log-editor-date"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) confirm ? keepEditing() : close();
      }}>
      <header className="check-in-header">
        <div>
          <h2 id="log-editor-heading" ref={title} tabIndex={-1}>Daily check-in</h2>
          <time id="log-editor-date" dateTime={day}>{formatDay(day, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</time>
        </div>
        <button className="check-in-close quiet" type="button" aria-label="Close daily check-in" disabled={busy} onClick={close}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </header>
      <form className="check-in-form" onSubmit={submit}>
        <div className="check-in-body">
          <fieldset disabled={busy || !!confirm} hidden={!!confirm}>
            <ChoiceGroup name="flow" label="Bleeding or spotting" choices={flowChoices} value={details.flow} onChange={(value) => change('flow', value)} />
            <ChoiceGroup name="mood" label="Mood" choices={moodChoices} value={details.mood} onChange={(value) => change('mood', value)} />
            <ChoiceGroup name="sex" label="Sexual activity" choices={sexualActivityChoices}
              value={getSexChoice(details)} onChange={(value) => setDetails((current) => ({ ...current, ...sexDetails(value) }))} />
            <fieldset className="check-in-group check-in-symptoms">
              <legend>Symptoms</legend>
              <div className="check-in-options">{symptoms.map(symptomChip)}</div>
            </fieldset>
            <details className="check-in-extras" onInvalid={(event) => {
              event.currentTarget.open = true;
            }}>
              <summary>Sleep and notes</summary>
              <label className="short-input">Sleep (hours)
                <input type="number" min="0" max="24" step="0.25" value={sleep} onChange={(event) => setSleep(event.target.value)} />
              </label>
              <label>Personal note
                <textarea maxLength={1000} rows={3} value={details.note ?? ''} onChange={(event) => change('note', event.target.value)} />
              </label>
            </details>
            {existing && <button type="button" className="text-action danger" onClick={(event) => confirmDelete('delete', event.currentTarget)}>Delete daily log</button>}
          </fieldset>
          {confirm && <div className="check-in-confirm">
            <h3>Delete this daily log?</h3>
            <p id="check-in-delete-description">{confirm === 'empty' ? 'You cleared the last observation. Delete the log for this date, or keep editing.' : 'This removes all observations for this date. Period entries are not affected.'}</p>
          </div>}
        </div>
        <footer className="check-in-footer">
          <ErrorMessage>{error}</ErrorMessage>
          <div className="check-in-actions">
            {confirm ? <>
              <button ref={keep} type="button" className="quiet" aria-describedby="check-in-delete-description" disabled={busy} onClick={keepEditing}>Keep editing</button>
              <button type="button" className="danger-fill" disabled={busy} onClick={() => void run(remove)}>{busy ? 'Deleting…' : 'Delete log'}</button>
            </> : <>
              <button type="button" className="quiet" disabled={busy} onClick={close}>Cancel</button>
              <button type="submit" className="primary" disabled={busy || (!values && !existing)}>{busy ? 'Saving…' : 'Save daily log'}</button>
            </>}
          </div>
        </footer>
      </form>
    </dialog>
  );
}
