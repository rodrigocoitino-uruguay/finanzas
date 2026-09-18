import { CloudOff, RefreshCw, Trash2, TriangleAlert } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { useMemo, useState } from 'react';
import { Sheet } from '../../components/ui/Sheet';
import { removeManualRate, setManualRate } from '../../db/rates';
import { findRecalculable, recalculateTransactions } from '../../db/transactions';
import { displayAmount, parseAmount, sanitizeAmountInput } from '../../domain/amount';
import { round2 } from '../../domain/money';
import { cx } from '../../lib/cx';
import { capitalize, formatDate, formatDayMonth, todayISO } from '../../lib/dates';
import { formatRate } from '../../lib/format';
import { toast } from '../../store/toast';
import { useUI } from '../../store/ui';
import { syncRates } from './sync';
import { useRateStatus } from './useRateStatus';

const HISTORY_ROWS = 45;

export function RateSheet() {
  const open = useUI((s) => s.rateSheetOpen);
  const setOpen = useUI((s) => s.setRateSheetOpen);
  return (
    <Sheet open={open} onClose={() => setOpen(false)} title="Cotización del dólar">
      <RateSheetBody />
    </Sheet>
  );
}

function RateSheetBody() {
  const { rates, latest, status, sync, online } = useRateStatus();
  const recalculable = useLiveQuery(findRecalculable, [rates], []);

  const history = useMemo(
    () =>
      [...rates]
        .sort((a, b) => (a.date === b.date ? (a.source === 'manual' ? -1 : 1) : a.date < b.date ? 1 : -1))
        .slice(0, HISTORY_ROWS),
    [rates],
  );
  const manual = useMemo(() => rates.filter((r) => r.source === 'manual').sort((a, b) => (a.date < b.date ? 1 : -1)), [rates]);

  const refresh = async () => {
    const r = await syncRates();
    toast(r.ok ? 'Cotización actualizada' : r.reason === 'offline' ? 'Sin conexión: se mantiene la última guardada' : 'No se pudo leer la cotización');
  };

  const recalc = async () => {
    const n = await recalculateTransactions(recalculable.map((t) => t.id));
    toast(n === 1 ? '1 movimiento recalculado' : `${n} movimientos recalculados`);
  };

  return (
    <div className="space-y-6">
      {/* Actual */}
      <section aria-label="Cotización actual">
        {latest ? (
          <>
            <p className="text-[13px] text-muted">Dólar billete · compra</p>
            <p className="mt-0.5 text-[44px] leading-none font-light tracking-tight">{formatRate(latest.buy)}</p>
            <p className="tabular mt-2 text-[13px] text-muted">
              {latest.source === 'manual' ? 'Cargada a mano' : `Venta ${formatRate(latest.sell)} · BROU`} ·{' '}
              {capitalize(formatDate(latest.date, "EEEE d 'de' MMMM"))}
            </p>
          </>
        ) : (
          <p className="text-[15px] text-muted">Todavía no hay ninguna cotización guardada.</p>
        )}

        {status.detail && (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-warn/30 bg-warn/10 px-3 py-2.5 text-[13px] text-warn">
            {status.state === 'offline' ? (
              <CloudOff size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden="true" />
            ) : (
              <TriangleAlert size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden="true" />
            )}
            {status.detail}
          </p>
        )}

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[12px] text-muted">
            {sync.lastSuccessAt
              ? `Última actualización: ${format(new Date(sync.lastSuccessAt), 'dd/MM HH:mm')}`
              : 'Todavía no se actualizó en este dispositivo'}
          </p>
          <button
            type="button"
            disabled={sync.syncing || !online}
            onClick={() => void refresh()}
            className="flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-line px-4 text-[14px] active:bg-raised disabled:opacity-40"
          >
            <RefreshCw size={15} strokeWidth={1.75} className={sync.syncing ? 'animate-spin' : undefined} aria-hidden="true" />
            {sync.syncing ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </section>

      {recalculable.length > 0 && (
        <section aria-label="Movimientos a recalcular" className="rounded-card border border-line bg-raised p-4">
          <p className="text-[14px]">
            {recalculable.length === 1 ? '1 movimiento usa' : `${recalculable.length} movimientos usan`} una cotización
            distinta a la del histórico actual.
          </p>
          <p className="mt-1 text-[12px] text-muted">
            Pasa si los cargaste sin conexión, con una cotización aproximada o antes de un cambio manual. Los que
            fijaste a mano no se tocan.
          </p>
          <button
            type="button"
            onClick={() => void recalc()}
            className="mt-3 min-h-11 w-full rounded-full bg-fg text-[15px] font-medium text-bg active:opacity-80"
          >
            Recalcular {recalculable.length === 1 ? 'el movimiento' : `los ${recalculable.length}`}
          </button>
        </section>
      )}

      <ManualRateForm defaultBuy={latest?.buy} />

      {manual.length > 0 && (
        <section aria-label="Cotizaciones manuales">
          <h3 className="mb-1 text-[13px] text-muted">Cargadas a mano</h3>
          <ul className="divide-y divide-line">
            {manual.map((r) => (
              <li key={r.date} className="flex min-h-11 items-center justify-between gap-3">
                <span className="tabular text-[14px]">
                  {capitalize(formatDate(r.date, 'EEE d/MM/yy').replace('.', ''))} · {formatRate(r.buy)}
                </span>
                <button
                  type="button"
                  aria-label={`Borrar la cotización manual del ${formatDayMonth(r.date)}`}
                  onClick={async () => {
                    await removeManualRate(r.date);
                    toast(`Se borró la cotización manual del ${formatDayMonth(r.date)}`);
                  }}
                  className="-mr-2 grid size-11 place-items-center text-muted active:text-alert"
                >
                  <Trash2 size={16} strokeWidth={1.5} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Histórico">
        <h3 className="mb-1 text-[13px] text-muted">Histórico</h3>
        {history.length === 0 ? (
          <p className="text-[13px] text-muted">Sin datos todavía.</p>
        ) : (
          <table className="tabular w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] text-muted">
                <th scope="col" className="py-1.5 font-normal">Fecha</th>
                <th scope="col" className="py-1.5 text-right font-normal">Compra</th>
                <th scope="col" className="py-1.5 text-right font-normal">Venta</th>
                <th scope="col" className="py-1.5 text-right font-normal">Fuente</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr key={`${r.date}-${r.source}`} className="border-t border-line">
                  <td className="py-1.5 text-muted">{capitalize(formatDate(r.date, 'EEE d/MM').replace('.', ''))}</td>
                  <td className="py-1.5 text-right">{formatRate(r.buy)}</td>
                  <td className="py-1.5 text-right text-muted">{r.source === 'manual' ? '—' : formatRate(r.sell)}</td>
                  <td className={cx('py-1.5 text-right', r.source === 'manual' ? 'text-warn' : 'text-muted')}>
                    {r.source === 'manual' ? 'Manual' : 'BROU'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-3 text-[12px] leading-relaxed text-muted">
          Se usa el dólar billete del BROU, valor compra (lo que te pagan al vender dólares). Los fines de semana y
          feriados vale la del último día hábil. Cada movimiento guarda la cotización de su fecha, así los meses
          pasados no cambian cuando se mueve el dólar.
        </p>
      </section>
    </div>
  );
}

function ManualRateForm({ defaultBuy }: { defaultBuy?: number }) {
  const today = todayISO();
  const [date, setDate] = useState(today);
  const [value, setValue] = useState('');
  const buy = parseAmount(value);
  const valid = buy !== null && buy >= 10 && buy <= 500 && Boolean(date) && date <= today;

  const save = async () => {
    if (!valid || buy === null) return;
    await setManualRate(date, round2(buy));
    toast(`Cotización del ${formatDayMonth(date)} guardada: ${formatRate(buy)}`);
    setValue('');
  };

  return (
    <section aria-labelledby="manual-rate-title">
      <h3 id="manual-rate-title" className="text-[13px] text-muted">
        Cargar a mano para un día
      </h3>
      <p className="mt-1 text-[12px] text-muted">
        Tiene prioridad sobre la del BROU ese día. Sirve si no hay conexión o si querés usar otro valor.
      </p>
      <div className="mt-2 grid grid-cols-[1fr_1fr_auto] items-end gap-2">
        <label className="flex flex-col gap-1 text-[12px] text-muted">
          Fecha
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-line bg-raised px-3 text-fg"
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-muted">
          Compra
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder={defaultBuy ? formatRate(defaultBuy) : '39,05'}
            value={displayAmount(value)}
            onChange={(e) => setValue(sanitizeAmountInput(e.target.value, displayAmount(value)))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save();
            }}
            className="tabular min-h-11 w-full rounded-xl border border-line bg-raised px-3 text-fg outline-none"
          />
        </label>
        <button
          type="button"
          disabled={!valid}
          onClick={() => void save()}
          className="min-h-11 rounded-full bg-fg px-4 text-[14px] font-medium text-bg transition-opacity active:opacity-80 disabled:opacity-30"
        >
          Guardar
        </button>
      </div>
    </section>
  );
}
