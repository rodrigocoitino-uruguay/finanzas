import { CategoryAvatar } from '../../components/ui/CategoryAvatar';
import { Money } from '../../components/ui/Money';
import { normalizeName } from '../../domain/categories';
import { otherCurrency } from '../../domain/money';
import { amountIn } from '../../domain/transactions';
import { GROUP_LABEL, type Category, type Transaction } from '../../domain/types';
import { cx } from '../../lib/cx';

interface TransactionRowProps {
  tx: Transaction;
  category?: Category;
}

export function TransactionRow({ tx, category }: TransactionRowProps) {
  const other = otherCurrency(tx.currency);
  const income = tx.kind === 'income';
  const pending = tx.status === 'pending';
  const groupLabel = category ? GROUP_LABEL[category.group] : null;
  const showGroup = groupLabel && normalizeName(groupLabel) !== category?.normalizedName;
  const subtitle = [showGroup ? groupLabel : null, tx.note].filter(Boolean).join(' · ');

  return (
    <div className={cx('flex min-h-[64px] items-center gap-3 px-5 py-2.5', pending && 'opacity-60')}>
      <CategoryAvatar name={category?.name} color={category?.color} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] leading-snug">
          {category?.name ?? 'Sin categoría'}
          {pending && (
            <span className="ml-2 rounded-full border border-warn/50 px-1.5 py-px align-middle text-[10px] uppercase tracking-wider text-warn">
              Pendiente
            </span>
          )}
        </p>
        {subtitle && <p className="truncate text-[13px] leading-snug text-muted">{subtitle}</p>}
      </div>
      <div className="shrink-0 text-right">
        <Money
          className={cx('block text-[15px] leading-snug', income ? 'text-income' : 'text-expense')}
          value={income ? tx.amount : -tx.amount}
          currency={tx.currency}
          signed
        />
        <Money
          className="block text-[12px] leading-snug text-muted"
          prefix="≈ "
          value={amountIn(tx, other)}
          currency={other}
        />
      </div>
    </div>
  );
}
