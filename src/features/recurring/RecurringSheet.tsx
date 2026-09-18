import { ChevronRight, Pause } from 'lucide-react';
import { useState } from 'react';
import { CategoryAvatar } from '../../components/ui/CategoryAvatar';
import { Segmented } from '../../components/ui/Segmented';
import { Sheet } from '../../components/ui/Sheet';
import { useCategoryMap, useRecurrings } from '../../db/hooks';
import { deleteRecurring, setRecurringActive, updateRecurring } from '../../db/recurring';
import { MAX_NOTE_LENGTH, ValidationError } from '../../db/transactions';
import { normalizeName } from '../../domain/categories';
import { amountToCanonical, displayAmount, parseAmount, sanitizeAmountInput } from '../../domain/amount';
import { GROUP_LABEL, type Category, type Currency, type Recurring } from '../../domain/types';
import { cx } from '../../lib/cx';
import { todayISO } from '../../lib/dates';
import { formatMoney } from '../../lib/format';
import { toast } from '../../store/toast';
import { useUI } from '../../store/ui';

export function RecurringSheet() {
  const open = useUI((s) => s.panel === 'recurring');
  const setPanel = useUI((s) => s.setPanel);
  return (
    <Sheet open={open} onClose={() => setPanel(null)} title="Recurrentes">
      <RecurringList />
    </Sheet>
  );
}

function RecurringList() {
  const recurrings = useRecurrings();
  const categories = useCategoryMap();
  const [editing, setEditing] = useState<string | null>(null);

  if (recurrings.length === 0) {
    return (
      <p className="py-6 text-center text-[15px] text-muted">
        Todavía no hay recurrentes. Al cargar un gasto fijo o un ingreso, activá "Repetir todos los meses".
      </p>
    );
  }

  const sorted = [...recurrings].sort(
    (a, b) => Number(b.active) - Number(a.active) || a.dayOfMonth - b.dayOfMonth,
  );

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted">
        Cada mes se generan como pendientes para confirmar. Los cambios aplican a los pendientes que todavía no
        confirmaste.
      </p>
      <ul className="divide-y divide-line">
        {sorted.map((r) => {
          const cat = categories.get(r.templateTx.categoryId);
          return (
            <li key={r.id}>
              {editing === r.id ? (
                <RecurringForm rec={r} category={cat} onDone={() => setEditing(null)} />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditing(r.id)}
                  className={cx('flex min-h-14 w-full items-center gap-3 py-2 text-left active:bg-raised', !r.active && 'opacity-60')}
                >
                  <CategoryAvatar name={cat?.name} color={cat?.color} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px]">{cat?.name ?? 'Categoría borrada'}</span>
                    <span className="flex items-center gap-1 text-[12px] text-muted">
                      {!r.active && <Pause size={11} strokeWidth={2} aria-hidden="true" />}
                      {r.active ? `Día ${r.dayOfMonth} de cada mes` : 'En pausa'}
                      {cat && normalizeName(GROUP_LABEL[cat.group]) !== cat.normalizedName ? ` · ${GROUP_LABEL[cat.group]}` : ''}
                    </span>
                  </span>
                  <span className={cx('tabular text-[14px]', r.templateTx.kind === 'income' ? 'text-income' : 'text-expense')}>
                    {formatMoney(r.templateTx.amount, r.templateTx.currency)}
                  </span>
                  <ChevronRight size={16} strokeWidth={1.5} className="text-muted" aria-hidden="true" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RecurringForm({ rec, category, onDone }: { rec: Recurring; category?: Category; onDone: () => void }) {
  const [amount, setAmount] = useState(amountToCanonical(rec.templateTx.amount));
  const [currency, setCurrency] = useState<Currency>(rec.templateTx.currency);
  const [day, setDay] = useState(rec.dayOfMonth);
  const [note, setNote] = useState(rec.templateTx.note ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const shown = displayAmount(amount);
  const value = parseAmount(amount);
  const today = todayISO();

  const save = async () => {
    try {
      await updateRecurring(rec.id, { amount: value ?? 0, currency, dayOfMonth: day, note });
      toast('Recurrente actualizado');
      onDone();
    } catch (e) {
      toast(e instanceof ValidationError ? e.message : 'No se pudo guardar');
    }
  };

  return (
    <div className="space-y-3 py-3">
      <div className="flex items-center gap-3">
        <CategoryAvatar name={category?.name} color={category?.color} size={32} />
        <span className="min-w-0 flex-1 truncate text-[15px]">{category?.name ?? 'Categoría borrada'}</span>
        <Segmented
          ariaLabel="Moneda"
          size="sm"
          options={[
            { value: 'UYU', label: 'UYU' },
            { value: 'USD', label: 'USD' },
          ]}
          value={currency}
          onChange={setCurrency}
        />
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <label className="text-[12px] text-muted">
          Monto
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={shown}
            onChange={(e) => setAmount(sanitizeAmountInput(e.target.value, shown))}
            className="tabular mt-1 min-h-11 w-full rounded-xl border border-line bg-raised px-3 text-[16px] text-fg outline-none"
          />
        </label>
        <label className="text-[12px] text-muted">
          Día
          <select
            value={day}
            onChange={(e) => setDay(Number(e.target.value))}
            className="tabular mt-1 block min-h-11 rounded-xl border border-line bg-raised px-3 text-[16px] text-fg"
          >
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-[12px] text-muted">
        Nota
        <input
          type="text"
          maxLength={MAX_NOTE_LENGTH}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 min-h-11 w-full rounded-xl border border-line bg-raised px-3 text-[16px] text-fg outline-none"
        />
      </label>

      {confirmDelete ? (
        <div className="rounded-xl border border-alert/40 bg-alert/10 p-3">
          <p className="text-[13px]">
            Se borra el recurrente y sus pendientes sin confirmar. Lo ya confirmado queda en tus movimientos.
          </p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => setConfirmDelete(false)} className="min-h-11 flex-1 rounded-full border border-line text-[14px]">
              Cancelar
            </button>
            <button
              type="button"
              onClick={async () => {
                await deleteRecurring(rec.id);
                toast('Recurrente borrado');
                onDone();
              }}
              className="min-h-11 flex-1 rounded-full bg-alert text-[14px] font-medium text-bg"
            >
              Borrar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="min-h-11 rounded-full border border-line px-4 text-[14px] text-alert active:bg-raised"
          >
            Borrar
          </button>
          <button
            type="button"
            onClick={async () => {
              await setRecurringActive(rec.id, !rec.active, today);
              toast(rec.active ? 'En pausa: no se generan más pendientes' : 'Reanudado');
              onDone();
            }}
            className="min-h-11 flex-1 rounded-full border border-line text-[14px] active:bg-raised"
          >
            {rec.active ? 'Pausar' : 'Reanudar'}
          </button>
          <button
            type="button"
            disabled={!(value && value > 0)}
            onClick={() => void save()}
            className="min-h-11 flex-1 rounded-full bg-fg text-[14px] font-medium text-bg active:opacity-80 disabled:opacity-30"
          >
            Guardar
          </button>
        </div>
      )}
    </div>
  );
}
