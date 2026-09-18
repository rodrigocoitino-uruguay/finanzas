import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { IconButton } from '../../components/ui/IconButton';
import { Sheet } from '../../components/ui/Sheet';
import {
  PERIOD_MODE_LABEL,
  periodLabel,
  periodRange,
  shiftPeriod,
  type Period,
  type PeriodMode,
} from '../../domain/periods';
import { cx } from '../../lib/cx';
import { addDaysISO, todayISO } from '../../lib/dates';
import { useUI } from '../../store/ui';

export function PeriodSelector() {
  const period = useUI((s) => s.period);
  const shift = useUI((s) => s.shiftPeriod);
  const [open, setOpen] = useState(false);
  const [sheetKey, setSheetKey] = useState(0);
  const today = todayISO();
  const nextDisabled = periodRange(shiftPeriod(period, 1)).from > today;

  return (
    <div className="-ml-3 flex min-w-0 items-center">
      <IconButton label="Período anterior" onClick={() => shift(-1)}>
        <ChevronLeft size={20} strokeWidth={1.5} />
      </IconButton>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={`Período: ${periodLabel(period)}. Cambiar período`}
        onClick={() => {
          setSheetKey((k) => k + 1);
          setOpen(true);
        }}
        className="min-h-11 min-w-0 truncate rounded-full px-1 text-[15px] font-medium active:text-muted"
      >
        {periodLabel(period)}
      </button>
      <IconButton label="Período siguiente" onClick={() => shift(1)} disabled={nextDisabled}>
        <ChevronRight size={20} strokeWidth={1.5} />
      </IconButton>
      <PeriodSheet key={sheetKey} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

const QUICK_MODES: PeriodMode[] = ['month', 'last3', 'year'];
const QUICK_LABEL: Record<PeriodMode, string> = {
  month: 'Este mes',
  last3: PERIOD_MODE_LABEL.last3,
  year: 'Este año',
  custom: PERIOD_MODE_LABEL.custom,
};

function PeriodSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const period = useUI((s) => s.period);
  const setPeriod = useUI((s) => s.setPeriod);
  const today = todayISO();
  const current = periodRange(period);
  const [from, setFrom] = useState(current.from);
  const [to, setTo] = useState(current.to > today ? today : current.to);

  const choose = (p: Period) => {
    setPeriod(p);
    onClose();
  };

  const customValid = Boolean(from && to && from <= to);

  return (
    <Sheet open={open} onClose={onClose} title="Período">
      <ul className="-mx-2 mb-4">
        {QUICK_MODES.map((mode) => {
          const selected = period.mode === mode;
          return (
            <li key={mode}>
              <button
                type="button"
                onClick={() => choose({ mode, anchor: today })}
                className="flex min-h-12 w-full items-center justify-between rounded-xl px-3 text-left text-[16px] active:bg-raised"
              >
                <span>{QUICK_LABEL[mode]}</span>
                {selected && <Check size={18} strokeWidth={1.75} className="text-expense" aria-label="elegido" />}
              </button>
            </li>
          );
        })}
      </ul>

      <fieldset className="rounded-card border border-line p-4">
        <legend className="px-1 text-[13px] text-muted">{QUICK_LABEL.custom}</legend>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-[13px] text-muted">
            Desde
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-line bg-raised px-3 text-fg"
            />
          </label>
          <label className="flex flex-col gap-1 text-[13px] text-muted">
            Hasta
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-line bg-raised px-3 text-fg"
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[7, 30, 90].map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => {
                setFrom(addDaysISO(today, -(days - 1)));
                setTo(today);
              }}
              className="min-h-9 rounded-full border border-line px-3 text-[13px] text-muted active:bg-raised"
            >
              Últimos {days} días
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={!customValid}
          onClick={() => choose({ mode: 'custom', anchor: to, from, to })}
          className={cx(
            'mt-4 min-h-12 w-full rounded-full bg-fg font-medium text-bg transition-opacity',
            !customValid && 'opacity-40',
          )}
        >
          Aplicar
        </button>
      </fieldset>
    </Sheet>
  );
}
