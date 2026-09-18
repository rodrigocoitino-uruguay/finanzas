import { PiggyBank, SlidersHorizontal } from 'lucide-react';
import { capitalize, formatMonthYear } from '../../lib/dates';
import { formatPercent } from '../../lib/format';
import { useUI } from '../../store/ui';
import { BudgetBar, budgetSentence } from './BudgetBar';
import { useBudgetProgress } from './useBudgetProgress';

/** Gastos → Presupuestos: avance de cada tope en el mes. */
export function BudgetsView() {
  const period = useUI((s) => s.period);
  const setPanel = useUI((s) => s.setPanel);
  const showTransactions = useUI((s) => s.showTransactions);
  const { month, progress, loading } = useBudgetProgress(period);

  if (!loading && progress.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-10 pb-24 text-center">
        <PiggyBank size={30} strokeWidth={1.2} className="text-muted" aria-hidden="true" />
        <p className="text-[15px] text-muted">
          Poné un tope mensual a las categorías que querés cuidar. Te avisamos al 80&nbsp;% y al 100&nbsp;%.
        </p>
        <button
          type="button"
          onClick={() => setPanel('budgets')}
          className="min-h-11 rounded-full bg-fg px-5 text-[15px] font-medium text-bg active:opacity-80"
        >
          Crear presupuesto
        </button>
      </div>
    );
  }

  const over = progress.filter((p) => p.state === 'over').length;
  const warn = progress.filter((p) => p.state === 'warn').length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 px-5 pt-3 pb-2">
        <div className="min-w-0">
          <p className="text-[13px] text-muted">{capitalize(formatMonthYear(`${month}-01`))}</p>
          <p className="text-[13px]">
            {progress.length - over - warn} bien
            {warn > 0 && <span className="text-warn"> · {warn} cerca del tope</span>}
            {over > 0 && <span className="text-alert"> · {over} pasado{over === 1 ? '' : 's'}</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPanel('budgets')}
          className="flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-line px-4 text-[14px] active:bg-raised"
        >
          <SlidersHorizontal size={15} strokeWidth={1.5} aria-hidden="true" />
          Editar topes
        </button>
      </div>
      <ul className="scroll-area min-h-0 flex-1 space-y-1 px-3 pb-24">
        {progress.map((p) => (
          <li key={p.budget.id}>
            <button
              type="button"
              onClick={() => showTransactions({ kind: 'expense', categoryIds: [p.category.id] }, { mode: 'month', anchor: `${month}-01` })}
              aria-label={`${p.category.name}: ${formatPercent(p.ratio, { digits: 0 })} del tope. ${budgetSentence(p)}`}
              className="block min-h-11 w-full rounded-xl px-2 py-2.5 text-left active:bg-raised"
            >
              <BudgetBar p={p} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
