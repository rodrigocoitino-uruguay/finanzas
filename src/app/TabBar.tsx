import { ChartPie, LayoutGrid, List, Settings2, TrendingUp, type LucideIcon } from 'lucide-react';
import { cx } from '../lib/cx';
import { useUI, type Tab } from '../store/ui';
import { TAB_TITLE } from './tabs';

const TABS: { id: Tab; icon: LucideIcon }[] = [
  { id: 'summary', icon: LayoutGrid },
  { id: 'transactions', icon: List },
  { id: 'expenses', icon: ChartPie },
  { id: 'income', icon: TrendingUp },
  { id: 'settings', icon: Settings2 },
];

export function TabBar() {
  const tab = useUI((s) => s.tab);
  const setTab = useUI((s) => s.setTab);
  return (
    <nav
      aria-label="Secciones"
      className="shrink-0 border-t border-line bg-bg/90 backdrop-blur-xl"
      style={{ paddingBottom: 'var(--safe-bottom)' }}
    >
      <div role="tablist" className="mx-auto grid h-[var(--tabbar-h)] max-w-xl grid-cols-5">
        {TABS.map(({ id, icon: Icon }) => {
          const selected = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-selected={selected}
              aria-controls="panel"
              onClick={() => setTab(id)}
              className={cx(
                'flex flex-col items-center justify-center gap-1 transition-colors duration-200',
                selected ? 'text-fg' : 'text-muted',
              )}
            >
              <Icon size={22} strokeWidth={selected ? 1.75 : 1.4} aria-hidden="true" />
              <span className="text-[10.5px] leading-none tracking-wide">{TAB_TITLE[id]}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
