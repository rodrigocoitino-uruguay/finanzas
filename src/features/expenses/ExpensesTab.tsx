import { PiggyBank } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { ChartCard } from '../../components/charts/ChartCard';
import { Donut } from '../../components/charts/Donut';
import { MonthlyChart } from '../../components/charts/LazyMonthlyChart';
import { MonthlyTable } from '../../components/charts/MonthlyTable';
import type { ChartSeries } from '../../components/charts/monthlyTypes';
import { Ranking } from '../../components/charts/Ranking';
import { CHART } from '../../components/charts/theme';
import { Segmented } from '../../components/ui/Segmented';
import { SubTabs } from '../../components/ui/SubTabs';
import {
  OTHERS_ID,
  breakdownByCategory,
  monthlySeries,
  topWithOthers,
  type MonthPoint,
  type Slice,
} from '../../domain/analytics';
import { sumMoney } from '../../domain/money';
import { GROUP_LABEL } from '../../domain/types';
import { capitalize, formatDate, todayISO } from '../../lib/dates';
import { formatAmount } from '../../lib/format';
import { useUI, type ExpenseFilter, type ExpenseView } from '../../store/ui';
import { useAnalytics } from '../analytics/useAnalytics';
import { StatRow } from '../analytics/StatRow';

const FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'fixed', label: 'Fijos' },
  { value: 'variable', label: 'Variables' },
] as const satisfies readonly { value: ExpenseFilter; label: string }[];

const VIEWS = [
  { value: 'categories', label: 'Categorías' },
  { value: 'evolution', label: 'Evolución' },
  { value: 'budgets', label: 'Presupuestos' },
] as const satisfies readonly { value: ExpenseView; label: string }[];

const SERIES: Record<ExpenseFilter, ChartSeries[]> = {
  all: [
    { key: 'fixed', name: 'Fijos', color: CHART.fixed, kind: 'bar', stack: 'gastos' },
    { key: 'variable', name: 'Variables', color: CHART.variable, kind: 'bar', stack: 'gastos' },
  ],
  fixed: [{ key: 'fixed', name: 'Fijos', color: CHART.fixed, kind: 'bar' }],
  variable: [{ key: 'variable', name: 'Variables', color: CHART.variable, kind: 'bar' }],
};

export function ExpensesTab() {
  const filter = useUI((s) => s.expenseFilter);
  const setFilter = useUI((s) => s.setExpenseFilter);
  const view = useUI((s) => s.expenseView);
  const setView = useUI((s) => s.setExpenseView);

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 space-y-2 px-5 pt-1">
        <Segmented ariaLabel="Tipo de gasto" options={FILTERS} value={filter} onChange={setFilter} />
        <SubTabs label="Vista" tabs={VIEWS} value={view} onChange={setView} />
      </div>
      <div className="min-h-0 flex-1">
        {view === 'categories' && <CategoriesView filter={filter} />}
        {view === 'evolution' && <EvolutionView filter={filter} />}
        {view === 'budgets' && <BudgetsPlaceholder />}
      </div>
    </div>
  );
}

