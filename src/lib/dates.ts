import { addDays, addMonths, format, isValid, parse } from 'date-fns';
import { es } from 'date-fns/locale';

const ISO = 'yyyy-MM-dd';

export function toISODate(d: Date): string {
  return format(d, ISO);
}

/** Fecha local de hoy en yyyy-mm-dd (en el iPhone: hora de Montevideo). */
export function todayISO(now: Date = new Date()): string {
  return toISODate(now);
}

/** yyyy-mm-dd → Date a medianoche local. */
export function parseISODate(iso: string): Date {
  const d = parse(iso, ISO, new Date(2000, 0, 1));
  if (!isValid(d)) throw new RangeError(`Fecha inválida: ${iso}`);
  return d;
}

export function isISODate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return isValid(parse(s, ISO, new Date(2000, 0, 1)));
}

export function addDaysISO(iso: string, days: number): string {
  return toISODate(addDays(parseISODate(iso), days));
}

export function addMonthsISO(iso: string, months: number): string {
  return toISODate(addMonths(parseISODate(iso), months));
}

/** yyyy-mm-dd → yyyy-mm */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase('es') + s.slice(1);
}

export function formatDate(iso: string, pattern: string): string {
  return format(parseISODate(iso), pattern, { locale: es });
}

/** "16/09" */
export function formatDayMonth(iso: string): string {
  return formatDate(iso, 'dd/MM');
}

/** "Hoy", "Ayer" o "Lunes 14 de septiembre" (con año si no es el actual). */
export function formatDayHeading(iso: string, today: string = todayISO()): string {
  if (iso === today) return 'Hoy';
  if (iso === addDaysISO(today, -1)) return 'Ayer';
  const sameYear = iso.slice(0, 4) === today.slice(0, 4);
  return capitalize(formatDate(iso, sameYear ? "EEEE d 'de' MMMM" : "EEEE d 'de' MMMM yyyy"));
}

/** "Septiembre 2026" */
export function formatMonthYear(iso: string): string {
  return capitalize(formatDate(iso, 'MMMM yyyy'));
}

/** "sep" */
export function formatMonthShort(iso: string): string {
  return formatDate(iso, 'MMM').replace('.', '');
}
