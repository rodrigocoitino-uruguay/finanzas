import type { Currency } from './types';

/**
 * Redondea a 2 decimales, "mitad lejos de cero", sin los errores típicos de
 * punto flotante (1.005 → 1.01, no 1.00).
 */
export function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const sign = n < 0 ? -1 : 1;
  const abs = Math.abs(n);
  const str = abs.toString();
  let result: number;
  if (str.includes('e')) {
    // Números muy chicos o muy grandes: la notación exponencial no se puede desplazar por texto.
    result = Math.round(abs * 100) / 100;
  } else {
    result = Number(`${Math.round(Number(`${str}e2`))}e-2`);
  }
  const signed = sign * result;
  return signed === 0 ? 0 : signed; // evita -0
}

/** Pasa a centésimos enteros (para sumar sin acumular error). */
export function toCents(n: number): number {
  return Math.round(round2(n) * 100);
}

export function fromCents(cents: number): number {
  return round2(cents / 100);
}

export function sumMoney(values: Iterable<number>): number {
  let cents = 0;
  for (const v of values) cents += toCents(v);
  return fromCents(cents);
}

export function subMoney(a: number, b: number): number {
  return fromCents(toCents(a) - toCents(b));
}

export interface Converted {
  amountUYU: number;
  amountUSD: number;
}

/**
 * Convierte un monto a ambas monedas usando `rate` = UYU por 1 USD.
 */
export function convert(amount: number, currency: Currency, rate: number): Converted {
  if (!(rate > 0)) throw new RangeError('La cotización debe ser mayor que cero');
  const a = round2(amount);
  if (currency === 'UYU') return { amountUYU: a, amountUSD: round2(a / rate) };
  return { amountUYU: round2(a * rate), amountUSD: a };
}

export function otherCurrency(c: Currency): Currency {
  return c === 'UYU' ? 'USD' : 'UYU';
}

/** Variación relativa (0.12 = +12 %). null si no hay base de comparación. */
export function variation(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}

/** Proporción parte/total en [0, ∞). 0 si el total es 0. */
export function ratio(part: number, total: number): number {
  if (total === 0) return 0;
  return part / total;
}
