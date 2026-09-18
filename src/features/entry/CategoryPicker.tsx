import { Plus, Search, X } from 'lucide-react';
import { useId, useMemo, useRef } from 'react';
import { MAX_CATEGORY_NAME_LENGTH } from '../../db/transactions';
import { suggestCategories } from '../../domain/categories';
import {
  DEFAULT_INCOME_CATEGORY,
  GROUP_LABEL_PLURAL,
  type Category,
  type Group,
  type IncomeGroup,
  type Kind,
} from '../../domain/types';
import { cx } from '../../lib/cx';
import { dismissKeyboard } from '../../lib/viewport';

/**
 * - full: etiqueta, buscador y sugerencias en varias filas (teclado cerrado).
 * - row: solo una fila de sugerencias deslizable (mientras se escribe el monto).
 * - focus: buscador + sugerencias ocupando el espacio libre (escribiendo la categoría).
 */
export type PickerLayout = 'full' | 'row' | 'focus';

interface CategoryPickerProps {
  categories: readonly Category[];
  kind: Kind;
  group: Group;
  query: string;
  selectedId?: string;
  layout: PickerLayout;
  onQueryChange: (q: string) => void;
  onSelect: (c: Category) => void;
  onFocus: () => void;
  onBlur: () => void;
}

const MAX_CHIPS = 40;

export function CategoryPicker({
  categories,
  kind,
  group,
  query,
  selectedId,
  layout,
  onQueryChange,
  onSelect,
  onFocus,
  onBlur,
}: CategoryPickerProps) {
  const inputId = useId();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const { items, exact, createName } = useMemo(
    () => suggestCategories(categories, { kind, group, query }),
    [categories, kind, group, query],
  );
  const selected = selectedId ? categories.find((c) => c.id === selectedId) : exact;
  const isIncome = kind === 'income';
  const row = layout === 'row';

  const chipClass = 'flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[14px]';

  return (
    <div>
      <label htmlFor={inputId} className={row ? 'sr-only' : 'mb-1.5 block text-[13px] text-muted'}>
        {isIncome ? 'Detalle (opcional)' : 'Categoría'}
      </label>
      {/* En modo "row" el buscador queda oculto pero enfocable: "Otra…" lo enfoca sin cerrar el teclado. */}
      <div
        className={cx(
          'flex min-h-12 items-center gap-2 rounded-xl border border-line bg-raised px-3 focus-within:border-muted',
          row && 'sr-only',
        )}
      >
        <Search size={16} strokeWidth={1.5} className="shrink-0 text-muted" aria-hidden="true" />
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          autoCapitalize="sentences"
          enterKeyHint="done"
          maxLength={MAX_CATEGORY_NAME_LENGTH}
          placeholder={isIncome ? 'Cliente, empresa…' : 'Buscar o crear…'}
          value={query}
          tabIndex={row ? -1 : undefined}
          onFocus={onFocus}
          onBlur={onBlur}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            if (!exact && items.length > 0 && !createName) onSelect(items[0]);
            e.currentTarget.blur();
          }}
          className="min-w-0 flex-1 bg-transparent py-2 outline-none placeholder:text-muted"
        />
        {query && !row && (
          <button
            type="button"
            aria-label="Borrar texto"
            onClick={() => {
              onQueryChange('');
              inputRef.current?.focus();
            }}
            className="-mr-2 grid size-10 place-items-center text-muted"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {exact && exact.group !== group && !row && (
        <p className="mt-1.5 text-[12px] text-warn">
          «{exact.name}» ya existe en {GROUP_LABEL_PLURAL[exact.group]}: se guarda ahí.
        </p>
      )}

      <div
        id={listId}
        role="listbox"
        aria-label="Sugerencias"
        className={cx(
          'flex gap-2',
          row
            ? 'no-scrollbar -mx-5 overflow-x-auto px-5'
            : layout === 'focus'
              ? 'scroll-area mt-2 max-h-[calc(var(--vv-height,100dvh)-220px)] flex-wrap pb-1'
              : 'scroll-area mt-2 max-h-[128px] flex-wrap pb-1',
        )}
      >
        {row && (
          <button
            type="button"
            onClick={() => inputRef.current?.focus()}
            className={cx(chipClass, 'border-line text-muted active:bg-raised')}
          >
            <Search size={14} strokeWidth={1.75} aria-hidden="true" />
            {isIncome ? 'Detalle…' : items.length > 0 ? 'Otra…' : 'Escribir categoría…'}
          </button>
        )}
        {createName && (
          <button
            type="button"
            role="option"
            aria-selected="true"
            onClick={dismissKeyboard}
            className={cx(chipClass, 'gap-1.5 border-dashed border-muted active:bg-raised')}
          >
            <Plus size={15} strokeWidth={1.75} aria-hidden="true" />
            Crear «{createName}»
          </button>
        )}
        {items.slice(0, MAX_CHIPS).map((c) => {
          const isSel = selected?.id === c.id;
          return (
            <button
              key={c.id}
              type="button"
              role="option"
              aria-selected={isSel}
              onClick={() => {
                onSelect(c);
                dismissKeyboard();
              }}
              className={cx(
                chipClass,
                'transition-colors duration-150',
                isSel ? 'border-fg bg-line' : 'border-line active:bg-raised',
              )}
            >
              <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: c.color }} />
              {c.name}
              {c.group !== group && (
                <span className="text-[11px] text-muted">· {GROUP_LABEL_PLURAL[c.group]}</span>
              )}
            </button>
          );
        })}
        {items.length === 0 && !createName && !row && (
          <p className="py-2 text-[13px] text-muted">
            {isIncome
              ? `Si lo dejás vacío se guarda como «${DEFAULT_INCOME_CATEGORY[group as IncomeGroup]}».`
              : 'Escribí un nombre para crear tu primera categoría.'}
          </p>
        )}
      </div>
    </div>
  );
}
