import { ChevronRight, Sparkles, TriangleAlert } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { ChartCard } from '../../components/charts/ChartCard';
import { MonthlyChart } from '../../components/charts/LazyMonthlyChart';
import { MonthlyTable } from '../../components/charts/MonthlyTable';
import type { ChartSeries } from '../../components/charts/monthlyTypes';
import { CHART } from '../../components/charts/theme';
import { Delta } from '../../components/ui/Delta';
import { computeTotals, groupShare, monthlySeries } from '../../domain/analytics';
import { otherCurrency, sumMoney, variation } from '../../domain/money';
import { signedAmountIn } from '../../domain/transactions';
import { periodLabel } from '../../domain/periods';
import { cx } from '../../lib/cx';
import { formatAmount, formatPercent } from '../../lib/format';
import { useUI } from '../../store/ui';
import { useAnalytics } from '../analytics/useAnalytics';
import { AttentionCard } from './AttentionCard';

const SERIES: ChartSeries[] = [
  { key: 'fixed', name: 'Fijos', color: CHART.fixed, kind: 'bar', stack: 'gastos' },
  { key: 'variable', name: 'Variables', color: CHART.variable, kind: 'bar', stack: 'gastos' },
  { key: 'income', name: 'Ingresos', color: CHART.income, kind: 'line' },
];

