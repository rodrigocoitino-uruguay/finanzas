import { describe, expect, it } from 'vitest';
import { convert, ratio, round2, subMoney, sumMoney, toCents, variation } from './money';

describe('round2', () => {
  it('redondea mitad lejos de cero sin errores de punto flotante', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(1.255)).toBe(1.26);
    expect(round2(0.285)).toBe(0.29);
    expect(round2(-1.005)).toBe(-1.01);
    expect(round2(2.675)).toBe(2.68);
    expect(round2(10)).toBe(10);
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });

  it('maneja casos borde', () => {
    expect(round2(NaN)).toBe(0);
    expect(round2(Infinity)).toBe(0);
    expect(Object.is(round2(-0.001), 0)).toBe(true);
    expect(round2(1e-7)).toBe(0);
    expect(round2(123456789.125)).toBe(123456789.13);
  });
});

describe('sumas', () => {
  it('suma en centésimos (0,1 + 0,2 = 0,3)', () => {
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
    expect(sumMoney(Array(10).fill(0.1))).toBe(1);
    expect(sumMoney([])).toBe(0);
    expect(sumMoney([1890, 28000, 6500.5])).toBe(36390.5);
  });

  it('resta', () => {
    expect(subMoney(0.3, 0.1)).toBe(0.2);
    expect(subMoney(100, 250.75)).toBe(-150.75);
  });

  it('toCents', () => {
    expect(toCents(19.99)).toBe(1999);
    expect(toCents(1.005)).toBe(101);
  });
});

describe('convert', () => {
  it('UYU → USD con la cotización compra', () => {
    expect(convert(28000, 'UYU', 40.1)).toEqual({ amountUYU: 28000, amountUSD: 698.25 });
    expect(convert(1890, 'UYU', 39.05)).toEqual({ amountUYU: 1890, amountUSD: 48.4 });
  });

  it('USD → UYU', () => {
    expect(convert(1250.5, 'USD', 40.1)).toEqual({ amountUYU: 50145.05, amountUSD: 1250.5 });
    expect(convert(9.99, 'USD', 39.05)).toEqual({ amountUYU: 390.11, amountUSD: 9.99 });
  });

  it('rechaza cotizaciones inválidas', () => {
    expect(() => convert(10, 'UYU', 0)).toThrow();
    expect(() => convert(10, 'UYU', NaN)).toThrow();
  });
});

describe('variation / ratio', () => {
  it('calcula la variación relativa', () => {
    expect(variation(110, 100)).toBeCloseTo(0.1);
    expect(variation(90, 100)).toBeCloseTo(-0.1);
    expect(variation(10, 0)).toBeNull();
  });
  it('ratio con total cero', () => {
    expect(ratio(5, 0)).toBe(0);
    expect(ratio(1, 4)).toBe(0.25);
  });
});
