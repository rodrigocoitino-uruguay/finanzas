import { describe, expect, it } from 'vitest';
import { formatCompact, formatMoney, formatNumber, formatPercent, formatRate } from './format';

const nb = (s: string) => s.replace(/ /g, ' ').replace(/−/g, '-');

describe('formatMoney', () => {
  it('pesos sin decimales salvo que los tenga', () => {
    expect(nb(formatMoney(28000, 'UYU'))).toBe('$ 28.000');
    expect(nb(formatMoney(1890, 'UYU'))).toBe('$ 1.890');
    expect(nb(formatMoney(1890.5, 'UYU'))).toBe('$ 1.890,50');
    expect(nb(formatMoney(0, 'UYU'))).toBe('$ 0');
  });
  it('dólares siempre con dos decimales', () => {
    expect(nb(formatMoney(1250.5, 'USD'))).toBe('US$ 1.250,50');
    expect(nb(formatMoney(698.25, 'USD'))).toBe('US$ 698,25');
    expect(nb(formatMoney(1000000, 'USD'))).toBe('US$ 1.000.000,00');
  });
  it('signos', () => {
    expect(nb(formatMoney(-300, 'UYU'))).toBe('-$ 300');
    expect(nb(formatMoney(300, 'UYU', { signed: true }))).toBe('+$ 300');
    expect(nb(formatMoney(0, 'UYU', { signed: true }))).toBe('$ 0');
    expect(nb(formatMoney(-0.001, 'USD'))).toBe('US$ 0,00');
  });
  it('sin decimales para gráficos', () => {
    expect(nb(formatMoney(1250.5, 'USD', { decimals: 'never' }))).toBe('US$ 1.251');
  });
});

describe('otros formatos', () => {
  it('cotización', () => {
    expect(formatRate(40.1)).toBe('40,10');
    expect(formatRate(39.05)).toBe('39,05');
  });
  it('números', () => {
    expect(formatNumber(1234567.891, 'always')).toBe('1.234.567,89');
  });
  it('porcentajes', () => {
    expect(nb(formatPercent(0.123))).toBe('12 %');
    expect(nb(formatPercent(0.123, { signed: true }))).toBe('+12 %');
    expect(nb(formatPercent(-0.052))).toBe('-5,2 %');
    expect(nb(formatPercent(0.05))).toBe('5 %');
    expect(nb(formatPercent(0))).toBe('0 %');
    expect(nb(formatPercent(0, { signed: true }))).toBe('0 %');
  });
});

describe('formatCompact', () => {
  it('abrevia para ejes', () => {
    expect(nb(formatCompact(40000))).toBe('40 k');
    expect(nb(formatCompact(1250000))).toBe('1,3 M');
    expect(nb(formatCompact(2000000))).toBe('2 M');
    expect(nb(formatCompact(1500))).toBe('1,5 k');
    expect(nb(formatCompact(3000))).toBe('3 k');
    expect(nb(formatCompact(950))).toBe('950');
    expect(nb(formatCompact(0))).toBe('0');
    expect(nb(formatCompact(-12000))).toBe('-12 k');
  });
});
