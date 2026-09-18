import { Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Segmented } from '../../components/ui/Segmented';
import { Sheet, useSheetHeaderSlot } from '../../components/ui/Sheet';
import { useCategories, useRates, useTransaction } from '../../db/hooks';
import {
  deleteTransaction,
  MAX_NOTE_LENGTH,
  NoRateError,
  restoreTransaction,
  saveTransaction,
  ValidationError,
} from '../../db/transactions';
import { amountToCanonical, canonicalToNumber, displayAmount, parseAmount, sanitizeAmountInput } from '../../domain/amount';
import { pickRate } from '../../domain/fx';
import { convert, otherCurrency } from '../../domain/money';
import {
  GROUP_LABEL,
  GROUPS_BY_KIND,
  type Category,
  type Currency,
  type ExpenseGroup,
  type Group,
  type Kind,
  type Transaction,
} from '../../domain/types';
import { cx } from '../../lib/cx';
import { addDaysISO, formatDayMonth, todayISO } from '../../lib/dates';
import { formatMoney, formatRate } from '../../lib/format';
import { dismissKeyboard, IS_TOUCH, primeKeyboard } from '../../lib/viewport';
import { defaultCurrencyFor, useSettings } from '../../store/settings';
import { toast } from '../../store/toast';
import { useUI, type EntryState } from '../../store/ui';
import { AmountField } from './AmountField';
import { CategoryPicker, type PickerLayout } from './CategoryPicker';

type OpenEntry = Extract<EntryState, { open: true }>;

/** Bottom sheet global de carga/edición. Se abre desde el "+" o tocando un movimiento. */
export function EntrySheet() {
  const entry = useUI((s) => s.entry);
  const close = useUI((s) => s.closeEntry);
  const [shown, setShown] = useState<OpenEntry | null>(null);
  if (entry.open && shown?.key !== entry.key) setShown(entry);

  const editing = Boolean(shown?.editId);
  return (
    <Sheet
      open={entry.open}
      onClose={close}
      title={editing ? 'Editar movimiento' : 'Nuevo movimiento'}
      bare
      headerSlot
      onExited={() => setShown(null)}
    >
      {shown && (
        <EntryLoader key={shown.key} editId={shown.editId} presetKind={shown.presetKind} onDone={close} />
      )}
    </Sheet>
  );
}

function EntryLoader({ editId, presetKind, onDone }: { editId?: string; presetKind?: Kind; onDone: () => void }) {
  const tx = useTransaction(editId);
  const categories = useCategories();
  if (editId) {
    const category = tx ? categories.find((c) => c.id === tx.categoryId) : undefined;
    if (!tx || !category) return <div className="h-64" aria-busy="true" />;
    return <EntryForm original={tx} originalCategory={category} onDone={onDone} />;
  }
  return <EntryForm presetKind={presetKind} onDone={onDone} />;
}

interface FormState {
  kind: Kind;
  group: Group;
  amount: string;
  currency: Currency;
  currencyTouched: boolean;
  query: string;
  categoryId?: string;
  date: string;
  note: string;
  manualRate: string;
}

type FocusField = 'amount' | 'category' | 'note';
type FormMode = FocusField | 'full';

const PICKER_LAYOUT: Record<FormMode, PickerLayout | null> = {
  full: 'full',
  amount: 'row',
  category: 'focus',
  note: null,
};

interface RateEdit {
  /** keep: la guardada · custom: fijada a mano · reset: la del histórico */
  mode: 'keep' | 'custom' | 'reset';
  value: string;
  open: boolean;
}

interface RateInfo {
  rate: number;
  date: string;
  approximate: boolean;
  /** history: BROU o manual del día · saved: la que quedó al cargarlo (ya no coincide) · custom: fijada a mano */
  origin: 'history' | 'saved' | 'custom';
  source?: 'BROU' | 'manual';
}

interface EntryFormProps {
  original?: Transaction;
  originalCategory?: Category;
  presetKind?: Kind;
  onDone: () => void;
}

