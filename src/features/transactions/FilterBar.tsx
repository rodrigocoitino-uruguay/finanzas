import { ListFilter, Search, X } from 'lucide-react';
import { useState } from 'react';
import type { TxFilters } from '../../domain/transactions';
import { GROUP_LABEL_PLURAL, type Category } from '../../domain/types';
import { cx } from '../../lib/cx';
import { FilterSheet } from './FilterSheet';

interface FilterBarProps {
  filters: TxFilters;
  categories: readonly Category[];
  onChange: (f: TxFilters) => void;
}

interface ActiveChip {
  key: string;
  label: string;
  clear: () => TxFilters;
}

export function activeFilterCount(f: TxFilters): number {
  return [f.kind, f.group, f.currency, f.categoryIds?.length ? 1 : undefined].filter(Boolean).length;
}

export function FilterBar({ filters, categories, onChange }: FilterBarProps) {
  const [open, setOpen] = useState(false);
  const [sheetKey, setSheetKey] = useState(0);
  const count = activeFilterCount(filters);

  const chips: ActiveChip[] = [];
  if (filters.kind) {
    chips.push({ key: 'kind', label: filters.kind === 'expense' ? 'Gastos' : 'Ingresos', clear: () => ({ ...filters, kind: undefined }) });
  }
  if (filters.group) {
    chips.push({ key: 'group', label: GROUP_LABEL_PLURAL[filters.group], clear: () => ({ ...filters, group: undefined }) });
  }
  if (filters.categoryIds?.length) {
    const names = filters.categoryIds.map((id) => categories.find((c) => c.id === id)?.name).filter(Boolean);
    chips.push({
      key: 'cats',
      label: names.length <= 2 ? names.join(', ') : `${names.length} categorías`,
      clear: () => ({ ...filters, categoryIds: undefined }),
    });
  }
  if (filters.currency) {
    chips.push({ key: 'cur', label: `En ${filters.currency}`, clear: () => ({ ...filters, currency: undefined }) });
  }

  return (
    <div className="space-y-2 px-5 pt-1 pb-1">
      <div className="flex items-center gap-2">
        <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-full border border-line bg-surface px-3.5 focus-within:border-muted">
          <Search size={16} strokeWidth={1.5} className="shrink-0 text-muted" aria-hidden="true" />
          <span className="sr-only">Buscar por categoría, nota o monto</span>
          <input
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            placeholder="Buscar"
            value={filters.query ?? ''}
            onChange={(e) => onChange({ ...filters, query: e.target.value || undefined })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            className="min-w-0 flex-1 bg-transparent py-2 outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
          />
          {filters.query && (
            <button
              type="button"
              aria-label="Borrar búsqueda"
              onClick={() => onChange({ ...filters, query: undefined })}
              className="-mr-2 grid size-9 place-items-center text-muted"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          )}
        </label>
        <button
          type="button"
          onClick={() => {
            setSheetKey((k) => k + 1);
            setOpen(true);
          }}
          aria-label={count ? `Filtros, ${count} activos` : 'Filtros'}
          className={cx(
            'relative grid size-11 shrink-0 place-items-center rounded-full border transition-colors duration-150',
            count ? 'border-fg bg-line text-fg' : 'border-line text-muted active:bg-raised',
          )}
        >
          <ListFilter size={18} strokeWidth={1.5} aria-hidden="true" />
          {count > 0 && (
            <span aria-hidden="true" className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-fg text-[11px] font-semibold text-bg">
              {count}
            </span>
          )}
        </button>
      </div>

      {chips.length > 0 && (
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => onChange(c.clear())}
              aria-label={`Quitar filtro ${c.label}`}
              className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface pr-2.5 pl-3 text-[13px] active:bg-raised"
            >
              <span className="max-w-48 truncate">{c.label}</span>
              <X size={14} strokeWidth={1.75} className="text-muted" aria-hidden="true" />
            </button>
          ))}
          <button
            type="button"
            onClick={() => onChange({ query: filters.query })}
            className="min-h-9 shrink-0 rounded-full px-2 text-[13px] text-muted active:text-fg"
          >
            Limpiar
          </button>
        </div>
      )}

      <FilterSheet
        key={sheetKey}
        open={open}
        onClose={() => setOpen(false)}
        filters={filters}
        categories={categories}
        onApply={onChange}
      />
    </div>
  );
}
