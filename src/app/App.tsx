import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, type JSX } from 'react';
import { Toaster } from '../components/ui/Toaster';
import { getSettings } from '../db/settings';
import { EntrySheet } from '../features/entry/EntrySheet';
import { ExpensesTab } from '../features/expenses/ExpensesTab';
import { IncomeTab } from '../features/income/IncomeTab';
import { RateSheet } from '../features/rates/RateSheet';
import { loadSyncStatus, syncRates } from '../features/rates/sync';
import { SettingsTab } from '../features/settings/SettingsTab';
import { SummaryTab } from '../features/summary/SummaryTab';
import { TransactionsTab } from '../features/transactions/TransactionsTab';
import { requestPersistentStorage, useVisualViewportVars } from '../lib/viewport';
import { useSettingsStore } from '../store/settings';
import { useUI, type Tab } from '../store/ui';
import { ErrorBoundary } from './ErrorBoundary';
import { Fab } from './Fab';
import { Header } from './Header';
import { TabBar } from './TabBar';

const PANELS: Record<Tab, () => JSX.Element> = {
  summary: SummaryTab,
  transactions: TransactionsTab,
  expenses: ExpensesTab,
  income: IncomeTab,
  settings: SettingsTab,
};

const RATES_REFRESH_MS = 30 * 60 * 1000;

function useBootstrap() {
  const settings = useLiveQuery(getSettings);

  useEffect(() => {
    if (!settings) return;
    useSettingsStore.setState({ settings, loaded: true });
    const ui = useUI.getState();
    if (ui.displayCurrency === null) ui.setDisplayCurrency(settings.displayCurrency);
  }, [settings]);

  useEffect(() => {
    let last = Date.now();
    void loadSyncStatus().then(() => syncRates());
    void requestPersistentStorage();
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < RATES_REFRESH_MS) return;
      last = Date.now();
      void syncRates();
    };
    // Al recuperar la conexión, se trae la cotización nueva.
    const onOnline = () => {
      last = Date.now();
      void syncRates();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  return Boolean(settings);
}

function Shell() {
  const ready = useBootstrap();
  const tab = useUI((s) => s.tab);
  useVisualViewportVars();

  if (!ready) return <div className="h-full bg-bg" aria-busy="true" />;

  const Panel = PANELS[tab];
  return (
    <div className="mx-auto flex h-full w-full max-w-xl flex-col" style={{ paddingLeft: 'var(--safe-left)', paddingRight: 'var(--safe-right)' }}>
      <Header />
      <main id="panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="relative min-h-0 flex-1">
        <div key={tab} className="h-full animate-fade-in">
          <Panel />
        </div>
      </main>
      <TabBar />
      <Fab />
      <EntrySheet />
      <RateSheet />
      <Toaster />
    </div>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <Shell />
    </ErrorBoundary>
  );
}
