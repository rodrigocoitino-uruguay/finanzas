import { ReceiptText, SearchX } from 'lucide-react';
import { useMemo } from 'react';
import { Money } from '../../components/ui/Money';
import { SwipeRow } from '../../components/ui/SwipeRow';
import { useCategories, useTransactionsInRange } from '../../db/hooks';
import { deleteTransaction, restoreTransaction } from '../../db/transactions';
import { sumMoney } from '../../domain/money';
import { periodRange } from '../../domain/periods';
import { filterTransactions, groupByDay, signedAmountIn } from '../../domain/transactions';
import { formatDayHeading } from '../../lib/dates';
import { formatMoney } from '../../lib/format';
import { useDisplayCurrency } from '../../store/settings';
import { toast } from '../../store/toast';
import { useUI } from '../../store/ui';
import { activeFilterCount, FilterBar } from './FilterBar';
import { TransactionRow } from './TransactionRow';

export function TransactionsTab() {
  const period = useUI((s) => s.period);
  const filters = useUI((s) => s.filters);
  const setFilters = useUI((s) => s.setFilters);
  const openEntry = useUI((s) => s.openEntry);
  const currency = useDisplayCurrency();
  const range = useMemo(() => periodRange(period), [period]);
  const txs = useTransactionsInRange(range);
  const categoryList = useCategories();
  const categories = useMemo(() => new Map(categoryList.map((c) => [c.id, c])), [categoryList]);

  const filtered = useMemo(
    () => (txs ? filterTransactions(txs, filters, categories) : []),
    [txs, filters, categories],
  );
  const days = useMemo(() => groupByDay(filtered), [filtered]);
  const narrowed = activeFilterCount(filters) > 0 || Boolean(filters.query);
  const confirmed = filtered.filter((t) => t.status === 'confirmed');
  const net = sumMoney(confirmed.map((t) => signedAmountIn(t, currency)));

  const onDelete = async (id: string) => {
    const removed = await deleteTransaction(id);
    if (!removed) return;
    toast('Movimiento borrado', {
      actionLabel: 'Deshacer',
      duration: 5000,
      onAction: () => void restoreTransaction(removed),
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0">
        <FilterBar filters={filters} categories={categoryList} onChange={setFilters} />
        {narrowed && txs && filtered.length > 0 && (
          <p className="tabular px-5 pt-1 text-[12px] text-muted">
            {filtered.length === 1 ? '1 movimiento' : `${filtered.length} movimientos`} · neto{' '}
            <span className="text-fg">{formatMoney(net, currency, { signed: true })}</span>
          </p>
        )}
      </div>

      {txs && days.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-10 pb-24 text-center">
          {narrowed ? (
            <>
              <SearchX size={32} strokeWidth={1.2} className="text-muted" aria-hidden="true" />
              <p className="text-[15px] text-muted">Ningún movimiento coincide con los filtros en este período.</p>
              <button
                type="button"
                onClick={() => setFilters({})}
                className="min-h-11 rounded-full border border-line px-4 text-[14px] active:bg-raised"
              >
                Quitar filtros
              </button>
            </>
          ) : (
            <>
              <ReceiptText size={32} strokeWidth={1.2} className="text-muted" aria-hidden="true" />
              <p className="text-[15px] text-muted">
                No hay movimientos en este período.
                <br />
                Tocá <span className="text-fg">+</span> para cargar el primero.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="scroll-area min-h-0 flex-1 pb-28">
          {days.map((day) => {
            const dayNet = currency === 'UYU' ? day.netUYU : day.netUSD;
            const heading = formatDayHeading(day.date);
            return (
              <section key={day.date} aria-label={`${heading}, neto ${formatMoney(dayNet, currency)}`}>
                <div className="sticky top-0 z-10 flex items-baseline justify-between bg-bg/90 px-5 pt-4 pb-1.5 backdrop-blur-md">
                  <h2 className="text-[13px] font-medium text-muted">{heading}</h2>
                  <Money className="text-[13px] text-muted" value={dayNet} currency={currency} signed />
                </div>
                <ul>
                  {day.items.map((tx) => {
                    const cat = categories.get(tx.categoryId);
                    return (
                      <li key={tx.id}>
                        <SwipeRow
                          label={`${cat?.name ?? 'Movimiento'}, ${tx.kind === 'income' ? 'ingreso' : 'gasto'} de ${formatMoney(tx.amount, tx.currency)}`}
                          onTap={() => openEntry({ editId: tx.id })}
                          onDelete={() => void onDelete(tx.id)}
                        >
                          <TransactionRow tx={tx} category={cat} />
                        </SwipeRow>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
