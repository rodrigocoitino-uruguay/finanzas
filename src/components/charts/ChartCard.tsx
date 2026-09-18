import { ChartColumn, Table2 } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { cx } from '../../lib/cx';

export interface LegendItem {
  name: string;
  color: string;
  shape: 'bar' | 'line';
}

export function Legend({ items }: { items: readonly LegendItem[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
      {items.map((i) => (
        <li key={i.name} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={i.shape === 'bar' ? 'size-2.5 rounded-[3px]' : 'h-0.5 w-3 rounded-full'}
            style={{ backgroundColor: i.color }}
          />
          {i.name}
        </li>
      ))}
    </ul>
  );
}

interface ChartCardProps {
  title: string;
  legend?: readonly LegendItem[];
  /** Vista de tabla equivalente (accesible y para leer valores exactos). */
  table?: ReactNode;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function ChartCard({ title, legend, table, children, className, action }: ChartCardProps) {
  const [asTable, setAsTable] = useState(false);
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className={cx('rounded-card border border-line bg-surface px-4 pt-3 pb-3', className)}>
      <div className="flex min-h-8 items-center justify-between gap-2">
        <h3 id={titleId} className="text-[13px] font-medium text-muted">
          {title}
        </h3>
        <div className="flex items-center gap-1">
          {action}
          {table && (
            <button
              type="button"
              onClick={() => setAsTable((v) => !v)}
              aria-pressed={asTable}
              aria-label={asTable ? 'Ver gráfico' : 'Ver como tabla'}
              className="-mr-2 grid size-9 place-items-center rounded-full text-muted active:bg-raised"
            >
              {asTable ? <ChartColumn size={16} strokeWidth={1.5} /> : <Table2 size={16} strokeWidth={1.5} />}
            </button>
          )}
        </div>
      </div>
      {legend && !asTable && (
        <div className="mb-1">
          <Legend items={legend} />
        </div>
      )}
      {asTable ? (
        <div className="scroll-area max-h-64">{table}</div>
      ) : (
        <>
          {children}
          {table && <div className="sr-only">{table}</div>}
        </>
      )}
    </section>
  );
}

interface DataTableProps {
  caption: string;
  columns: readonly string[];
  rows: readonly { key: string; label: string; values: readonly string[] }[];
}

export function DataTable({ caption, columns, rows }: DataTableProps) {
  return (
    <table className="tabular w-full text-[13px]">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="text-left text-[11px] text-muted">
          <th scope="col" className="py-1.5 font-normal">
            Mes
          </th>
          {columns.map((c) => (
            <th key={c} scope="col" className="py-1.5 text-right font-normal">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className="border-t border-line">
            <th scope="row" className="py-1.5 text-left font-normal text-muted">
              {r.label}
            </th>
            {r.values.map((v, i) => (
              <td key={columns[i]} className="py-1.5 text-right">
                {v}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
