import { Check } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Segmented } from '../../components/ui/Segmented';
import { Sheet } from '../../components/ui/Sheet';
import type { TxFilters } from '../../domain/transactions';
import { GROUP_LABEL_PLURAL, GROUPS_BY_KIND, type Category, type Currency, type Group, type Kind } from '../../domain/types';
import { cx } from '../../lib/cx';

interface FilterSheetProps {
  open: boolean;
  onClose: () => void;
  filters: TxFilters;
  categories: readonly Category[];
  onApply: (f: TxFilters) => void;
}

type KindOpt = Kind | 'all';
type CurOpt = Currency | 'all';

export function FilterSheet({ open, onClose, filters, categories, onApply }: FilterSheetProps) {
  const [draft, setDraft] = useState<TxFilters>(filters);
  const kind: KindOpt = draft.kind ?? 'all';
  const groups: Group[] = kind === 'all' ? [...GROUPS_BY_KIND.expense, ...GROUPS_BY_KIND.income] : [...GROUPS_BY_KIND[kind]];
  const selected = new Set(draft.categoryIds ?? []);

  const visibleCats = useMemo(
    () =>
      categories
        .filter((c) => (kind === 'all' || c.kind === kind) && (!draft.group || c.group === draft.group))
        .filter((c) => !c.archived || selected.has(c.id))
        .sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name, 'es')),
    [categories, kind, draft.group, draft.categoryIds],
  );

  const setKind = (k: KindOpt) =>
    setDraft((d) => {
      const nextKind = k === 'all' ? undefined : k;
      const keepGroup = d.group && (!nextKind || GROUPS_BY_KIND[nextKind].includes(d.group)) ? d.group : undefined;
      const keepCats = (d.categoryIds ?? []).filter((id) => {
        const c = categories.find((x) => x.id === id);
        return c && (!nextKind || c.kind === nextKind);
      });
      return { ...d, kind: nextKind, group: keepGroup, categoryIds: keepCats.length ? keepCats : undefined };
    });

  const toggleGroup = (g: Group) =>
    setDraft((d) => {
      const group = d.group === g ? undefined : g;
      const keepCats = (d.categoryIds ?? []).filter((id) => !group || categories.find((x) => x.id === id)?.group === group);
      return { ...d, group, categoryIds: keepCats.length ? keepCats : undefined };
    });

  const toggleCat = (id: string) =>
    setDraft((d) => {
      const set = new Set(d.categoryIds ?? []);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...d, categoryIds: set.size ? [...set] : undefined };
    });

  const chip = (active: boolean) =>
    cx(
      'flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-[14px] transition-colors duration-150',
      active ? 'border-fg bg-line' : 'border-line text-muted active:bg-raised',
    );

  return (
    <Sheet open={open} onClose={onClose} title="Filtros" bare>
      <div className="scroll-area min-h-0 flex-1 space-y-5 px-5 pt-2 pb-4">
        <fieldset>
          <legend className="mb-1.5 text-[13px] text-muted">Tipo</legend>
          <Segmented
            ariaLabel="Tipo"
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'expense', label: 'Gastos', tone: 'expense' },
              { value: 'income', label: 'Ingresos', tone: 'income' },
            ]}
            value={kind}
            onChange={setKind}
          />
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 text-[13px] text-muted">Grupo</legend>
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <button key={g} type="button" aria-pressed={draft.group === g} onClick={() => toggleGroup(g)} className={chip(draft.group === g)}>
                {GROUP_LABEL_PLURAL[g]}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 text-[13px] text-muted">Moneda original</legend>
          <Segmented
            ariaLabel="Moneda original"
            options={[
              { value: 'all', label: 'Todas' },
              { value: 'UYU', label: 'UYU' },
              { value: 'USD', label: 'USD' },
            ]}
            value={(draft.currency ?? 'all') as CurOpt}
            onChange={(c) => setDraft((d) => ({ ...d, currency: c === 'all' ? undefined : c }))}
          />
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 text-[13px] text-muted">
            Categorías {selected.size > 0 && <span className="text-fg">· {selected.size}</span>}
          </legend>
          {visibleCats.length === 0 ? (
            <p className="text-[13px] text-muted">No hay categorías para este filtro.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {visibleCats.map((c) => {
                const on = selected.has(c.id);
                return (
                  <button key={c.id} type="button" aria-pressed={on} onClick={() => toggleCat(c.id)} className={chip(on)}>
                    <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: c.color }} />
                    {c.name}
                    {on && <Check size={14} strokeWidth={2} aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          )}
        </fieldset>
      </div>
      <div className="flex shrink-0 gap-2 border-t border-line px-5 pt-3 pb-[max(12px,var(--safe-bottom))]">
        <button
          type="button"
          onClick={() => setDraft({ query: filters.query })}
          className="min-h-12 flex-1 rounded-full border border-line text-[15px] active:bg-raised"
        >
          Limpiar
        </button>
        <button
          type="button"
          onClick={() => {
            onApply(draft);
            onClose();
          }}
          className="min-h-12 flex-1 rounded-full bg-fg text-[15px] font-medium text-bg active:opacity-80"
        >
          Aplicar
        </button>
      </div>
    </Sheet>
  );
}
