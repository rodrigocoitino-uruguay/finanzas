import { useMemo } from 'react';
import { ChartCard, Legend } from '../../components/charts/ChartCard';
import { Donut } from '../../components/charts/Donut';
import { MonthlyChart } from '../../components/charts/LazyMonthlyChart';
import { MonthlyTable } from '../../components/charts/MonthlyTable';
import type { ChartSeries } from '../../components/charts/monthlyTypes';
import { Ranking } from '../../components/charts/Ranking';
import { CHART } from '../../components/charts/theme';
import { SubTabs } from '../../components/ui/SubTabs';
import {
  INCOME_GROUP_COLOR,
  breakdownByCategory,
  breakdownByIncomeGroup,
  computeTotals,
  monthlySeries,
  spendingRatio,
  usdSpentInPesos,
  type MonthPoint,
  type Slice,
} from '../../domain/analytics';
import { sumMoney } from '../../domain/money';
import { GROUP_LABEL, type IncomeGroup } from '../../domain/types';
import { normalizeName } from '../../domain/categories';
import { capitalize, formatDate, todayISO } from '../../lib/dates';
import { cx } from '../../lib/cx';
import { formatAmount, formatMoney, formatPercent } from '../../lib/format';
import { useUI, type IncomeView } from '../../store/ui';
import { StatRow } from '../analytics/StatRow';
import { useAnalytics } from '../analytics/useAnalytics';

const VIEWS = [
  { value: 'types', label: 'Por tipo' },
  { value: 'compare', label: 'Ingresos vs. gastos' },
] as const satisfies readonly { value: IncomeView; label: string }[];

const COMPARE: ChartSeries[] = [
  { key: 'income', name: 'Ingresos', color: CHART.income, kind: 'bar' },
  { key: 'expense', name: 'Gastos', color: CHART.expense, kind: 'bar' },
  { key: 'balance', name: 'Saldo', color: CHART.balance, kind: 'line' },
];

