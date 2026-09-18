import { cx } from '../../lib/cx';

interface SubTabsProps<T extends string> {
  tabs: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}

/** Pestañas secundarias dentro de una pestaña (texto con subrayado). */
export function SubTabs<T extends string>({ tabs, value, onChange, label }: SubTabsProps<T>) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-5 border-b border-line">
      {tabs.map((t) => {
        const selected = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(t.value)}
            className={cx(
              '-mb-px min-h-10 border-b-2 text-[14px] transition-colors duration-200',
              selected ? 'border-fg text-fg' : 'border-transparent text-muted',
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
