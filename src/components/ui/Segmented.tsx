import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Color del texto cuando está elegida. */
  tone?: 'income' | 'expense';
}

interface SegmentedProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  size?: 'sm' | 'md';
  className?: string;
}

const TONE: Record<NonNullable<SegmentedOption<string>['tone']>, string> = {
  income: 'text-income',
  expense: 'text-expense',
};

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'md',
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cx('flex rounded-full border border-line bg-surface p-1', className)}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={cx(
              'flex-1 whitespace-nowrap rounded-full transition-colors duration-200',
              size === 'sm' ? 'min-h-9 px-3 text-[13px]' : 'min-h-9 px-4 text-[15px]',
              selected ? cx('bg-line font-medium', o.tone ? TONE[o.tone] : 'text-fg') : 'text-muted',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