export function IncomeTab() {
  const a = useAnalytics();
  const view = useUI((s) => s.incomeView);
  const setView = useUI((s) => s.setIncomeView);

  const { ratio, usd } = useMemo(() => {
    const totals = computeTotals(a.current, a.categories, a.currency);
    return { ratio: spendingRatio(totals), usd: usdSpentInPesos(a.current) };
  }, [a.current, a.categories, a.currency]);

  const over = ratio !== null && ratio > 1;

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 space-y-3 px-5 pt-1">
        <div className="grid grid-cols-2 gap-3">
          <section aria-label="Parte del ingreso que se va en gastos" className="rounded-card border border-line bg-surface px-4 py-3">
            <h2 className="text-[12px] text-muted">Se va en gastos</h2>
            <p className={cx('mt-0.5 text-[24px] tracking-tight', over && 'text-warn')}>
              {ratio === null ? '—' : formatPercent(ratio, { digits: 0 })}
            </p>
            <div aria-hidden="true" className="mt-1.5 h-1 rounded-full bg-line">
              <div
                className={cx('h-1 rounded-full transition-[width] duration-250', over ? 'bg-warn' : 'bg-expense')}
                style={{ width: `${Math.min(1, ratio ?? 0) * 100}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-muted">{ratio === null ? 'Sin ingresos en el período' : 'de lo que ingresó'}</p>
          </section>
          <section aria-label="Dólares que se fueron en pesos" className="rounded-card border border-line bg-surface px-4 py-3">
            <h2 className="text-[12px] text-muted">USD que se fueron en pesos</h2>
            <p className="mt-0.5 truncate text-[24px] tracking-tight">{formatMoney(usd, 'USD', { decimals: 'never' })}</p>
            <p className="mt-2.5 text-[11px] leading-snug text-muted">Gastos en UYU, a la cotización de cada día</p>
          </section>
        </div>
        <SubTabs label="Vista" tabs={VIEWS} value={view} onChange={setView} />
      </div>
      <div className="min-h-0 flex-1">{view === 'types' ? <TypesView /> : <CompareView />}</div>
    </div>
  );
}

function TypesView() {
  const a = useAnalytics();
  const showTransactions = useUI((s) => s.showTransactions);

  const { groups, byCategory, total } = useMemo(() => {
    const groups = breakdownByIncomeGroup(a.current, a.categories, a.currency);
    // Cada detalle con el color de su tipo: así el ranking habla el mismo idioma que la dona.
    const byCategory = breakdownByCategory(a.current, a.categories, a.currency, { kind: 'income' }).map((s) => {
      const g: IncomeGroup = s.group === 'salary' || s.group === 'freelance' ? s.group : 'other';
      return { ...s, color: INCOME_GROUP_COLOR[g] };
    });
    return { groups, byCategory, total: sumMoney(groups.map((g) => g.amount)) };
  }, [a.current, a.categories, a.currency]);

  const money = (n: number) => formatAmount(n, a.currency);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-4 px-5 pt-4 pb-2">
        <Donut
          slices={groups}
          size={148}
          thickness={18}
          label={`Ingresos por tipo, total ${money(total)}. Tocá una porción para ver sus movimientos.`}
          formatValue={money}
          onSelect={(s) => showTransactions({ kind: 'income', group: s.id as IncomeGroup })}
          center={
            <>
              <span className="text-[11px] text-muted">Ingresos</span>
              <span className="text-[16px] leading-tight tracking-tight">{money(total)}</span>
            </>
          }
        />
        <ul className="min-w-0 flex-1 space-y-1">
          {groups.length === 0 && <li className="text-[13px] text-muted">Sin ingresos en este período.</li>}
          {groups.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => showTransactions({ kind: 'income', group: g.id as IncomeGroup })}
                className="flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-left active:bg-raised"
              >
                <span aria-hidden="true" className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: g.color }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px]">{g.name}</span>
                  <span className="tabular block text-[12px] text-muted">
                    {money(g.amount)} · {formatPercent(g.share)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="scroll-area min-h-0 flex-1 px-3 pb-24">
        {byCategory.length > 0 && (
          <>
            <h3 className="px-2 pt-2 pb-1 text-[12px] text-muted">Por detalle</h3>
            <Ranking
              items={byCategory}
              formatValue={money}
              subtitle={(s: Slice) =>
                s.group && normalizeName(GROUP_LABEL[s.group]) !== normalizeName(s.name) ? GROUP_LABEL[s.group] : undefined
              }
              onSelect={(s) => showTransactions({ kind: 'income', categoryIds: s.categoryIds })}
            />
          </>
        )}
      </div>
    </div>
  );
}

function monthName(p: MonthPoint) {
  return capitalize(formatDate(`${p.month}-01`, 'MMM yyyy').replace('.', ''));
}

function CompareView() {
  const a = useAnalytics();
  const showTransactions = useUI((s) => s.showTransactions);
  const data = useMemo(
    () => monthlySeries(a.all, a.categories, a.currency, a.evolution),
    [a.all, a.categories, a.currency, a.evolution],
  );
  const money = (n: number) => formatAmount(n, a.currency);
  const current = todayISO().slice(0, 7);
  const active = data.filter((d) => d.income > 0 || d.expense > 0);
  const closed = active.filter((d) => d.month < current);
  const withData = closed.length > 0 ? closed : active;
  const avgBalance = withData.length ? sumMoney(withData.map((d) => d.balance)) / withData.length : 0;
  const best = withData.reduce<MonthPoint | null>((m, d) => (!m || d.balance > m.balance ? d : m), null);
  const negatives = withData.filter((d) => d.balance < 0).length;

  return (
    <div className="scroll-area h-full space-y-3 px-5 pt-4 pb-24">
      <ChartCard
        title={`Por mes · ${data.length} meses`}
        table={<MonthlyTable data={data} series={COMPARE} currency={a.currency} caption="Ingresos, gastos y saldo por mes" />}
      >
        <div className="mb-1">
          <Legend items={COMPARE.map((s) => ({ name: s.name, color: s.color, shape: s.kind }))} />
        </div>
        <MonthlyChart
          data={data}
          series={COMPARE}
          currency={a.currency}
          height={210}
          label={`Ingresos y gastos por mes, con la línea de saldo: ${data
            .map((d) => `${monthName(d)}: ingresos ${money(d.income)}, gastos ${money(d.expense)}, saldo ${money(d.balance)}`)
            .join('. ')}`}
          onSelectMonth={(month) => showTransactions({}, { mode: 'month', anchor: `${month}-01` })}
        />
      </ChartCard>
      <StatRow
        stats={[
          { label: 'Saldo medio', value: money(avgBalance), hint: closed.length > 0 ? 'meses cerrados' : 'por mes' },
          { label: 'Mejor mes', value: best ? money(best.balance) : '—', hint: best ? monthName(best) : undefined },
          { label: 'En negativo', value: String(negatives), hint: `de ${withData.length} meses` },
        ]}
      />
    </div>
  );
}
