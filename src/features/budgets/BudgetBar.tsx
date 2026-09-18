import { TriangleAlert } from 'lucide-react';
import type { BudgetProgress } from '../../domain/budgets';
import { cx } from '../../lib/cx';
import { formatAmount, formatPercent } from '../../lib/format';

const FILL = { ok: 'bg-expense', warn: 'bg-warn', over: 'bg-alert' } as const;
const TEXT = { ok: 'text-muted', warn: 'text-warn', over: 'text-alert' } as const;

export function budgetSentence(p: BudgetProgress): string {
  const money = (n: number) => formatAmount(n, p.budget.currency);
  const left = p.budget.amount - p.spent;
  if (p.state === 'over') return `${money(-left)} por encima del tope`;
  if (left === 0) return 'Llegaste al tope';
  return `Quedan ${money(left)}`;
}

/** Barra de avance: azul hasta 80 %, ámbar hasta 100 %, alerta sobria arriba de 100 %. */
export function BudgetBar({ p, compact }: { p: BudgetProgress; compact?: boolean }) {
  const money = (n: number) => formatAmount(n, p.budget.currency);
  return (
    <span className="block">
      <span className="flex items-baseline gap-2">
        <span aria-hidden="true" className="size-2 shrink-0 self-center rounded-full" style={{ backgroundColor: p.category.color }} />
        <span className="min-w-0 flex-1 truncate text-[14px]">{p.category.name}</span>
        {p.state !== 'ok' && (
          <TriangleAlert size={13} strokeWidth={1.75} className={cx('shrink-0 self-center', TEXT[p.state])} aria-hidden="true" />
        )}
        <span className={cx('tabular shrink-0 text-[13px]', p.state === 'ok' ? 'text-muted' : TEXT[p.state])}>
          {formatPercent(p.ratio, { digits: 0 })}
        </span>
      </span>
      <span aria-hidden="true" className="mt-1.5 ml-4 block h-1.5 overflow-hidden rounded-full bg-line">
        <span
          className={cx('block h-full rounded-full transition-[width] duration-250', FILL[p.state])}
          style={{ width: `${Math.min(1, p.ratio) * 100}%` }}
        />
      </span>
      {!compact && (
        <span className="tabular mt-1 ml-4 flex justify-between gap-2 text-[12px] text-muted">
          <span>
            {money(p.spent)} de {money(p.budget.amount)}
            {p.pending > 0 && ` · +${money(p.pending)} pendiente`}
          </span>
          <span className={p.state === 'ok' ? undefined : TEXT[p.state]}>{budgetSentence(p)}</span>
        </span>
      )}
    </span>
  );
}
