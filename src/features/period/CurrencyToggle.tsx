import { Segmented } from '../../components/ui/Segmented';
import type { Currency } from '../../domain/types';
import { useDisplayCurrency } from '../../store/settings';
import { useUI } from '../../store/ui';

const OPTIONS = [
  { value: 'UYU', label: 'UYU' },
  { value: 'USD', label: 'USD' },
] as const satisfies readonly { value: Currency; label: string }[];

export function CurrencyToggle() {
  const currency = useDisplayCurrency();
  const setCurrency = useUI((s) => s.setDisplayCurrency);
  return (
    <Segmented
      ariaLabel="Moneda de visualización"
      size="sm"
      options={OPTIONS}
      value={currency}
      onChange={setCurrency}
      className="shrink-0"
    />
  );
}
