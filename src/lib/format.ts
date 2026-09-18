import { round2 } from '../domain/money';
import type { Currency } from '../domain/types';

const MINUS = '−';
const NBSP = ' ';

export const CURRENCY_SYMBOL: Record<Currency, string> = { UYU: '$', USD: 'US$' };

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export type DecimalsMode = 'auto' | 'always' | 'never';

/** 1250.5 → "1.250,50" ("always"), 28000 → "28.000" ("auto"). */
export function formatNumber(value: number, decimals: DecimalsMode = 'auto', digits = 2): string {
  const v = decimals === 'never' ? Math.round(value) : round2(value);
  const abs = Math.abs(v);
  const hasCents = !Number.isInteger(abs);
  const showDec = decimals === 'always' || (decimals === 'auto' && hasCents);
  const [int, dec] = abs.toFixed(showDec ? digits : 0).split('.');
  const body = dec ? `${groupThousands(int)},${dec}` : groupThousands(int);
  return v < 0 ? `${MINUS}${body}` : body;
}

export interface MoneyFormatOptions {
  /** Por defecto: pesos sin decimales salvo que los tenga; dólares siempre con 2. */
  decimals?: DecimalsMode;
  /** Muestra "+" en positivos. */
  signed?: boolean;
}

/** 28000 UYU → "$ 28.000"; 1250.5 USD → "US$ 1.250,50"; -300 → "−$ 300". */
export function formatMoney(value: number, currency: Currency, opts: MoneyFormatOptions = {}): string {
  const decimals = opts.decimals ?? (currency === 'USD' ? 'always' : 'auto');
  const rounded = decimals === 'never' ? Math.round(value) : round2(value);
  const body = formatNumber(Math.abs(rounded), decimals);
  const sign = rounded < 0 ? MINUS : opts.signed && rounded > 0 ? '+' : '';
  return `${sign}${CURRENCY_SYMBOL[currency]}${NBSP}${body}`;
}

/** Totales y gráficos: pesos redondeados, dólares con centavos. */
export function formatAmount(value: number, currency: Currency, opts: Omit<MoneyFormatOptions, 'decimals'> = {}): string {
  return formatMoney(value, currency, { ...opts, decimals: currency === 'UYU' ? 'never' : 'always' });
}

/** 40.1 → "40,10" */
export function formatRate(rate: number): string {
  return formatNumber(rate, 'always');
}

/** 0.123 → "+12 %" (signed) o "12 %" */
export function formatPercent(value: number, opts: { signed?: boolean; digits?: number } = {}): string {
  const pct = value * 100;
  const digits = opts.digits ?? (Math.abs(pct) < 10 ? 1 : 0);
  const [int, rawDec] = Math.abs(pct).toFixed(digits).split('.') as [string, string | undefined];
  const dec = rawDec !== undefined && /^0+$/.test(rawDec) && opts.digits === undefined ? undefined : rawDec;
  const body = dec ? `${groupThousands(int)},${dec}` : groupThousands(int);
  const isZero = /^[0.]+$/.test(`${int}.${dec ?? ''}`);
  const sign = isZero ? '' : pct < 0 ? MINUS : opts.signed ? '+' : '';
  return `${sign}${body}${NBSP}%`;
}

/** Etiquetas de ejes: 40000 → "40 k", 1250000 → "1,3 M", 950 → "950". */
export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? MINUS : '';
  if (abs >= 1_000_000) return `${sign}${formatNumber(abs / 1_000_000, 'auto', 1).replace(/,0$/, '')}${NBSP}M`;
  if (abs >= 10_000) return `${sign}${formatNumber(Math.round(abs / 1000), 'never')}${NBSP}k`;
  if (abs >= 1_000) return `${sign}${formatNumber(Math.round(abs / 100) / 10, 'auto', 1).replace(/,0$/, '')}${NBSP}k`;
  return `${sign}${formatNumber(Math.round(abs), 'never')}`;
}
