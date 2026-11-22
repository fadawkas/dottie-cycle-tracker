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
    <nav className="fixed inset-x-[max(10px,env(safe-area-inset-left,0px),env(safe-area-inset-right,0px))]
        bottom-[calc(1.15rem+env(safe-area-inset-bottom,0px))] z-5 mx-auto grid w-[min(100%_-_24px,412px)] grid-cols-4 gap-[.2rem]
        rounded-[1.35rem] border border-[#c7b6ce] bg-lavender p-[.35rem] shadow-[0_8px_30px_#321c352e]" aria-label="Main navigation">
      {tabs.map((tab) => <button type="button" key={tab} disabled={disabled}
        className="grid min-h-[52px] content-center justify-items-center gap-[.17rem] rounded-2xl border-0 bg-transparent px-[.1rem] py-[.23rem]
          text-[clamp(.69rem,2.9vw,.81rem)] whitespace-nowrap enabled:hover:bg-[#ded2e8]
          aria-[current=page]:bg-plum aria-[current=page]:text-surface aria-[current=page]:enabled:hover:bg-plum"
        aria-current={active === tab ? 'page' : undefined} onClick={() => change(tab)}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={glyphs[tab]} /></svg>
        <span>{tab}</span>
      </button>)}
    </nav>
  );
}
