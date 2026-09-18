export type SeriesKey = 'fixed' | 'variable' | 'expense' | 'income' | 'balance';

export interface ChartSeries {
  key: SeriesKey;
  name: string;
  color: string;
  kind: 'bar' | 'line';
  /** Barras con el mismo stack se apilan. */
  stack?: string;
}
