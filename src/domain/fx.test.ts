import { describe, expect, it } from 'vitest';
import { latestRate, pickRate, rateFreshness, recalcTransaction } from './fx';
import { convert } from './money';
import type { Rate, Transaction } from './types';

const r = (date: string, buy: number, source: Rate['source'] = 'BROU'): Rate => ({
  date,
  buy,
  sell: buy + 2.4,
  source,
  fetchedAt: `${date}T13:30:00Z`,
});

const rates = [
  r('2026-09-10', 39.5), // jueves
  r('2026-09-11', 39.6), // viernes
  r('2026-09-14', 39.2), // lunes
  r('2026-09-15', 39.1),
  r('2026-09-16', 39.05),
];

describe('pickRate', () => {
  it('usa la cotización del mismo día', () => {
    expect(pickRate(rates, '2026-09-15')).toMatchObject({ rate: 39.1, date: '2026-09-15', approximate: false });
  });

  it('fin de semana: vale la del último día hábil', () => {
    expect(pickRate(rates, '2026-09-13')).toMatchObject({ rate: 39.6, date: '2026-09-11', approximate: false });
    expect(pickRate(rates, '2026-09-12')).toMatchObject({ rate: 39.6, approximate: false });
  });

  it('el override manual gana ese día', () => {
    const withManual = [...rates, r('2026-09-15', 40, 'manual')];
    expect(pickRate(withManual, '2026-09-15')).toMatchObject({ rate: 40, source: 'manual' });
    // pero no pisa días posteriores que sí tienen BROU
    expect(pickRate(withManual, '2026-09-16')).toMatchObject({ rate: 39.05, source: 'BROU' });
  });

  it('antes del histórico usa la más antigua, marcada como aproximada', () => {
    expect(pickRate(rates, '2026-08-01')).toMatchObject({ rate: 39.5, date: '2026-09-10', approximate: true });
  });

  it('muchos días sin datos: aproximada', () => {
    expect(pickRate(rates, '2026-10-01')).toMatchObject({ rate: 39.05, approximate: true });
    expect(pickRate(rates, '2026-09-20')).toMatchObject({ rate: 39.05, approximate: false });
  });

  it('sin cotizaciones devuelve null e ignora valores inválidos', () => {
    expect(pickRate([], '2026-09-16')).toBeNull();
    expect(pickRate([r('2026-09-16', 0), r('2026-09-16', NaN)], '2026-09-16')).toBeNull();
  });
});

describe('latestRate', () => {
  it('devuelve la más reciente', () => {
    expect(latestRate(rates)?.buy).toBe(39.05);
    expect(latestRate([])).toBeNull();
  });
});

describe('recalcTransaction', () => {
  const tx = (date: string, rate: number, extra: Partial<Transaction> = {}): Transaction => ({
    id: 't',
    kind: 'expense',
    amount: 1000,
    currency: 'UYU',
    rateAtDate: rate,
    ...convert(1000, 'UYU', rate),
    categoryId: 'c',
    date,
    status: 'confirmed',
    createdAt: '',
    updatedAt: '',
    ...extra,
  });

  it('actualiza cotización y montos convertidos', () => {
    const r = recalcTransaction(tx('2026-09-15', 40), rates, 'now');
    expect(r).toMatchObject({ rateAtDate: 39.1, amountUYU: 1000, amountUSD: 25.58, updatedAt: 'now' });
    expect(r?.rateApprox).toBeUndefined();
  });

  it('no toca lo que ya coincide ni lo fijado a mano', () => {
    expect(recalcTransaction(tx('2026-09-15', 39.1), rates, 'now')).toBeNull();
    expect(recalcTransaction(tx('2026-09-15', 45, { rateCustom: true }), rates, 'now')).toBeNull();
    expect(recalcTransaction(tx('2026-09-15', 40), [], 'now')).toBeNull();
  });

  it('una aproximada pasa a exacta cuando aparece el dato', () => {
    const r = recalcTransaction(tx('2026-09-11', 39.6, { rateApprox: true }), rates, 'now');
    expect(r?.rateApprox).toBeUndefined();
    expect(r?.rateAtDate).toBe(39.6);
  });
});

describe('rateFreshness', () => {
  it('fin de semana largo sigue al día; más de 4 días, no', () => {
    expect(rateFreshness({ date: '2026-09-11' }, '2026-09-14')).toBe('fresh');
    expect(rateFreshness({ date: '2026-09-11' }, '2026-09-15')).toBe('fresh');
    expect(rateFreshness({ date: '2026-09-11' }, '2026-09-16')).toBe('stale');
    expect(rateFreshness(null, '2026-09-16')).toBe('none');
  });
});
