import { useLiveQuery } from 'dexie-react-hooks';
import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Segmented } from '../../components/ui/Segmented';
import { Sheet } from '../../components/ui/Sheet';
import { deleteCategory, mergeCategories, renameCategory, setCategoryArchived, updateCategory } from '../../db/categories';
import { db } from '../../db/db';
import { useCategories } from '../../db/hooks';
import { MAX_CATEGORY_NAME_LENGTH, ValidationError } from '../../db/transactions';
import { paletteFor } from '../../domain/categories';
import { GROUP_LABEL, GROUPS_BY_KIND, type Category, type Group } from '../../domain/types';
import { cx } from '../../lib/cx';
import { toast } from '../../store/toast';
import { useUI } from '../../store/ui';

export function CategoriesSheet() {
  const open = useUI((s) => s.panel === 'categories');
  const setPanel = useUI((s) => s.setPanel);
  return (
    <Sheet open={open} onClose={() => setPanel(null)} title="Categorías">
      <CategoryManager />
    </Sheet>
  );
}

interface Usage {
  tx: Map<string, number>;
  rec: Set<string>;
}

function useUsage(): Usage {
  return (
    useLiveQuery(async () => {
      const [txs, recs] = await Promise.all([db.transactions.toArray(), db.recurrings.toArray()]);
      const tx = new Map<string, number>();
      for (const t of txs) tx.set(t.categoryId, (tx.get(t.categoryId) ?? 0) + 1);
      return { tx, rec: new Set(recs.map((r) => r.templateTx.categoryId)) };
    }, []) ?? { tx: new Map(), rec: new Set() }
  );
}

function CategoryManager() {
  const categories = useCategories();
  const usage = useUsage();
  const [editing, setEditing] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const sections = useMemo(() => {
    const byName = (a: Category, b: Category) => a.name.localeCompare(b.name, 'es');
    const active = categories.filter((c) => !c.archived);
    return [
      { title: 'Gastos fijos', items: active.filter((c) => c.group === 'fixed').sort(byName) },
      { title: 'Gastos variables', items: active.filter((c) => c.group === 'variable').sort(byName) },
      { title: 'Ingresos', items: active.filter((c) => c.kind === 'income').sort(byName) },
    ];
  }, [categories]);
  const archived = categories.filter((c) => c.archived);

  if (categories.length === 0) {
    return <p className="py-6 text-center text-[15px] text-muted">Las categorías se crean solas al cargar movimientos.</p>;
  }

  const row = (c: Category) => (
    <li key={c.id}>
      {editing === c.id ? (
        <CategoryEditor
          category={c}
          count={usage.tx.get(c.id) ?? 0}
          inRecurring={usage.rec.has(c.id)}
          all={categories}
          onDone={() => setEditing(null)}
        />
      ) : (
        <button type="button" onClick={() => setEditing(c.id)} className="flex min-h-12 w-full items-center gap-3 text-left active:bg-raised">
          <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
          <span className="min-w-0 flex-1 truncate text-[15px]">
            {c.name}
            {c.kind === 'income' && <span className="ml-1.5 text-[12px] text-muted">{GROUP_LABEL[c.group]}</span>}
          </span>
          <span className="tabular text-[12px] text-muted">{usage.tx.get(c.id) ?? 0} mov.</span>
          <ChevronRight size={16} strokeWidth={1.5} className="text-muted" aria-hidden="true" />
        </button>
      )}
    </li>
  );

  return (
    <div className="space-y-5">
      <p className="text-[13px] text-muted">
        Los cambios se ven en todo el historial. Archivá las que ya no usás: dejan de aparecer como sugerencia pero sus
        movimientos quedan.
      </p>
      {sections.map(
        (s) =>
          s.items.length > 0 && (
            <section key={s.title}>
              <h3 className="mb-1 text-[13px] text-muted">{s.title}</h3>
              <ul className="divide-y divide-line">{s.items.map(row)}</ul>
            </section>
          ),
      )}
      {archived.length > 0 && (
        <section>
          <button
            type="button"
            aria-expanded={showArchived}
            onClick={() => setShowArchived((v) => !v)}
            className="flex min-h-11 items-center gap-1 text-[13px] text-muted"
          >
            <ChevronDown size={14} strokeWidth={1.75} className={cx('transition-transform', !showArchived && '-rotate-90')} aria-hidden="true" />
            Archivadas ({archived.length})
          </button>
          {showArchived && <ul className="divide-y divide-line opacity-80">{archived.map(row)}</ul>}
        </section>
      )}
    </div>
  );
}

interface EditorProps {
  category: Category;
  count: number;
  inRecurring: boolean;
  all: readonly Category[];
  onDone: () => void;
}