function CategoriesView({ filter }: { filter: ExpenseFilter }) {
  const a = useAnalytics();
  const showTransactions = useUI((s) => s.showTransactions);
  const [othersOpen, setOthersOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const group = filter === 'all' ? undefined : filter;

  const { slices, visible, rest, total } = useMemo(() => {
    const slices = breakdownByCategory(a.current, a.categories, a.currency, { kind: 'expense', group });
    return { slices, ...topWithOthers(slices), total: sumMoney(slices.map((s) => s.amount)) };
  }, [a.current, a.categories, a.currency, group]);

  const money = (n: number) => formatAmount(n, a.currency);
  const goTo = (s: Slice) => showTransactions({ kind: 'expense', group, categoryIds: s.categoryIds });
  const onDonut = (s: Slice) => {
    if (s.id !== OTHERS_ID) return goTo(s);
    setOthersOpen(true);
    requestAnimationFrame(() => {
      listRef.current?.querySelector('[aria-expanded]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };
  const title = filter === 'all' ? 'Gastos' : filter === 'fixed' ? 'Gastos fijos' : 'Gastos variables';

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 pt-4 pb-2">
        <Donut
          slices={visible}
          size={176}
          label={`${title} por categoría: ${slices.length} categorías, total ${money(total)}. Tocá una porción para ver sus movimientos.`}
          formatValue={money}
          onSelect={(s) => onDonut(s as Slice)}
          center={
            <>
              <span className="text-[12px] text-muted">{title}</span>
              <span className="mt-0.5 text-[20px] leading-tight tracking-tight">{money(total)}</span>
              <span className="text-[11px] text-muted">
                {slices.length === 1 ? '1 categoría' : `${slices.length} categorías`}
              </span>
            </>
          }
        />
      </div>
      <div ref={listRef} className="scroll-area min-h-0 flex-1 px-3 pb-24">
        {slices.length === 0 ? (
          <p className="px-2 py-6 text-center text-[14px] text-muted">No hay gastos en este período.</p>
        ) : (
          <Ranking
            items={visible}
            rest={rest}
            othersOpen={othersOpen}
            onToggleOthers={() => setOthersOpen((v) => !v)}
            formatValue={money}
            onSelect={goTo}
            subtitle={(s) => (filter === 'all' && s.group ? GROUP_LABEL[s.group] : undefined)}
          />
        )}
      </div>
    </div>
  );
}

function monthName(p: MonthPoint) {
  return capitalize(formatDate(`${p.month}-01`, 'MMM yyyy').replace('.', ''));
}

function EvolutionView({ filter }: { filter: ExpenseFilter }) {
  const a = useAnalytics();
  const showTransactions = useUI((s) => s.showTransactions);
  const group = filter === 'all' ? undefined : filter;
  const series = SERIES[filter];
  const key = filter === 'all' ? 'expense' : filter;

  const data = useMemo(
    () => monthlySeries(a.all, a.categories, a.currency, a.evolution),
    [a.all, a.categories, a.currency, a.evolution],
  );
  const money = (n: number) => formatAmount(n, a.currency);
  // El mes en curso está incompleto: no cuenta para promedio, máximo ni mínimo.
  const current = todayISO().slice(0, 7);
  const closed = data.filter((d) => d[key] > 0 && d.month < current);
  const withData = closed.length > 0 ? closed : data.filter((d) => d[key] > 0);
  const avg = withData.length ? sumMoney(withData.map((d) => d[key])) / withData.length : 0;
  const max = withData.reduce<MonthPoint | null>((m, d) => (!m || d[key] > m[key] ? d : m), null);
  const min = withData.reduce<MonthPoint | null>((m, d) => (!m || d[key] < m[key] ? d : m), null);

  return (
    <div className="scroll-area h-full space-y-3 px-5 pt-4 pb-24">
      <ChartCard
        title={`Gastos por mes · ${data.length} meses`}
        legend={series.map((s) => ({ name: s.name, color: s.color, shape: s.kind }))}
        table={<MonthlyTable data={data} series={series} currency={a.currency} caption="Gastos por mes" />}
      >
        <MonthlyChart
          data={data}
          series={series}
          currency={a.currency}
          height={236}
          label={`Gastos por mes: ${data.map((d) => `${monthName(d)} ${money(d[key])}`).join(', ')}. Tocá un mes para ver sus movimientos.`}
          onSelectMonth={(month) => showTransactions({ kind: 'expense', group }, { mode: 'month', anchor: `${month}-01` })}
        />
      </ChartCard>
      <StatRow
        stats={[
          { label: 'Promedio', value: money(avg), hint: closed.length > 0 ? 'meses cerrados' : 'por mes' },
          { label: 'Mes más alto', value: max ? money(max[key]) : '—', hint: max ? monthName(max) : undefined },
          { label: 'Mes más bajo', value: min ? money(min[key]) : '—', hint: min ? monthName(min) : undefined },
        ]}
      />
    </div>
  );
}

function BudgetsPlaceholder() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-10 pb-24 text-center">
      <PiggyBank size={30} strokeWidth={1.2} className="text-muted" aria-hidden="true" />
      <p className="text-[15px] text-muted">
        Los presupuestos llegan en la fase 4: un tope mensual por categoría, con aviso al 80&nbsp;% y al 100&nbsp;%.
      </p>
    </div>
  );
}
