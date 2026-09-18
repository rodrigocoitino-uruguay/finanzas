import { Delete } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { cx } from '../../lib/cx';

interface PinPadProps {
  value: string;
  onChange: (value: string) => void;
  /** Cantidad de puntos a mostrar (el PIN tiene de 4 a 6 números). */
  dots: number;
  maxLength?: number;
  disabled?: boolean;
  error?: boolean;
  /** Tecla de abajo a la izquierda (por ejemplo, Face ID). */
  extraKey?: ReactNode;
  label: string;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** Teclado numérico propio: no abre el teclado del sistema ni sugiere autocompletar. */
export function PinPad({ value, onChange, dots, maxLength = 6, disabled, error, extraKey, label }: PinPadProps) {
  const press = (d: string) => {
    if (disabled || value.length >= maxLength) return;
    onChange(value + d);
  };
  const back = () => !disabled && onChange(value.slice(0, -1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const keyClass =
    'grid size-[72px] place-items-center rounded-full text-[28px] font-light transition-colors duration-100 active:bg-line disabled:opacity-30';

  return (
    <div className="flex flex-col items-center">
      <div
        role="status"
        aria-label={`${label}: ${value.length} de ${dots} números`}
        className={cx('flex h-6 items-center gap-4', error && 'animate-[shake_300ms_ease-in-out]')}
      >
        {Array.from({ length: dots }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={cx(
              'size-3 rounded-full border transition-colors duration-150',
              i < value.length ? 'border-fg bg-fg' : 'border-muted',
            )}
          />
        ))}
      </div>
      <div className="mt-8 grid grid-cols-3 gap-x-6 gap-y-4">
        {KEYS.map((k) => (
          <button key={k} type="button" disabled={disabled} onClick={() => press(k)} className={cx(keyClass, 'bg-raised')}>
            {k}
          </button>
        ))}
        <div className="grid size-[72px] place-items-center">{extraKey}</div>
        <button type="button" disabled={disabled} onClick={() => press('0')} className={cx(keyClass, 'bg-raised')}>
          0
        </button>
        <button type="button" disabled={disabled || value.length === 0} onClick={back} aria-label="Borrar" className={keyClass}>
          <Delete size={24} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
