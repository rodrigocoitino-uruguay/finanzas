import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Segmented } from '../../components/ui/Segmented';
import { Sheet } from '../../components/ui/Sheet';
import { removeBudget, setBudget } from '../../db/budgets';
import { db } from '../../db/db';
import { useBudgets, useCategories } from '../../db/hooks';
import { ValidationError } from '../../db/transactions';
import { displayAmount, parseAmount, sanitizeAmountInput, amountToCanonical } from '../../domain/amount';
import { fromCents, toCents } from '../../domain/money';
import type { Budget, Category, Currency } from '../../domain/types';
import { cx } from '../../lib/cx';
import { addMonthsISO, todayISO } from '../../lib/dates';
import { formatAmount } from '../../lib/format';
import { toast } from '../../store/toast';
import { useUI } from '../../store/ui';

export function BudgetsSheet() {
  const open = useUI((s) => s.panel === 'budgets');
  const setPanel = useUI((s) => s.setPanel);
  return (
    <Sheet open={open} onClose={() => setPanel(null)} title="Presupuestos mensuales">
      <BudgetEditor />
    </Sheet>
  );
}

/** Promedio mensual de gasto por categoría en los últimos 3 meses cerrados (sugerencia de tope). */
function useMonthlyAverages() {
  return useLiveQuery(async () => {
    const thisMonth = `${todayISO().slice(0, 7)}-01`;
    const from = addMonthsISO(thisMonth, -3);
    const txs = await db.transactions.where('date').between(from, thisMonth, true, false).toArray();
    const acc = new Map<string, { UYU: number; USD: number }>();
    for (const t of txs) {
      if (t.kind !== 'expense' || t.status !== 'confirmed') continue;
      const a = acc.get(t.categoryId) ?? { UYU: 0, USD: 0 };
      a.UYU += toCents(t.amountUYU);
      a.USD += toCents(t.amountUSD);
      acc.set(t.categoryId, a);
    }
    return new Map([...acc].map(([id, a]) => [id, { UYU: fromCents(a.UYU / 3), USD: fromCents(a.USD / 3) }]));
  }, []);
}

function BudgetEditor() {
  const categories = useCategories();
  const budgets = useBudgets();
  const averages = useMonthlyAverages();
  const [editing, setEditing] = useState<string | null>(null);

  const byCategory = useMemo(() => new Map(budgets.map((b) => [b.categoryId, b])), [budgets]);
  const list = useMemo(
    () =>
      categories
        .filter((c) => c.kind === 'expense' && (!c.archived || byCategory.has(c.id)))
        .sort(
          (a, b) =>
            Number(byCategory.has(b.id)) - Number(byCategory.has(a.id)) ||
            a.group.localeCompare(b.group) ||
            a.name.localeCompare(b.name, 'es'),
        ),
    [categories, byCategory],
  );

  if (list.length === 0) {
    return <p className="py-6 text-center text-[15px] text-muted">Primero cargá algún gasto para tener categorías.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted">
        Un tope por mes para cada categoría. Te avisamos en el Resumen cuando pasás el 80&nbsp;% y el 100&nbsp;%.
      </p>
      <ul className="divide-y divide-line">
        {list.map((c) => (
          <li key={c.id}>
            {editing === c.id ? (
              <BudgetForm
                category={c}
                budget={byCategory.get(c.id)}
                average={averages?.get(c.id)}
                onDone={() => setEditing(null)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditing(c.id)}
                className="flex min-h-12 w-full items-center gap-3 text-left active:bg-raised"
              >
                <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                <span className="min-w-0 flex-1 truncate text-[15px]">{c.name}</span>
                <span className={cx('tabular text-[14px]', byCategory.has(c.id) ? 'text-fg' : 'text-muted')}>
                  {byCategory.has(c.id)
                    ? formatAmount(byCategory.get(c.id)!.amount, byCategory.get(c.id)!.currency)
                    : 'Sin tope'}
                </span>
                <ChevronRight size={16} strokeWidth={1.5} className="text-muted" aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

interface BudgetFormProps {
  category: Category;
  budget?: Budget;
  average?: { UYU: number; USD: number };
  onDone: () => void;
}

function BudgetForm({ category, budget, average, onDone }: BudgetFormProps) {
  const [currency, setCurrency] = useState<Currency>(budget?.currency ?? 'UYU');
  const [value, setValue] = useState(budget ? amountToCanonical(budget.amount) : '');
  const amount = parseAmount(value);
  const shown = displayAmount(value);
  const avg = average?.[currency] ?? 0;

  const save = async () => {
    try {
      await setBudget(category.id, amount ?? 0, currency);
      toast(`Tope de ${category.name}: ${formatAmount(amount ?? 0, currency)} por mes`);
      onDone();
    } catch (e) {
      toast(e instanceof ValidationError ? e.message : 'No se pudo guardar');
    }
  };

  return (
    <div className="space-y-3 py-3">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
        <span className="min-w-0 flex-1 truncate text-[15px]">{category.name}</span>
        <Segmented
          ariaLabel="Moneda del tope"
          size="sm"
          options={[
            { value: 'UYU', label: 'UYU' },
            { value: 'USD', label: 'USD' },
          ]}
          value={currency}
          onChange={setCurrency}
        />
      </div>
      <label className="block text-[12px] text-muted">
        Tope por mes
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoFocus
          placeholder={avg > 0 ? formatAmount(avg, currency).replace(/[^\d.,]/g, '') : '0'}
          value={shown}
          onChange={(e) => setValue(sanitizeAmountInput(e.target.value, shown))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save();
          }}
          className="tabular mt-1 min-h-12 w-full rounded-xl border border-line bg-raised px-3 text-[18px] text-fg outline-none"
        />
      </label>
      {avg > 0 && (
        <button
          type="button"
          onClick={() => setValue(amountToCanonical(Math.round(avg)))}
          className="text-[12px] text-muted underline underline-offset-2"
        >
          Promedio de los últimos 3 meses: {formatAmount(avg, currency)}
        </button>
      )}
      <div className="flex gap-2">
        {budget ? (
          <button
            type="button"
            onClick={async () => {
              await removeBudget(category.id);
              toast(`Se quitó el tope de ${category.name}`);
              onDone();
            }}
            className="min-h-11 flex-1 rounded-full border border-line text-[14px] text-alert active:bg-raised"
          >
            Quitar tope
          </button>
        ) : (
          <button type="button" onClick={onDone} className="min-h-11 flex-1 rounded-full border border-line text-[14px] active:bg-raised">
            Cancelar
          </button>
        )}
        <button
          type="button"
          disabled={!(amount && amount > 0)}
          onClick={() => void save()}
          className="min-h-11 flex-1 rounded-full bg-fg text-[14px] font-medium text-bg active:opacity-80 disabled:opacity-30"
        >
          Guardar
        </button>
      </div>
    </div>
  );
}
