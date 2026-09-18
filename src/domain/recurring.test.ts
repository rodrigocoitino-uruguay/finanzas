import { describe, expect, it } from 'vitest';
import { buildPending, confirmDate, monthsToGenerate, occurrenceDate } from './recurring';
import type { Rate, Recurring } from './types';

const rates: Rate[] = [{ date: '2026-09-01', buy: 40, sell: 42, source: 'BROU', fetchedAt: '' }];
const rec: Recurring = {
  id: 'r1',
  templateTx: { kind: 'expense', amount: 28000, currency: 'UYU', categoryId: 'alq', note: 'Alquiler' },
  dayOfMonth: 31,
  active: true,
  lastGeneratedMonth: '2026-08',
};

describe('occurrenceDate', () => {
  it('ajusta al último día del mes', () => {
    expect(occurrenceDate('2026-09', 5)).toBe('2026-09-05');
    expect(occurrenceDate('2026-09', 31)).toBe('2026-09-30');
    expect(occurrenceDate('2026-02', 30)).toBe('2026-02-28');
    expect(occurrenceDate('2028-02', 30)).toBe('2028-02-29');
    expect(occurrenceDate('2026-09', 0)).toBe('2026-09-01');
  });
});

describe('monthsToGenerate', () => {
  it('el mes nuevo, una sola vez', () => {
    expect(monthsToGenerate('2026-08', '2026-09')).toEqual(['2026-09']);
    expect(monthsToGenerate('2026-09', '2026-09')).toEqual([]);
    expect(monthsToGenerate(undefined, '2026-09')).toEqual(['2026-09']);
  });
  it('se pone al día si no se abrió la app (con tope de 6 meses), cruzando el año', () => {
    expect(monthsToGenerate('2025-11', '2026-02')).toEqual(['2025-12', '2026-01', '2026-02']);
    expect(monthsToGenerate('2025-01', '2026-02')).toHaveLength(6);
    expect(monthsToGenerate('2025-01', '2026-02').at(-1)).toBe('2026-02');
  });
});

describe('buildPending', () => {
  it('crea el movimiento pendiente con la cotización disponible', () => {
    const tx = buildPending(rec, '2026-09', rates, 'now', () => 'id1');
    expect(tx).toMatchObject({
      id: 'id1',
      status: 'pending',
      recurringId: 'r1',
      date: '2026-09-30',
      amount: 28000,
      amountUYU: 28000,
      amountUSD: 700,
      note: 'Alquiler',
    });
  });
  it('sin cotización no genera', () => {
    expect(buildPending(rec, '2026-09', [], 'now', () => 'x')).toBeNull();
  });
});

describe('confirmDate', () => {
  it('antes del día previsto usa hoy; después, el día previsto', () => {
    expect(confirmDate('2026-09-05', '2026-09-02')).toBe('2026-09-02');
    expect(confirmDate('2026-09-05', '2026-09-20')).toBe('2026-09-05');
  });
});
