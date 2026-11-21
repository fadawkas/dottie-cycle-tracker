export const tabs = ['Today', 'Calendar', 'Insights', 'Settings'] as const;
export type Tab = (typeof tabs)[number];

const glyphs: Record<Tab, string> = {
  Today: 'M3 11.5 12 4l9 7.5M5.5 10v10h13V10M10 20v-5h4v5',
  Calendar: 'M5 6h14a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5v-11A1.5 1.5 0 0 1 5 6ZM8 4v4m8-4v4M4 10h16m-12 4h2m3 0h2',
  Insights: 'M4.5 4.5v15h15m-12-5 4-4 3 2 5-5',
  Settings: 'M5 7h14M5 12h14M5 17h14m-10-12v4m6 1v4m-4 1v4',
};

export function Navigation({ active, disabled, change }: { active: Tab; disabled: boolean; change: (tab: Tab) => void }) {
  return (
    <nav className="app-dock" aria-label="Main navigation">
      {tabs.map((tab) => <button type="button" key={tab} disabled={disabled}
        aria-current={active === tab ? 'page' : undefined} onClick={() => change(tab)}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={glyphs[tab]} /></svg>
        <span>{tab}</span>
      </button>)}
    </nav>
  );
}
