import type { ReactNode } from 'react';

export interface Stat {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}

/** Fila de cifras chicas debajo de un gráfico. */
export function StatRow({ stats }: { stats: readonly Stat[] }) {
  return (
    <dl className="grid grid-cols-3 gap-2">
      {stats.map((s) => (
        <div key={s.label} className="min-w-0 rounded-card border border-line bg-surface px-3 py-2.5">
          <dt className="truncate text-[12px] text-muted">{s.label}</dt>
          <dd className="mt-0.5 truncate text-[15px]">{s.value}</dd>
          {s.hint && <dd className="truncate text-[11px] text-muted">{s.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}
