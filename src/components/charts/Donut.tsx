import type { KeyboardEvent, ReactNode } from 'react';
import { formatPercent } from '../../lib/format';

export interface DonutSlice {
  id: string;
  name: string;
  color: string;
  amount: number;
  share: number;
}

interface DonutProps {
  slices: readonly DonutSlice[];
  /** Texto accesible del gráfico completo. */
  label: string;
  size?: number;
  thickness?: number;
  center?: ReactNode;
  formatValue: (n: number) => string;
  onSelect?: (slice: DonutSlice) => void;
}

const GAP = 2; // px de separación (color de la superficie) entre porciones
const MIN_ANGLE = 0.035; // rad: las porciones mínimas igual se ven y se pueden tocar

function point(cx: number, cy: number, r: number, a: number): [number, number] {
  return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
}

function arcPath(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = point(cx, cy, r1, a0);
  const [x1, y1] = point(cx, cy, r1, a1);
  const [x2, y2] = point(cx, cy, r0, a1);
  const [x3, y3] = point(cx, cy, r0, a0);
  return `M${x0} ${y0}A${r1} ${r1} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 ${large} 0 ${x3} ${y3}Z`;
}

/**
 * Dona dibujada a mano (SVG): porciones separadas por 2px, tocables y enfocables.
 * El ranking que la acompaña funciona como leyenda y tabla.
 */
export function Donut({ slices, label, size = 188, thickness = 22, center, formatValue, onSelect }: DonutProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r1 = size / 2 - 1;
  const r0 = r1 - thickness;
  const total = slices.reduce((a, s) => a + s.share, 0) || 1;

  // Ángulos con mínimo visible, reescalados para sumar 2π
  const raw = slices.map((s) => Math.max((s.share / total) * Math.PI * 2, MIN_ANGLE));
  const scale = (Math.PI * 2) / raw.reduce((a, b) => a + b, 0);
  let angle = 0;
  const arcs = slices.map((s, i) => {
    const a0 = angle;
    angle += raw[i] * scale;
    return { slice: s, a0, a1: angle };
  });

  const single = slices.length === 1;
  const gapAngle = single ? 0 : GAP / r1;

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="group" aria-label={label}>
        {slices.length === 0 && (
          <circle cx={cx} cy={cy} r={(r0 + r1) / 2} fill="none" stroke="var(--color-line)" strokeWidth={thickness} />
        )}
        {arcs.map(({ slice, a0, a1 }) => {
          const text = `${slice.name}: ${formatValue(slice.amount)}, ${formatPercent(slice.share)}`;
          const common = {
            fill: slice.color,
            role: onSelect ? 'button' : 'img',
            tabIndex: onSelect ? 0 : undefined,
            'aria-label': text,
            className:
              'outline-none transition-opacity duration-150 focus-visible:opacity-80 active:opacity-70' +
              (onSelect ? ' cursor-pointer' : ''),
            onClick: onSelect ? () => onSelect(slice) : undefined,
            onKeyDown: onSelect
              ? (e: KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(slice);
                  }
                }
              : undefined,
          } as const;
          if (single) {
            return (
              <g key={slice.id} {...common}>
                <title>{text}</title>
                <path
                  d={`${arcPath(cx, cy, r0, r1, 0, Math.PI)}${arcPath(cx, cy, r0, r1, Math.PI, Math.PI * 2)}`}
                />
              </g>
            );
          }
          const start = a0 + gapAngle / 2;
          const end = Math.max(start + 0.001, a1 - gapAngle / 2);
          return (
            <path key={slice.id} d={arcPath(cx, cy, r0, r1, start, end)} {...common}>
              <title>{text}</title>
            </path>
          );
        })}
      </svg>
      {center && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
          {center}
        </div>
      )}
    </div>
  );
}
