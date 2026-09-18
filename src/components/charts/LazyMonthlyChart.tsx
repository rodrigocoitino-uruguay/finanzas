import { lazy, Suspense } from 'react';
import type { MonthlyChartProps } from './MonthlyChart';

// Recharts pesa: se descarga aparte, recién cuando hace falta un gráfico.
const Impl = lazy(() => import('./MonthlyChart'));

export function MonthlyChart(props: MonthlyChartProps) {
  const empty = props.data.every((d) => props.series.every((s) => d[s.key] === 0));
  if (empty) {
    return (
      <div style={{ height: props.height }} className="grid place-items-center text-[13px] text-muted">
        Sin movimientos en estos meses
      </div>
    );
  }
  return (
    <Suspense fallback={<div style={{ height: props.height }} aria-busy="true" />}>
      <Impl {...props} />
    </Suspense>
  );
}
