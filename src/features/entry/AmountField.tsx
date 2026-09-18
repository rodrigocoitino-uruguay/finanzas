import { ArrowLeftRight } from 'lucide-react';
import { useId, type ReactNode, type Ref } from 'react';
import { displayAmount, sanitizeAmountInput } from '../../domain/amount';
import type { Currency } from '../../domain/types';
import { CURRENCY_SYMBOL } from '../../lib/format';

interface AmountFieldProps {
  value: string;
  onChange: (canonical: string) => void;
  currency: Currency;
  onToggleCurrency: () => void;
  tone: 'income' | 'expense';
  hint?: ReactNode;
  ref?: Ref<HTMLInputElement>;
  onFocus?: () => void;
  onBlur?: () => void;
}

export function AmountField({
  value,
  onChange,
  currency,
  onToggleCurrency,
  tone,
  hint,
  ref,
  onFocus,
  onBlur,
}: AmountFieldProps) {
  const id = useId();
  const shown = displayAmount(value);
  const size = shown.length <= 9 ? 'text-[44px]' : shown.length <= 12 ? 'text-[34px]' : 'text-[26px]';
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        Monto en {currency === 'UYU' ? 'pesos' : 'dólares'}
      </label>
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={tone === 'income' ? 'text-[22px] font-light text-income' : 'text-[22px] font-light text-expense'}
        >
          {CURRENCY_SYMBOL[currency]}
        </span>
        <input
          ref={ref}
          id={id}
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="0"
          value={shown}
          onFocus={onFocus}
          onBlur={onBlur}
          onChange={(e) => onChange(sanitizeAmountInput(e.target.value, shown))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          className={`tabular h-14 min-w-0 flex-1 bg-transparent font-light leading-tight tracking-tight outline-none transition-[font-size] duration-150 placeholder:text-line ${size}`}
        />
        <button
          type="button"
          onClick={onToggleCurrency}
          aria-label={`Moneda: ${currency}. Cambiar a ${currency === 'UYU' ? 'USD' : 'UYU'}`}
          className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-line bg-raised px-3 text-[14px] font-medium active:bg-line"
        >
          {currency}
          <ArrowLeftRight size={14} strokeWidth={1.5} className="text-muted" aria-hidden="true" />
        </button>
      </div>
      <div className="tabular min-h-5 text-[13px] text-muted" aria-live="polite">
        {hint}
      </div>
    </div>
  );
}
