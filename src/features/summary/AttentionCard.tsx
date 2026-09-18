import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, Repeat, Save, TriangleAlert } from 'lucide-react';
import { Fragment } from 'react';
import { db } from '../../db/db';
import { usePendingTransactions } from '../../db/hooks';
import { useSettings } from '../../store/settings';
import { budgetAlerts } from '../../domain/budgets';
import { cx } from '../../lib/cx';
import { formatPercent } from '../../lib/format';
import { useUI } from '../../store/ui';
import { useBudgetProgress } from '../budgets/useBudgetProgress';

const MAX_NAMES = 2;
const BACKUP_EVERY_MS = 30 * 86_400_000;

/**
 * Recordar el respaldo si pasaron más de 30 días desde el último (o, si nunca se hizo,
 * desde el primer movimiento real cargado).
 */
function useBackupDue(): boolean {
  const { lastBackupAt } = useSettings();
  const firstReal = useLiveQuery(async () => {
    let first: string | undefined;
    await db.transactions.each((t) => {
      if (!t.isDemo && (!first || t.createdAt < first)) first = t.createdAt;
    });
    return first ?? null;
  }, []);
  const since = lastBackupAt ?? firstReal;
  return Boolean(since) && Date.now() - Date.parse(since!) > BACKUP_EVERY_MS;
}

/**
 * Resumen: lo que pide atención, en una sola tarjeta compacta —
 * recurrentes para confirmar y presupuestos que pasaron el 80 % o el 100 %.
 */
export function AttentionCard() {
  const pending = usePendingTransactions();
  const period = useUI((s) => s.period);
  const { progress } = useBudgetProgress(period);
  const setPanel = useUI((s) => s.setPanel);
  const setTab = useUI((s) => s.setTab);
  const setView = useUI((s) => s.setExpenseView);
  const alerts = budgetAlerts(progress);
  const backupDue = useBackupDue();

  if (pending.length === 0 && alerts.length === 0 && !backupDue) return null;

  const pendingText =
    pending.length === 1 ? '1 recurrente para confirmar' : `${pending.length} recurrentes para confirmar`;
  const over = alerts.some((a) => a.state === 'over');

  return (
    <section aria-label="Para revisar" className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
      {pending.length > 0 && (
        <button
          type="button"
          onClick={() => setPanel('pending')}
          className="flex min-h-11 w-full items-center gap-3 px-4 text-left active:bg-raised"
        >
          <Repeat size={16} strokeWidth={1.75} className="shrink-0 text-expense" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-[14px]">{pendingText}</span>
          <ChevronRight size={16} strokeWidth={1.5} className="shrink-0 text-muted" aria-hidden="true" />
        </button>
      )}
      {alerts.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setView('budgets');
            setTab('expenses');
          }}
          aria-label={`Presupuestos en alerta: ${alerts
            .map((a) => `${a.category.name} ${formatPercent(a.ratio, { digits: 0 })}`)
            .join(', ')}`}
          className="flex min-h-11 w-full items-center gap-3 px-4 text-left active:bg-raised"
        >
          <TriangleAlert
            size={16}
            strokeWidth={1.75}
            className={cx('shrink-0', over ? 'text-alert' : 'text-warn')}
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 truncate text-[13px]">
            {alerts.slice(0, MAX_NAMES).map((a, i) => (
              <Fragment key={a.budget.id}>
                {i > 0 && <span className="text-muted"> · </span>}
                {a.category.name}{' '}
                <span className={cx('tabular', a.state === 'over' ? 'text-alert' : 'text-warn')}>
                  {formatPercent(a.ratio, { digits: 0 })}
                </span>
              </Fragment>
            ))}
            {alerts.length > MAX_NAMES && <span className="text-muted"> · +{alerts.length - MAX_NAMES}</span>}
          </span>
          <ChevronRight size={16} strokeWidth={1.5} className="shrink-0 text-muted" aria-hidden="true" />
        </button>
      )}
      {backupDue && (
        <button
          type="button"
          onClick={() => setPanel('backup')}
          className="flex min-h-11 w-full items-center gap-3 px-4 text-left active:bg-raised"
        >
          <Save size={16} strokeWidth={1.75} className="shrink-0 text-warn" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-[13px]">Hace más de 30 días que no hacés un respaldo</span>
          <ChevronRight size={16} strokeWidth={1.5} className="shrink-0 text-muted" aria-hidden="true" />
        </button>
      )}
    </section>
  );
}
