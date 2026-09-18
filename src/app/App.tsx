import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, type JSX } from 'react';
import { Toaster } from '../components/ui/Toaster';
import { getSettings } from '../db/settings';
import { EntrySheet } from '../features/entry/EntrySheet';
import { ExpensesTab } from '../features/expenses/ExpensesTab';
import { IncomeTab } from '../features/income/IncomeTab';
import { BackupSheet } from '../features/backup/BackupSheet';
import { BudgetsSheet } from '../features/budgets/BudgetsSheet';
import { CategoriesSheet } from '../features/categories/CategoriesSheet';
import { SecuritySheet } from '../features/security/SecuritySheet';
import { RateSheet } from '../features/rates/RateSheet';
import { PendingSheet } from '../features/recurring/PendingSheet';
import { RecurringSheet } from '../features/recurring/RecurringSheet';
import { generateDueRecurring } from '../db/recurring';
import { loadSyncStatus, syncRates } from '../features/rates/sync';
import { SettingsTab } from '../features/settings/SettingsTab';
import { SummaryTab } from '../features/summary/SummaryTab';
import { TransactionsTab } from '../features/transactions/TransactionsTab';
import { todayISO } from '../lib/dates';
import { requestPersistentStorage, useVisualViewportVars } from '../lib/viewport';
import { useLock } from '../store/lock';
import { useSettingsStore } from '../store/settings';
import { LockScreen } from '../features/security/LockScreen';
import { Lock } from 'lucide-react';
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
    // Al abrir la app: bloqueada si hay PIN.
    const lock = useLock.getState();
    if (!lock.ready) lock.init(Boolean(settings.pinHash));
    const ui = useUI.getState();
    if (ui.displayCurrency === null) ui.setDisplayCurrency(settings.displayCurrency);
  }, [settings]);

  useEffect(() => {
    let last = Date.now();
    // Primero la cotización (hace falta para convertir) y después los recurrentes del mes.
    const refresh = () =>
      syncRates()
        .catch(() => undefined)
        .then(() => generateDueRecurring(todayISO()))
        .catch((e) => console.error(e));
    void loadSyncStatus().then(refresh);
    void requestPersistentStorage();
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      // Si cambió el mes con la app abierta, se generan los recurrentes igual.
      if (Date.now() - last < RATES_REFRESH_MS) {
        void generateDueRecurring(todayISO()).catch(() => undefined);
        return;
      }
      last = Date.now();
      void refresh();
    };
    // Al recuperar la conexión, se trae la cotización nueva.
    const onOnline = () => {
      last = Date.now();
      void refresh();
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

/**
 * Bloqueo automático: al volver a la app después de X minutos (0 = siempre).
 * Mientras está en segundo plano se tapa el contenido.
 */
function useAutoLock() {
  useEffect(() => {
    let hiddenAt = 0;
    const onVisibility = () => {
      const { settings } = useSettingsStore.getState();
      const hasPin = Boolean(settings.pinHash);
      const lock = useLock.getState();
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        if (hasPin) lock.setObscured(true);
        return;
      }
      lock.setObscured(false);
      if (hasPin && hiddenAt && Date.now() - hiddenAt >= settings.autoLockMinutes * 60_000) lock.lock();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onVisibility);
    };
  }, []);
}

function Shell() {
  const ready = useBootstrap();
  const tab = useUI((s) => s.tab);
  const lockReady = useLock((s) => s.ready);
  const locked = useLock((s) => s.locked);
  const obscured = useLock((s) => s.obscured);
  useVisualViewportVars();
  useAutoLock();

  if (!ready || !lockReady) return <div className="h-full bg-bg" aria-busy="true" />;
  if (locked) {
    return (
      <>
        <LockScreen />
        <Toaster />
      </>
    );
  }

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
      <PendingSheet />
      <BudgetsSheet />
      <RecurringSheet />
      <CategoriesSheet />
      <SecuritySheet />
      <BackupSheet />
      <Toaster />
      {obscured && (
        <div aria-hidden="true" className="fixed inset-0 z-[100] grid place-items-center bg-bg">
          <Lock size={28} strokeWidth={1.5} className="text-muted" />
        </div>
      )}
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