function EntryForm({ original, originalCategory, presetKind, onDone }: EntryFormProps) {
  const settings = useSettings();
  const categories = useCategories();
  const rates = useRates();
  const lastExpenseGroup = useUI((s) => s.lastExpenseGroup);
  const setLastExpenseGroup = useUI((s) => s.setLastExpenseGroup);
  const amountRef = useRef<HTMLInputElement>(null);
  const headerSlot = useSheetHeaderSlot();
  const today = todayISO();

  const [form, setForm] = useState<FormState>(() => {
    if (original && originalCategory) {
      return {
        kind: original.kind,
        group: originalCategory.group,
        amount: amountToCanonical(original.amount),
        currency: original.currency,
        currencyTouched: true,
        query: originalCategory.name,
        categoryId: originalCategory.id,
        date: original.date,
        note: original.note ?? '',
        manualRate: '',
      };
    }
    const kind = presetKind ?? 'expense';
    return {
      kind,
      group: kind === 'expense' ? lastExpenseGroup : 'salary',
      amount: '',
      currency: defaultCurrencyFor(kind, settings),
      currencyTouched: false,
      query: '',
      date: today,
      note: '',
      manualRate: '',
    };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Con el teclado en pantalla el espacio es chico: se muestra solo lo del campo activo.
  const [focused, setFocused] = useState<FocusField | null>(null);
  const blurTimer = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const focusHandlers = (field: FocusField) => ({
    onFocus: () => {
      window.clearTimeout(blurTimer.current);
      setFocused(field);
    },
    onBlur: () => {
      window.clearTimeout(blurTimer.current);
      blurTimer.current = window.setTimeout(() => setFocused(null), 80);
    },
  });
  useEffect(() => () => window.clearTimeout(blurTimer.current), []);
  const mode: FormMode = IS_TOUCH && focused ? focused : 'full';
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [mode]);

  const isEdit = Boolean(original);
  const update = (patch: Partial<FormState>) => {
    setError(null);
    setForm((f) => ({ ...f, ...patch }));
  };

  // Al abrir para cargar, el foco va al monto (el teclado ya se abrió en el toque del "+").
  useEffect(() => {
    if (!isEdit) amountRef.current?.focus({ preventScroll: true });
  }, [isEdit]);

  const amount = canonicalToNumber(form.amount);

  // Cotización del movimiento: la guardada, la del histórico o una fijada a mano.
  const [rateEdit, setRateEdit] = useState<RateEdit>({ mode: 'keep', value: '', open: false });
  const autoRate = useMemo(() => pickRate(rates, form.date), [rates, form.date]);
  const customRate = parseAmount(rateEdit.value);
  const customValid = customRate !== null && customRate >= 10 && customRate <= 500;

  const rateInfo = useMemo<RateInfo | null>(() => {
    if (rateEdit.mode === 'custom') {
      return customValid ? { rate: customRate!, date: form.date, approximate: false, origin: 'custom' } : null;
    }
    if (original && original.date === form.date && rateEdit.mode === 'keep') {
      const matches = autoRate && autoRate.rate === original.rateAtDate;
      return {
        rate: original.rateAtDate,
        date: matches ? autoRate.date : original.date,
        approximate: original.rateApprox ?? false,
        origin: original.rateCustom ? 'custom' : matches ? 'history' : 'saved',
        source: matches ? autoRate.source : undefined,
      };
    }
    return autoRate
      ? { rate: autoRate.rate, date: autoRate.date, approximate: autoRate.approximate, origin: 'history', source: autoRate.source }
      : null;
  }, [rateEdit.mode, customValid, customRate, original, form.date, autoRate]);

  const manualRate = parseAmount(form.manualRate);
  const needsManualRate = !rateInfo && rateEdit.mode !== 'custom';
  const effectiveRate = rateInfo?.rate ?? (needsManualRate && manualRate && manualRate > 0 ? manualRate : null);

  const conversionHint = (() => {
    if (!effectiveRate) return null;
    const cot = `cot. ${formatRate(effectiveRate)}`;
    const approx = rateInfo?.approximate ? ` (aprox., del ${formatDayMonth(rateInfo.date)})` : '';
    if (!amount) return `${cot}${approx}`;
    const conv = convert(amount, form.currency, effectiveRate);
    const other = otherCurrency(form.currency);
    const value = other === 'USD' ? conv.amountUSD : conv.amountUYU;
    return `≈ ${formatMoney(value, other)} · ${cot}${approx}`;
  })();

  const setKind = (kind: Kind) => {
    if (kind === form.kind) return;
    update({
      kind,
      group: kind === 'expense' ? lastExpenseGroup : 'salary',
      currency: form.currencyTouched ? form.currency : defaultCurrencyFor(kind, settings),
      query: '',
      categoryId: undefined,
    });
  };

  const setGroup = (group: Group) => {
    const selected = form.categoryId ? categories.find((c) => c.id === form.categoryId) : undefined;
    if (selected && selected.group !== group) {
      update({ group, categoryId: undefined, query: '' });
    } else {
      update({ group });
    }
  };

  const selectCategory = (c: Category) => update({ categoryId: c.id, query: c.name, group: c.group });

  async function save(addAnother: boolean) {
    if (saving) return;
    if (addAnother) primeKeyboard();
    if (!amount || amount <= 0) {
      setError('Ingresá un monto');
      amountRef.current?.focus();
      return;
    }
    if (form.kind === 'expense' && !form.categoryId && !form.query.trim()) {
      setError('Elegí o escribí una categoría');
      return;
    }
    if (rateEdit.mode === 'custom' && !customValid) {
      setError('Revisá la cotización (entre 10 y 500)');
      return;
    }
    if (!effectiveRate) {
      setError('Ingresá la cotización del dólar');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await saveTransaction({
        id: original?.id,
        kind: form.kind,
        group: form.group,
        amount,
        currency: form.currency,
        date: form.date,
        note: form.note,
        categoryId: form.categoryId,
        categoryName: form.categoryId ? undefined : form.query,
        rateOverride: rateEdit.mode === 'custom' ? customRate! : needsManualRate ? effectiveRate : undefined,
        resetRate: rateEdit.mode === 'reset',
      });
      if (form.kind === 'expense') setLastExpenseGroup(res.category.group as ExpenseGroup);
      const label = isEdit ? 'Cambios guardados' : form.kind === 'expense' ? 'Gasto guardado' : 'Ingreso guardado';
      toast(res.createdCategory ? `${label} · nueva categoría «${res.category.name}»` : label);
      if (addAnother) {
        setForm((f) => ({ ...f, amount: '', query: '', categoryId: undefined, note: '' }));
        amountRef.current?.focus({ preventScroll: true });
      } else {
        onDone();
      }
    } catch (e) {
      setError(
        e instanceof ValidationError || e instanceof NoRateError ? e.message : 'No se pudo guardar. Probá de nuevo.',
      );
      if (!(e instanceof ValidationError || e instanceof NoRateError)) console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!original) return;
    const removed = await deleteTransaction(original.id);
    onDone();
    if (removed) {
      toast('Movimiento borrado', {
        actionLabel: 'Deshacer',
        duration: 5000,
        onAction: () => void restoreTransaction(removed),
      });
    }
  }

  const tone = form.kind === 'income' ? 'income' : 'expense';
  const groups = GROUPS_BY_KIND[form.kind];
  const groupLabel = (g: Group) => (form.kind === 'expense' ? `Gasto ${GROUP_LABEL[g].toLowerCase()}` : GROUP_LABEL[g]);
  const compact = mode !== 'full';
  const pickerLayout = PICKER_LAYOUT[mode];
  const show = {
    amount: mode === 'full' || mode === 'amount',
    summary: mode === 'category' || mode === 'note',
    groups: mode === 'full' || mode === 'amount',
    date: mode === 'full',
    note: mode === 'full' || mode === 'note',
    footer: mode === 'full',
  };

  return (
    <>
      {headerSlot &&
        createPortal(
          <Segmented
            ariaLabel="Tipo de movimiento"
            options={[
              { value: 'expense', label: 'Gasto', tone: 'expense' },
              { value: 'income', label: 'Ingreso', tone: 'income' },
            ]}
            value={form.kind}
            onChange={setKind}
          />,
          headerSlot,
        )}

      <div
        ref={scrollRef}
        className={cx(
          'scroll-area min-h-0 flex-1 px-5 pt-2',
          compact ? 'space-y-3 pb-3' : 'space-y-5 pb-4',
        )}
      >
        {show.summary && (
          <p className="tabular flex min-h-8 items-center gap-2 text-[15px] text-muted">
            <span className={amount ? 'text-fg' : undefined}>
              {amount ? formatMoney(amount, form.currency) : 'Sin monto'}
            </span>
            <span aria-hidden="true">·</span>
            <span>{groupLabel(form.group)}</span>
          </p>
        )}

        <div className={show.amount ? undefined : 'hidden'}>
          <AmountField
            ref={amountRef}
            value={form.amount}
            onChange={(v) => update({ amount: v })}
            currency={form.currency}
            onToggleCurrency={() => update({ currency: otherCurrency(form.currency), currencyTouched: true })}
            tone={tone}
            hint={conversionHint}
            {...focusHandlers('amount')}
          />
        </div>

        {needsManualRate && show.amount && (
          <div className="rounded-xl border border-warn/40 bg-warn/10 p-3">
            <label className="block text-[13px] text-warn" htmlFor="manual-rate">
              No hay cotización guardada. Escribí la del dólar (compra):
            </label>
            <input
              id="manual-rate"
              type="text"
              inputMode="decimal"
              placeholder="Ej.: 39,05"
              value={form.manualRate}
              {...focusHandlers('amount')}
              onChange={(e) => update({ manualRate: sanitizeAmountInput(e.target.value, displayAmount(form.manualRate)) })}
              className="tabular mt-2 min-h-11 w-full rounded-lg border border-line bg-raised px-3 outline-none"
            />
          </div>
        )}

        {show.groups && (
          <div
            role="radiogroup"
            aria-label={form.kind === 'expense' ? 'Tipo de gasto' : 'Tipo de ingreso'}
            className={cx('grid gap-2', groups.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}
          >
            {groups.map((g) => {
              const selected = form.group === g;
              return (
                <button
                  key={g}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    setGroup(g);
                    dismissKeyboard();
                  }}
                  className={cx(
                    'rounded-card border text-[15px] transition-colors duration-200',
                    compact ? 'min-h-11' : 'min-h-12',
                    selected
                      ? tone === 'income'
                        ? 'border-income/60 bg-income/10 text-income'
                        : 'border-expense/60 bg-expense/10 text-expense'
                      : 'border-line text-muted active:bg-raised',
                  )}
                >
                  {groupLabel(g)}
                </button>
              );
            })}
          </div>
        )}

        {pickerLayout && (
          <CategoryPicker
            categories={categories}
            kind={form.kind}
            group={form.group}
            query={form.query}
            selectedId={form.categoryId}
            layout={pickerLayout}
            onQueryChange={(q) => update({ query: q, categoryId: undefined })}
            onSelect={selectCategory}
            {...focusHandlers('category')}
          />
        )}

        {show.date && (
          <div>
            <span id="date-label" className="mb-1.5 block text-[13px] text-muted">
              Fecha
            </span>
            <div className="flex items-center gap-2" role="group" aria-labelledby="date-label">
              {[
                { label: 'Hoy', value: today },
                { label: 'Ayer', value: addDaysISO(today, -1) },
              ].map((d) => (
                <button
                  key={d.label}
                  type="button"
                  aria-pressed={form.date === d.value}
                  onClick={() => update({ date: d.value })}
                  className={cx(
                    'min-h-11 rounded-full border px-4 text-[14px] transition-colors duration-150',
                    form.date === d.value ? 'border-fg bg-line' : 'border-line text-muted active:bg-raised',
                  )}
                >
                  {d.label}
                </button>
              ))}
              <input
                type="date"
                aria-label="Elegir fecha"
                value={form.date}
                max={addDaysISO(today, 366)}
                onChange={(e) => e.target.value && update({ date: e.target.value })}
                className="min-h-11 min-w-0 flex-1 rounded-full border border-line bg-raised px-4 text-fg"
              />
            </div>
          </div>
        )}

        <div className={show.note ? undefined : 'hidden'}>
          <label htmlFor="entry-note" className="mb-1.5 block text-[13px] text-muted">
            Nota (opcional)
          </label>
          <input
            id="entry-note"
            type="text"
            enterKeyHint="done"
            autoComplete="off"
            maxLength={MAX_NOTE_LENGTH}
            value={form.note}
            {...focusHandlers('note')}
            onChange={(e) => update({ note: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            className="min-h-12 w-full rounded-xl border border-line bg-raised px-3 outline-none focus:border-muted"
          />
        </div>

        {mode === 'full' && isEdit && (rateInfo || rateEdit.mode === 'custom') && (
          <RateRow
            info={rateInfo ?? { rate: 0, date: form.date, approximate: false, origin: 'custom' }}
            edit={rateEdit}
            auto={autoRate}
            onChange={(patch) => {
              setError(null);
              setRateEdit((r) => ({ ...r, ...patch }));
            }}
          />
        )}
      </div>

      {show.footer && (
        <div className="shrink-0 border-t border-line bg-surface px-5 pt-3 pb-[max(12px,var(--safe-bottom))]">
          {error && (
            <p role="alert" className="mb-2 text-[13px] text-alert">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            {isEdit ? (
              <button
                type="button"
                onClick={() => void remove()}
                className="flex min-h-12 items-center gap-2 rounded-full border border-line px-4 text-[15px] text-alert active:bg-raised"
              >
                <Trash2 size={17} strokeWidth={1.5} aria-hidden="true" />
                Borrar
              </button>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={() => void save(true)}
                className="min-h-12 flex-[1.35] rounded-full border border-line px-3 text-[14px] leading-tight active:bg-raised"
              >
                Guardar y agregar otro
              </button>
            )}
            <button
              type="button"
              disabled={saving}
              onClick={() => void save(false)}
              className={cx(
                'min-h-12 flex-1 rounded-full px-4 text-[15px] font-medium text-bg transition-opacity active:opacity-80',
                tone === 'income' ? 'bg-income' : 'bg-expense',
                saving && 'opacity-60',
              )}
            >
              {isEdit ? 'Guardar cambios' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

interface RateRowProps {
  info: RateInfo;
  edit: RateEdit;
  auto: ReturnType<typeof pickRate>;
  onChange: (patch: Partial<RateEdit>) => void;
}

/** Al editar: qué cotización usa el movimiento y cómo cambiarla. */
function RateRow({ info, edit, auto, onChange }: RateRowProps) {
  const detail =
    info.origin === 'custom'
      ? 'fijada a mano para este movimiento'
      : info.origin === 'saved'
        ? `la que se usó al cargarlo${info.approximate ? ' (aproximada)' : ''}`
        : `${info.approximate ? 'aproximada, ' : ''}${info.source === 'manual' ? 'manual' : 'BROU'} del ${formatDayMonth(info.date)}`;
  const shown = displayAmount(edit.value);

  return (
    <div className="rounded-xl border border-line px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] text-muted">Cotización usada</p>
          <p className="tabular truncate text-[15px]">
            {info.rate > 0 ? formatRate(info.rate) : '—'} <span className="text-[12px] text-muted">· {detail}</span>
          </p>
        </div>
        <button
          type="button"
          aria-expanded={edit.open}
          onClick={() => onChange({ open: !edit.open, value: edit.value || amountToCanonical(info.rate) })}
          className="min-h-11 shrink-0 px-2 text-[14px] text-expense"
        >
          {edit.open ? 'Listo' : 'Cambiar'}
        </button>
      </div>
      {edit.open && (
        <div className="mt-2 space-y-2 pb-1">
          <label className="block text-[12px] text-muted">
            Otra cotización para este movimiento
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={shown}
              onChange={(e) => onChange({ mode: 'custom', value: sanitizeAmountInput(e.target.value, shown) })}
              className="tabular mt-1 min-h-11 w-full rounded-lg border border-line bg-raised px-3 text-[16px] text-fg outline-none"
            />
          </label>
          {auto && (auto.rate !== info.rate || info.origin !== 'history') && (
            <button
              type="button"
              onClick={() => onChange({ mode: 'reset', value: amountToCanonical(auto.rate), open: false })}
              className="min-h-11 w-full rounded-full border border-line text-[14px] active:bg-raised"
            >
              Usar la del histórico ({formatRate(auto.rate)} del {formatDayMonth(auto.date)})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