function CategoryEditor({ category, count, inRecurring, all, onDone }: EditorProps) {
  const [name, setName] = useState(category.name);
  const [color, setColor] = useState(category.color);
  const [group, setGroup] = useState<Group>(category.group);
  const [mergeTarget, setMergeTarget] = useState('');
  const [confirmMerge, setConfirmMerge] = useState(false);
  const palette = paletteFor(category.kind);
  const swatches = palette.includes(category.color.toUpperCase()) ? palette : [category.color, ...palette];
  const targets = all.filter((c) => c.kind === category.kind && c.id !== category.id).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const target = targets.find((t) => t.id === mergeTarget);
  const canDelete = count === 0 && !inRecurring;

  const run = async (fn: () => Promise<unknown>, done: string) => {
    try {
      await fn();
      toast(done);
      onDone();
    } catch (e) {
      toast(e instanceof ValidationError ? e.message : 'No se pudo guardar');
    }
  };

  const save = () =>
    run(async () => {
      if (name.trim() !== category.name) await renameCategory(category.id, name);
      if (color !== category.color || group !== category.group) await updateCategory(category.id, { color, group });
    }, 'Categoría actualizada');

  return (
    <div className="space-y-4 py-3">
      <label className="block text-[12px] text-muted">
        Nombre
        <input
          value={name}
          maxLength={MAX_CATEGORY_NAME_LENGTH}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 min-h-11 w-full rounded-xl border border-line bg-raised px-3 text-[16px] text-fg outline-none"
        />
      </label>

      <div>
        <p className="mb-1.5 text-[12px] text-muted">Color</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
          {swatches.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color.toUpperCase() === c.toUpperCase()}
              aria-label={c}
              onClick={() => setColor(c)}
              className="grid size-10 place-items-center rounded-full"
              style={{ backgroundColor: c }}
            >
              {color.toUpperCase() === c.toUpperCase() && <Check size={16} strokeWidth={2.5} className="text-bg" aria-hidden="true" />}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[12px] text-muted">{category.kind === 'expense' ? 'Tipo de gasto' : 'Tipo de ingreso'}</p>
        <Segmented
          ariaLabel="Grupo"
          size="sm"
          options={GROUPS_BY_KIND[category.kind].map((g) => ({ value: g, label: GROUP_LABEL[g] }))}
          value={group}
          onChange={setGroup}
        />
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={onDone} className="min-h-11 flex-1 rounded-full border border-line text-[14px]">
          Cancelar
        </button>
        <button
          type="button"
          disabled={!name.trim()}
          onClick={() => void save()}
          className="min-h-11 flex-1 rounded-full bg-fg text-[14px] font-medium text-bg active:opacity-80 disabled:opacity-30"
        >
          Guardar
        </button>
      </div>

      <div className="space-y-2 border-t border-line pt-3">
        {targets.length > 0 && (
          <div>
            <label className="block text-[12px] text-muted">
              Fusionar con otra categoría
              <select
                value={mergeTarget}
                onChange={(e) => {
                  setMergeTarget(e.target.value);
                  setConfirmMerge(false);
                }}
                className="mt-1 min-h-11 w-full rounded-xl border border-line bg-raised px-3 text-[16px] text-fg"
              >
                <option value="">Elegir…</option>
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.archived ? ' (archivada)' : ''}
                  </option>
                ))}
              </select>
            </label>
            {target &&
              (confirmMerge ? (
                <div className="mt-2 rounded-xl border border-warn/30 bg-warn/10 p-3 text-[13px]">
                  <p>
                    Los {count} movimientos de «{category.name}» pasan a «{target.name}» y «{category.name}» desaparece.
                  </p>
                  <button
                    type="button"
                    onClick={() => void run(() => mergeCategories(category.id, target.id), `Fusionada en «${target.name}»`)}
                    className="mt-2 min-h-11 w-full rounded-full bg-fg font-medium text-bg"
                  >
                    Fusionar
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmMerge(true)} className="mt-2 min-h-11 w-full rounded-full border border-line text-[14px]">
                  Fusionar en «{target.name}»
                </button>
              ))}
          </div>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              void run(
                () => setCategoryArchived(category.id, !category.archived),
                category.archived ? 'Categoría restaurada' : 'Categoría archivada',
              )
            }
            className="min-h-11 flex-1 rounded-full border border-line text-[14px]"
          >
            {category.archived ? 'Desarchivar' : 'Archivar'}
          </button>
          <button
            type="button"
            disabled={!canDelete}
            onClick={() => void run(() => deleteCategory(category.id), 'Categoría borrada')}
            className="min-h-11 flex-1 rounded-full border border-line text-[14px] text-alert disabled:opacity-30"
          >
            Borrar
          </button>
        </div>
        {!canDelete && (
          <p className="text-[12px] text-muted">
            No se puede borrar porque tiene {count > 0 ? `${count} movimientos` : 'un recurrente'}. Podés archivarla o fusionarla.
          </p>
        )}
      </div>
    </div>
  );
}
