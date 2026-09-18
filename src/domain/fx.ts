import { convert } from './money';
import type { Rate, RateSource, Transaction } from './types';

export interface RateLookup {
  /** UYU por USD, valor compra. */
  rate: number;
  /** Fecha de la cotización usada. */
  date: string;
  source: RateSource;
  /** La cotización no corresponde a esa fecha ni al último día hábil anterior. */
  approximate: boolean;
}

/** Más de esto sin cotización ya no es "fin de semana o feriado". */
const MAX_BUSINESS_GAP_DAYS = 5;

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

function isValid(r: Rate): boolean {
  return Number.isFinite(r.buy) && r.buy > 0 && /^\d{4}-\d{2}-\d{2}$/.test(r.date);
}

/**
 * Cotización a usar para una fecha:
 * 1. la más reciente con fecha ≤ `date` (si hay manual y BROU el mismo día, gana la manual);
 *    así los fines de semana y feriados usan el último día hábil;
 * 2. si la fecha es anterior a todo el histórico, la más antigua (marcada como aproximada).
 */
export function pickRate(rates: readonly Rate[], date: string): RateLookup | null {
  let best: Rate | undefined;
  let earliest: Rate | undefined;
  for (const r of rates) {
    if (!isValid(r)) continue;
    if (!earliest || r.date < earliest.date || (r.date === earliest.date && r.source === 'manual')) {
      earliest = r;
    }
    if (r.date > date) continue;
    if (!best || r.date > best.date || (r.date === best.date && r.source === 'manual')) {
      best = r;
    }
  }
  if (best) {
    return {
      rate: best.buy,
      date: best.date,
      source: best.source,
      approximate: daysBetween(best.date, date) > MAX_BUSINESS_GAP_DAYS,
    };
  }
  if (earliest) {
    return { rate: earliest.buy, date: earliest.date, source: earliest.source, approximate: true };
  }
  return null;
}

/** Última cotización disponible (para el chip del encabezado). */
export function latestRate(rates: readonly Rate[]): Rate | null {
  let best: Rate | null = null;
  for (const r of rates) {
    if (!isValid(r)) continue;
    if (!best || r.date > best.date || (r.date === best.date && r.source === 'manual')) best = r;
  }
  return best;
}

/**
 * Movimiento recalculado con la cotización que corresponde hoy a su fecha, o null
 * si no hace falta (ya coincide, fue fijada a mano o no hay cotizaciones).
 */
export function recalcTransaction(tx: Transaction, rates: readonly Rate[], nowISO: string): Transaction | null {
  if (tx.rateCustom) return null;
  const found = pickRate(rates, tx.date);
  if (!found) return null;
  if (found.rate === tx.rateAtDate && found.approximate === Boolean(tx.rateApprox)) return null;
  const next: Transaction = {
    ...tx,
    rateAtDate: found.rate,
    ...convert(tx.amount, tx.currency, found.rate),
    updatedAt: nowISO,
  };
  if (found.approximate) next.rateApprox = true;
  else delete next.rateApprox;
  return next;
}

export type RateFreshness = 'fresh' | 'stale' | 'none';

/** Más de 4 días sin cotización nueva ya no es un fin de semana largo: está desactualizada. */
export const STALE_AFTER_DAYS = 4;

export function rateFreshness(latest: Pick<Rate, 'date'> | null, today: string): RateFreshness {
  if (!latest) return 'none';
  return daysBetween(latest.date, today) > STALE_AFTER_DAYS ? 'stale' : 'fresh';
}