export function SummaryTab() {
  const a = useAnalytics();
  const setTab = useUI((s) => s.setTab);
  const showTransactions = useUI((s) => s.showTransactions);

  const data = useMemo(() => {
    const totals = computeTotals(a.current, a.categories, a.currency);
    const other = otherCurrency(a.currency);
    // Proyección: lo confirmado más los recurrentes pendientes del período.
    const pending = a.current.filter((t) => t.status === 'pending');
    const projected = pending.length
      ? sumMoney([totals.balance, ...pending.map((t) => signedAmountIn(t, a.currency))])
      : null;
    return {
      totals,
      projected,
      other,
      balanceOther: computeTotals(a.current, a.categories, other).balance,
      prev: computeTotals(a.previous, a.categories, a.currency),
      series: monthlySeries(a.all, a.categories, a.currency, a.summary),
    };
  }, [a.current, a.previous, a.all, a.categories, a.currency, a.summary]);

  const { totals, prev, series } = data;
  const share = groupShare(totals.fixed, totals.variable);
  const negative = totals.balance < 0;
  const empty = !a.loading && a.all.length === 0;
  const money = (n: number) => formatAmount(n, a.currency);
  const against = a.comparisonLabel;

  return (
    <div className="scroll-area h-full space-y-3 px-5 pt-1 pb-24">
      {/* Saldo */}
      <section
        aria-label="Saldo del período"
        className={cx(
          'rounded-card px-5 pt-4 pb-4',
          negative ? 'border border-warn/30 bg-negative-bg' : 'bg-balance-deep',
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className={cx('text-[13px]', negative ? 'text-negative-soft' : 'text-balance-soft')}>
            Saldo · {periodLabel(a.period)}
          </h2>
          {negative && (
            <span className="flex items-center gap-1 text-[12px] text-warn">
              <TriangleAlert size={14} strokeWidth={1.75} aria-hidden="true" />
              Negativo
            </span>
          )}
        </div>
        <p
          className={cx(
            'mt-1.5 leading-none font-light tracking-tight text-fg',
            money(totals.balance).length <= 13 ? 'text-[40px]' : 'text-[32px]',
          )}
        >
          {money(totals.balance)}
        </p>
        <div
          className={cx(
            'mt-2 flex flex-wrap items-baseline justify-between gap-x-3 text-[13px]',
            negative ? 'text-negative-soft' : 'text-balance-soft',
          )}
        >
          <span>≈ {formatAmount(data.balanceOther, data.other)}</span>
          {data.projected !== null && (
            <span aria-label={`Proyectado a fin de mes con los recurrentes pendientes: ${money(data.projected)}`}>
              {a.period.mode === 'month' ? 'Proyectado a fin de mes' : 'Con pendientes'}{' '}
              <span className="text-fg">{money(data.projected)}</span>
            </span>
          )}
        </div>
      </section>

      <AttentionCard />

      {empty && (
        <section className="flex items-start gap-3 rounded-card border border-line bg-surface p-4">
          <Sparkles size={18} strokeWidth={1.5} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
          <p className="text-[14px] text-muted">
            Todavía no cargaste movimientos. Tocá <span className="text-fg">+</span> para empezar, o cargá datos de
            ejemplo desde <button type="button" className="text-fg underline underline-offset-2" onClick={() => setTab('settings')}>Ajustes</button>.
          </p>
        </section>
      )}

      {/* Ingresos y gastos */}
      <div className="grid grid-cols-2 items-stretch gap-3">
        <TotalCard
          label="Ingresos"
          dot="bg-income"
          value={money(totals.income)}
          delta={<Delta value={variation(totals.income, prev.income)} upIsGood against={against} />}
          onClick={() => setTab('income')}
        />
        <TotalCard
          label="Gastos"
          dot="bg-expense"
          value={money(totals.expense)}
          delta={<Delta value={variation(totals.expense, prev.expense)} upIsGood={false} against={against} />}
          onClick={() => setTab('expenses')}
          footer={
            totals.expense > 0 && (
              <span className="mt-2 block" aria-label={`Fijos ${formatPercent(share.fixed, { digits: 0 })}, variables ${formatPercent(share.variable, { digits: 0 })}`}>
                <span aria-hidden="true" className="flex h-1.5 gap-0.5 overflow-hidden rounded-full">
                  <span className="h-full rounded-l-full bg-fixed" style={{ width: `${share.fixed * 100}%` }} />
                  <span className="h-full flex-1 rounded-r-full bg-variable" />
                </span>
                <span aria-hidden="true" className="tabular mt-1 flex justify-between text-[11px] text-muted">
                  <span>Fijos {formatPercent(share.fixed, { digits: 0 })}</span>
                  <span>Var. {formatPercent(share.variable, { digits: 0 })}</span>
                </span>
              </span>
            )
          }
        />
      </div>

      {/* Últimos 6 meses */}
      <ChartCard
        title="Últimos 6 meses"
        legend={SERIES.map((s) => ({ name: s.name, color: s.color, shape: s.kind }))}
        table={<MonthlyTable data={series} series={SERIES} currency={a.currency} caption="Gastos e ingresos por mes" />}
      >
        <MonthlyChart
          data={series}
          series={SERIES}
          currency={a.currency}
          height={112}
          label={`Gastos fijos y variables apilados e ingresos de los últimos 6 meses. ${series
            .map((p) => `${p.month}: gastos ${money(p.expense)}, ingresos ${money(p.income)}`)
            .join('. ')}`}
          onSelectMonth={(month) => showTransactions({}, { mode: 'month', anchor: `${month}-01` })}
        />
      </ChartCard>
    </div>
  );
}

interface TotalCardProps {
  label: string;
  dot: string;
  value: string;
  delta: ReactNode;
  footer?: ReactNode;
  onClick: () => void;
}

function TotalCard({ label, dot, value, delta, footer, onClick }: TotalCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-0 flex-col rounded-card border border-line bg-surface px-4 py-3 text-left transition-colors duration-150 active:bg-raised"
    >
      <span className="flex items-center gap-1.5 text-[13px] text-muted">
        <span aria-hidden="true" className={cx('size-2 rounded-full', dot)} />
        {label}
        <ChevronRight size={14} strokeWidth={1.5} className="ml-auto" aria-hidden="true" />
      </span>
      <span
        className={cx(
          'mt-1 block truncate font-normal tracking-tight',
          value.length <= 9 ? 'text-[22px]' : value.length <= 12 ? 'text-[19px]' : 'text-[16px]',
        )}
      >
        {value}
      </span>
      <span className="mt-0.5 block">{delta}</span>
      {footer}
    </button>
  );
}
