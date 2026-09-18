import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { OTHERS_ID, type Slice } from '../../domain/analytics';
import { formatPercent } from '../../lib/format';

const pct = (share: number) => formatPercent(share, { digits: share < 0.1 ? 1 : 0 });

interface RankingProps {
  items: readonly Slice[];
  /** Categorías agrupadas en "Otros". */
  rest?: readonly Slice[];
  othersOpen?: boolean;
  onToggleOthers?: () => void;
  formatValue: (n: number) => string;
  onSelect: (slice: Slice) => void;
  subtitle?: (slice: Slice) => string | undefined;
}

/** Ranking de barras horizontales: funciona también como leyenda y tabla de la dona. */
export function Ranking({ items, rest = [], othersOpen = false, onToggleOthers, formatValue, onSelect, subtitle }: RankingProps) {
  const max = Math.max(...items.map((i) => i.share), ...rest.map((i) => i.share), 0.0001);

  return (
    <ul className="space-y-1">
      {items.map((s) => {
        const isOthers = s.id === OTHERS_ID;
        const Chevron = othersOpen ? ChevronDown : ChevronRight;
        return (
          <li key={s.id}>
            <Row
              slice={s}
              max={max}
              formatValue={formatValue}
              subtitle={isOthers ? `${rest.length} categorías` : subtitle?.(s)}
              trailing={isOthers ? <Chevron size={16} strokeWidth={1.5} aria-hidden="true" /> : undefined}
              expanded={isOthers ? othersOpen : undefined}
              onClick={() => (isOthers ? onToggleOthers?.() : onSelect(s))}
            />
            {isOthers && othersOpen && (
              <ul className="ml-4 animate-fade-in border-l border-line pl-2">
                {rest.map((r) => (
                  <li key={r.id}>
                    <Row slice={r} max={max} formatValue={formatValue} subtitle={subtitle?.(r)} onClick={() => onSelect(r)} />
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

interface RowProps {
  slice: Slice;
  max: number;
  formatValue: (n: number) => string;
  subtitle?: string;
  trailing?: ReactNode;
  expanded?: boolean;
  onClick: () => void;
}

function Row({ slice, max, formatValue, subtitle, trailing, expanded, onClick }: RowProps) {
  const width = Math.max(2, (slice.share / max) * 100);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      aria-label={`${slice.name}: ${formatValue(slice.amount)}, ${pct(slice.share)} del total${
        subtitle ? `, ${subtitle}` : ''
      }`}
      className="block min-h-11 w-full rounded-xl px-2 py-2 text-left transition-colors duration-150 active:bg-raised"
    >
      <span className="flex items-baseline gap-2">
        <span aria-hidden="true" className="size-2 shrink-0 self-center rounded-full" style={{ backgroundColor: slice.color }} />
        <span className="min-w-0 flex-1 truncate text-[14px]">
          {slice.name}
          {subtitle && <span className="ml-1.5 text-[12px] text-muted">{subtitle}</span>}
        </span>
        <span className="tabular shrink-0 text-[14px]">{formatValue(slice.amount)}</span>
        <span className="tabular w-12 shrink-0 text-right text-[12px] text-muted">{pct(slice.share)}</span>
        {trailing && <span className="-mr-1 shrink-0 text-muted">{trailing}</span>}
      </span>
      <span aria-hidden="true" className="mt-1.5 ml-4 block h-1 rounded-full bg-line">
        <span
          className="block h-1 rounded-full transition-[width] duration-250"
          style={{ width: `${width}%`, backgroundColor: slice.color }}
        />
      </span>
    </button>
  );
}
