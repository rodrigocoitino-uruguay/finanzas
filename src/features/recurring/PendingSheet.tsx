import { useState } from 'react';
import { CategoryAvatar } from '../../components/ui/CategoryAvatar';
import { Sheet } from '../../components/ui/Sheet';
import { useCategoryMap, usePendingTransactions } from '../../db/hooks';
import { confirmPending, skipPending } from '../../db/recurring';
import { restoreTransaction } from '../../db/transactions';
import { otherCurrency } from '../../domain/money';
import { amountIn } from '../../domain/transactions';
import type { Transaction } from '../../domain/types';
import { cx } from '../../lib/cx';
import { formatDayMonth, todayISO } from '../../lib/dates';
import { formatMoney } from '../../lib/format';
import { toast } from '../../store/toast';
import { useUI } from '../../store/ui';

export function PendingSheet() {
  const open = useUI((s) => s.panel === 'pending');
  const setPanel = useUI((s) => s.setPanel);
  return (
    <Sheet open={open} onClose={() => setPanel(null)} title="Recurrentes para confirmar">
      <PendingList />
    </Sheet>
  );
}

function PendingList() {
  const pending = usePendingTransactions();
  const categories = useCategoryMap();
  const setPanel = useUI((s) => s.setPanel);
  const openEntry = useUI((s) => s.openEntry);
  const [busy, setBusy] = useState<string | null>(null);
  const today = todayISO();

  const confirm = async (tx: Transaction) => {
    setBusy(tx.id);
    try {
      await confirmPending(tx.id, today);
      toast(`${categories.get(tx.categoryId)?.name ?? 'Movimiento'} confirmado`);
    } finally {
      setBusy(null);
    }
  };

  const skip = async (tx: Transaction) => {
    const removed = await skipPending(tx.id);
    if (removed) {
      toast('Salteado este mes', { actionLabel: 'Deshacer', duration: 5000, onAction: () => void restoreTransaction(removed) });
    }
  };

  const confirmAll = async () => {
    setBusy('all');
    try {
      for (const tx of pending) await confirmPending(tx.id, today);
      toast(`${pending.length} movimientos confirmados`);
    } finally {
      setBusy(null);
    }
  };

  if (pending.length === 0) {
    return <p className="py-6 text-center text-[15px] text-muted">No hay nada pendiente.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-muted">
        No cuentan en los totales hasta que los confirmes. Si el monto cambió, tocá Editar.
      </p>
      <ul className="divide-y divide-line">
        {pending.map((tx) => {
          const cat = categories.get(tx.categoryId);
          const income = tx.kind === 'income';
          const other = otherCurrency(tx.currency);
          const upcoming = tx.date > today;
          return (
            <li key={tx.id} className="py-3">
              <div className="flex items-center gap-3">
                <CategoryAvatar name={cat?.name} color={cat?.color} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px]">{cat?.name ?? 'Movimiento'}</p>
                  <p className="text-[12px] text-muted">
                    {upcoming ? `Vence el ${formatDayMonth(tx.date)}` : `Del ${formatDayMonth(tx.date)}`}
                    {tx.note ? ` · ${tx.note}` : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={cx('tabular text-[15px]', income ? 'text-income' : 'text-expense')}>
                    {formatMoney(income ? tx.amount : -tx.amount, tx.currency, { signed: true })}
                  </p>
                  <p className="tabular text-[12px] text-muted">≈ {formatMoney(amountIn(tx, other), other)}</p>
                </div>
              </div>
              <div className="mt-2 flex gap-2 pl-12">
                <button
                  type="button"
                  onClick={() => void skip(tx)}
                  className="min-h-10 flex-1 rounded-full border border-line text-[13px] text-muted active:bg-raised"
                >
                  Saltear
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPanel(null);
                    openEntry({ editId: tx.id });
                  }}
                  className="min-h-10 flex-1 rounded-full border border-line text-[13px] active:bg-raised"
                >
                  Editar
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void confirm(tx)}
                  className="min-h-10 flex-1 rounded-full bg-fg text-[13px] font-medium text-bg active:opacity-80 disabled:opacity-50"
                >
                  Confirmar
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {pending.length > 1 && (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void confirmAll()}
          className="min-h-12 w-full rounded-full border border-line text-[15px] active:bg-raised disabled:opacity-50"
        >
          Confirmar los {pending.length}
        </button>
      )}
    </div>
  );
}
