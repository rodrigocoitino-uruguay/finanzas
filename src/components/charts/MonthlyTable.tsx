import type { MonthPoint } from '../../domain/analytics';
import type { Currency } from '../../domain/types';
import { capitalize, formatMonthShort } from '../../lib/dates';
import { formatAmount } from '../../lib/format';
import { DataTable } from './ChartCard';
import type { ChartSeries } from './monthlyTypes';

export function MonthlyTable({
  data,
  series,
  currency,
  caption,
}: {
  data: readonly MonthPoint[];
  series: readonly ChartSeries[];
  currency: Currency;
  caption: string;
}) {
  return (
    <DataTable
      caption={caption}
      columns={series.map((s) => s.name)}
      rows={[...data].reverse().map((d) => ({
        key: d.month,
        label: capitalize(formatMonthShort(`${d.month}-01`)) + ` ${d.month.slice(2, 4)}`,
        values: series.map((s) => formatAmount(d[s.key], currency)),
      }))}
    />
  );
}
