import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts';
import type { MonthPoint } from '../../domain/analytics';
import type { Currency } from '../../domain/types';
import { capitalize, formatMonthShort, formatMonthYear } from '../../lib/dates';
import { formatAmount, formatCompact } from '../../lib/format';
import { usePrefersReducedMotion } from '../../lib/motion';
import type { ChartSeries, SeriesKey } from './monthlyTypes';
import { CHART } from './theme';

export interface MonthlyChartProps {
  data: readonly MonthPoint[];
  series: readonly ChartSeries[];
  currency: Currency;
  height: number;
  /** Resumen accesible del gráfico. */
  label: string;
  onSelectMonth?: (month: string) => void;
  /** Oculta el eje Y (gráficos muy chicos). */
  hideYAxis?: boolean;
}

type Row = MonthPoint & { label: string };

export default function MonthlyChart({ data, series, currency, height, label, onSelectMonth, hideYAxis }: MonthlyChartProps) {
  const reduced = usePrefersReducedMotion();
  const rows: Row[] = data.map((d) => ({ ...d, label: formatMonthShort(`${d.month}-01`) }));
  const bars = series.filter((s) => s.kind === 'bar');
  const lines = series.filter((s) => s.kind === 'line');
  const topOfStack = new Map<string, SeriesKey>();
  for (const b of bars) if (b.stack) topOfStack.set(b.stack, b.key);

  return (
    <div role="img" aria-label={label} style={{ height }} className="-mx-1 select-none">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={rows}
          margin={{ top: 6, right: 4, bottom: 0, left: hideYAxis ? 4 : 0 }}
          barGap={3}
          barCategoryGap="24%"
          accessibilityLayer={false}
          onClick={(state) => {
            if (!onSelectMonth || state.activeIndex === undefined || state.activeIndex === null) return;
            const row = rows[Number(state.activeIndex)];
            if (row) onSelectMonth(row.month);
          }}
          style={{ cursor: onSelectMonth ? 'pointer' : undefined }}
        >
          <CartesianGrid vertical={false} stroke={CHART.grid} strokeWidth={1} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: CHART.text, fontSize: 11 }}
            tickMargin={6}
            interval={0}
          />
          <YAxis
            hide={hideYAxis}
            width={38}
            tickLine={false}
            axisLine={false}
            tickCount={4}
            tick={{ fill: CHART.text, fontSize: 11 }}
            tickFormatter={(v: number) => formatCompact(v)}
          />
          <Tooltip
            cursor={{ fill: CHART.cursor }}
            content={(props) => (
              <ChartTooltip active={props.active} activeIndex={props.activeIndex} series={series} currency={currency} rows={rows} />
            )}
            isAnimationActive={false}
          />
          {bars.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name}
              stackId={s.stack}
              fill={s.color}
              maxBarSize={24}
              radius={!s.stack || topOfStack.get(s.stack) === s.key ? [4, 4, 0, 0] : 0}
              stroke={s.stack ? CHART.surface : undefined}
              strokeWidth={s.stack ? 2 : 0}
              isAnimationActive={!reduced}
              animationDuration={250}
            />
          ))}
          {lines.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={{ r: 4, fill: s.color, stroke: CHART.surface, strokeWidth: 2 }}
              activeDot={{ r: 5, fill: s.color, stroke: CHART.surface, strokeWidth: 2 }}
              isAnimationActive={!reduced}
              animationDuration={250}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

interface ChartTooltipProps {
  active?: boolean;
  activeIndex?: TooltipContentProps['activeIndex'];
  series: readonly ChartSeries[];
  currency: Currency;
  rows: readonly Row[];
}

function ChartTooltip({ active, activeIndex, series, currency, rows }: ChartTooltipProps) {
  if (!active || activeIndex === undefined || activeIndex === null) return null;
  const row = rows[Number(activeIndex)];
  if (!row) return null;
  return (
    <div className="rounded-xl border border-line bg-raised px-3 py-2 text-[12px] shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
      <p className="mb-1 text-muted">{capitalize(formatMonthYear(`${row.month}-01`))}</p>
      <ul className="space-y-0.5">
        {series.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted">
              <span aria-hidden="true" className="h-0.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
              {s.name}
            </span>
            <span className="tabular font-medium text-fg">{formatAmount(row[s.key], currency)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
