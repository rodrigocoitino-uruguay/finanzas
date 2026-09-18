import { CurrencyToggle } from '../features/period/CurrencyToggle';
import { PeriodSelector } from '../features/period/PeriodSelector';
import { RateChip } from '../features/rates/RateChip';
import { useUI } from '../store/ui';
import { TAB_TITLE } from './tabs';

export function Header() {
  const tab = useUI((s) => s.tab);
  return (
    <header className="shrink-0 px-5" style={{ paddingTop: 'calc(var(--safe-top) + 6px)' }}>
      <div className="flex h-11 items-center justify-between gap-2">
        <h1 className="min-w-0 truncate font-display text-[26px] font-bold leading-tight tracking-[-0.02em]">{TAB_TITLE[tab]}</h1>
        <RateChip />
      </div>
      {tab !== 'settings' && (
        <div className="mt-1 flex h-12 items-center justify-between gap-2">
          <PeriodSelector />
          <CurrencyToggle />
        </div>
      )}
    </header>
  );
}
