import { cx } from '../../lib/cx';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  tone?: 'income' | 'expense';
}

/** Interruptor estilo iOS, con la fila entera tocable (≥ 44px). */
export function Switch({ checked, onChange, label, description, tone = 'expense' }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-12 w-full items-center justify-between gap-3 text-left"
    >
      <span className="min-w-0">
        <span className="block text-[15px]">{label}</span>
        {description && <span className="block text-[12px] text-muted">{description}</span>}
      </span>
      <span
        aria-hidden="true"
        className={cx(
          'relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors duration-200',
          checked ? (tone === 'income' ? 'bg-income' : 'bg-expense') : 'bg-line',
        )}
      >
        <span
          className={cx(
            'absolute top-[2px] left-[2px] size-[26px] rounded-full bg-fg shadow-[0_1px_3px_rgba(0,0,0,0.4)] transition-transform duration-200',
            checked && 'translate-x-5',
          )}
        />
      </span>
    </button>
  );
}
