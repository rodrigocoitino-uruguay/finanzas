import { cx } from '../../lib/cx';
import { formatMoney, type DecimalsMode } from '../../lib/format';
import type { Currency } from '../../domain/types';

interface MoneyProps {
  value: number;
  currency: Currency;
  signed?: boolean;
  decimals?: DecimalsMode;
  prefix?: string;
  className?: string;
}

export function Money({ value, currency, signed, decimals, prefix, className }: MoneyProps) {
  return (
    <span className={cx('tabular whitespace-nowrap', className)}>
      {prefix}
      {formatMoney(value, currency, { signed, decimals })}
    </span>
  );
}
