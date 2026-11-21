import { useState } from 'react';
import { ErrorMessage, useAction } from './editors.tsx';
import { request } from './client.ts';
import type { Settings, Tracker } from './model.ts';

const reminders = {
  remindDaily: 'Daily check-in',
  remindPeriod: 'Upcoming estimated period',
  remindEnd: 'Confirm period end',
};

export function SettingsScreen({ tracker, save, clear, signOut }: {
  tracker: Tracker; save: (settings: Settings) => Promise<void>;
  clear: () => Promise<void>; signOut: () => Promise<void>;
}) {
  const [confirm, setConfirm] = useState(false);
  const [draft, setDraft] = useState<Settings | null>(null);
  const settings = draft ?? tracker.settings;
  const [notice, setNotice] = useState('');
  const [statusArea, setStatusArea] = useState<'preferences' | 'data' | 'account'>('preferences');
  const { busy, error, run } = useAction();

  function perform(area: typeof statusArea, action: () => Promise<void>, success = '') {
    setStatusArea(area);
    setNotice('');
    void run(async () => {
      await action();
      setNotice(success);
    });
  }

  function status(area: typeof statusArea) {
    return statusArea === area && <>
      <ErrorMessage>{error}</ErrorMessage>
      <p className="notice" role="status">{notice}</p>
    </>;
  }

  async function download() {
    const records = await request<Tracker>('/export');
    const url = URL.createObjectURL(new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'dottie.json';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <>
      <div className="page-intro journal-intro">
        <h1>Settings</h1>
      </div>
      <section className="journal-feature journal-split settings-feature" aria-labelledby="settings-feature-heading">
        <div>
          <h2 className="journal-title" id="settings-feature-heading">Manage your journal</h2>
          <p>Set reminders and period-end suggestions, or manage the records you’ve saved.</p>
        </div>
        <img className="journal-art" src="/journal-records.svg" width="342" height="268" alt="" />
      </section>
      <form onSubmit={(event) => {
        event.preventDefault();
        perform('preferences', async () => {
          await save(settings);
          setDraft(null);
        }, 'Settings saved.');
      }}>
        <fieldset disabled={busy}>
          <div className="settings-grid">
            <section className="journal-card">
              <h2>Period end suggestion</h2>
              <p className="muted">This only suggests when a logged period might end. It doesn’t change your next-period forecast. Leave it blank to turn off suggestions.</p>
              <label className="short-input">Typical period length (days)
                <input type="number" min="1" max="30" step="1" value={settings.typicalPeriodDays ?? ''}
                  onChange={(event) => setDraft({ ...settings, typicalPeriodDays: event.target.value ? Number(event.target.value) : null })} />
              </label>
            </section>
            <section className="journal-card">
              <h2>Reminders</h2>
              <p className="muted">Shown on Today when you open Dottie. No lock-screen notifications.</p>
              <div className="reminder-options">
                {(Object.keys(reminders) as (keyof typeof reminders)[]).map((key) => (
                  <label key={key}>
                    <input type="checkbox" checked={settings[key]} onChange={(event) => setDraft({ ...settings, [key]: event.target.checked })} />
                    {reminders[key]}
                  </label>
                ))}
              </div>
            </section>
          </div>
          <button className="primary settings-save" type="submit">{busy ? 'Working…' : 'Save settings'}</button>
          {status('preferences')}
        </fieldset>
      </form>
      <div className="settings-grid settings-private">
        <section className="journal-card">
          <h2>Your data</h2>
          <p className="muted">Your JSON export includes all saved observations, including sexual activity and personal notes. Store it somewhere private.</p>
          <div className="actions">
            <button disabled={busy} onClick={() => perform('data', download, 'Export downloaded.')}>Download records</button>
            {!confirm && <button className="quiet danger" disabled={busy} onClick={() => setConfirm(true)}>Delete tracking data</button>}
          </div>
          {confirm && <div className="confirm">
            <p>Delete all period entries, daily logs, and tracking preferences? Your account will remain, but you’ll return to welcome setup. This can’t be undone.</p>
            <div className="actions">
              <button className="danger-fill" disabled={busy} onClick={() => perform('data', async () => {
                await clear();
                setDraft(null);
                setConfirm(false);
              }, 'Tracking data deleted.')}>Delete all tracking data</button>
              <button disabled={busy} onClick={() => setConfirm(false)}>Cancel</button>
            </div>
          </div>}
          <p className="muted settings-data-note">The person who administers the database can access stored records.</p>
          {status('data')}
        </section>
        <section className="journal-card">
          <h2>Account</h2>
          <button className="quiet" disabled={busy} onClick={() => perform('account', signOut)}>Sign out</button>
          {status('account')}
        </section>
      </div>
    </>
  );
}
