import { describe, expect, it } from 'vitest';
import {
  comparisonRange,
  lastNMonths,
  monthsInRange,
  periodLabel,
  periodRange,
  previousLabel,
  previousRange,
  shiftPeriod,
} from './periods';

describe('periodRange', () => {
  it('mes', () => {
    expect(periodRange({ mode: 'month', anchor: '2026-09-16' })).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(periodRange({ mode: 'month', anchor: '2024-02-10' })).toEqual({ from: '2024-02-01', to: '2024-02-29' });
  });
  it('últimos 3 meses (incluye el actual)', () => {
    expect(periodRange({ mode: 'last3', anchor: '2026-09-16' })).toEqual({ from: '2026-07-01', to: '2026-09-30' });
    expect(periodRange({ mode: 'last3', anchor: '2026-01-05' })).toEqual({ from: '2025-11-01', to: '2026-01-31' });
  });
  it('año calendario', () => {
    expect(periodRange({ mode: 'year', anchor: '2026-09-16' })).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });
  it('personalizado (ordena las fechas)', () => {
    expect(periodRange({ mode: 'custom', anchor: 'x', from: '2026-09-20', to: '2026-09-01' })).toEqual({
      from: '2026-09-01',
      to: '2026-09-20',
    });
  });
});

describe('shiftPeriod / previousRange', () => {
  it('mes anterior, cruzando el año', () => {
    expect(periodRange(shiftPeriod({ mode: 'month', anchor: '2026-01-31' }, -1))).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    });
    // 31 de marzo → febrero (no se saltea febrero)
    expect(periodRange(shiftPeriod({ mode: 'month', anchor: '2026-03-31' }, -1)).from).toBe('2026-02-01');
  });
  it('trimestre móvil anterior', () => {
    expect(previousRange({ mode: 'last3', anchor: '2026-09-16' })).toEqual({ from: '2026-04-01', to: '2026-06-30' });
  });
  it('año anterior', () => {
    expect(previousRange({ mode: 'year', anchor: '2026-09-16' })).toEqual({ from: '2025-01-01', to: '2025-12-31' });
  });
  it('personalizado: mismo largo, inmediatamente antes', () => {
    expect(previousRange({ mode: 'custom', anchor: '2026-09-10', from: '2026-09-01', to: '2026-09-10' })).toEqual({
      from: '2026-08-22',
      to: '2026-08-31',
    });
  });
});

describe('meses', () => {
  it('monthsInRange', () => {
    expect(monthsInRange({ from: '2025-11-15', to: '2026-02-01' })).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
  it('lastNMonths', () => {
    expect(lastNMonths('2026-02-10', 6)).toEqual(['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02']);
  });
});

describe('periodLabel', () => {
  it('en español', () => {
    expect(periodLabel({ mode: 'month', anchor: '2026-09-16' })).toBe('Septiembre 2026');
    expect(periodLabel({ mode: 'year', anchor: '2026-09-16' })).toBe('2026');
    expect(periodLabel({ mode: 'last3', anchor: '2026-09-16' })).toBe('Jul – Sep 2026');
  });
});

describe('previousLabel', () => {
  it('nombra el período de comparación', () => {
    expect(previousLabel({ mode: 'month', anchor: '2026-09-16' })).toBe('vs. agosto');
    expect(previousLabel({ mode: 'month', anchor: '2026-01-16' })).toBe('vs. diciembre');
    expect(previousLabel({ mode: 'year', anchor: '2026-09-16' })).toBe('vs. 2025');
  });
});

describe('comparisonRange', () => {
  const today = '2026-09-16';
  it('mes en curso: mismos días del mes anterior', () => {
    expect(comparisonRange({ mode: 'month', anchor: today }, today)).toEqual({
      range: { from: '2026-08-01', to: '2026-08-16' },
      label: 'vs. 1–16 ago',
    });
    // 31 de marzo → hasta el 28 de febrero
    expect(comparisonRange({ mode: 'month', anchor: '2026-03-31' }, '2026-03-30').range).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
  });
  it('año en curso: mismo tramo del año anterior', () => {
    expect(comparisonRange({ mode: 'year', anchor: today }, today)).toEqual({
      range: { from: '2025-01-01', to: '2025-09-16' },
      label: 'vs. mismo período 2025',
    });
  });
  it('períodos cerrados: el período anterior completo', () => {
    expect(comparisonRange({ mode: 'month', anchor: '2026-08-10' }, today)).toEqual({
      range: { from: '2026-07-01', to: '2026-07-31' },
      label: 'vs. julio',
    });
    // último día del mes: el mes ya está completo
    expect(comparisonRange({ mode: 'month', anchor: '2026-09-30' }, '2026-09-30').range.to).toBe('2026-08-31');
  });
});
