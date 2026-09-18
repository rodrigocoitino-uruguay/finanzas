import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cx } from '../../lib/cx';
import { formatPercent } from '../../lib/format';

interface DeltaProps {
  /** Variación relativa (0,12 = +12 %). null = sin comparación. */
  value: number | null;
  /** true si subir es bueno (ingresos); false si subir es malo (gastos). */
  upIsGood: boolean;
  /** "vs. agosto" */
  against: string;
}

export function Delta({ value, upIsGood, against }: DeltaProps) {
  if (value === null || !Number.isFinite(value)) {
    return <span className="block text-[12px] text-muted">Sin datos {against}</span>;
  }
  const flat = Math.abs(value) < 0.005;
  const up = value > 0;
  const good = flat ? null : up === upIsGood;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="flex flex-wrap items-center gap-x-1 text-[12px] leading-snug">
      <span className={cx('flex items-center gap-0.5', good === null ? 'text-muted' : good ? 'text-income' : 'text-warn')}>
        <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
        <span className="tabular">{flat ? 'Igual' : formatPercent(value, { signed: true })}</span>
      </span>
      <span className="text-muted">{against}</span>
    </span>
  );
}
