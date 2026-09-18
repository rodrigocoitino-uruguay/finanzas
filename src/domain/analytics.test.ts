import { describe, expect, it } from 'vitest';
import {
  OTHERS_ID,
  breakdownByCategory,
  breakdownByIncomeGroup,
  computeTotals,
  evolutionMonths,
  groupShare,
  monthlySeries,
  spendingRatio,
  summaryMonths,
  topWithOthers,
  usdSpentInPesos,
  type Slice,
} from './analytics';
import { convert } from './money';
import type { Category, Currency, Group, Transaction } from './types';

const cat = (id: string, group: Group, name = id): Category => ({
  id,
  kind: group === 'fixed' || group === 'variable' ? 'expense' : 'income',
  group,
  name,
  normalizedName: name.toLowerCase(),
  color: '#4895F3',
  usageCount: 0,
  archived: false,
  createdAt: '',
});

const cats = new Map(
  [
    cat('alq', 'fixed', 'Alquiler'),
    cat('gc', 'fixed', 'Gastos comunes'),
    cat('com', 'variable', 'Comida'),
    cat('sup', 'variable', 'Super'),
    cat('sue', 'salary', 'Sueldo'),
    cat('fre', 'freelance', 'Cliente'),
    cat('otr', 'other', 'Venta'),
  ].map((c) => [c.id, c]),
);

let n = 0;
const tx = (
  categoryId: string,
  amount: number,
  currency: Currency,
  date = '2026-09-10',
  status: Transaction['status'] = 'confirmed',
  rate = 40,
): Transaction => {
  const c = cats.get(categoryId)!;
  return {
    id: `t${++n}`,
    kind: c.kind,
    amount,
    currency,
    rateAtDate: rate,
    ...convert(amount, currency, rate),
    categoryId,
    date,
    status,
    createdAt: '',
    updatedAt: '',
  };
};

const sept = [
  tx('sue', 3000, 'USD'), // 120.000 UYU
  tx('fre', 20000, 'UYU'), // 500 USD
  tx('alq', 28000, 'UYU'),
  tx('gc', 6500, 'UYU'),
  tx('com', 1890, 'UYU'),
  tx('com', 110, 'UYU'),
  tx('sup', 50, 'USD'), // 2.000 UYU
  tx('alq', 99999, 'UYU', '2026-09-30', 'pending'), // no cuenta
];

describe('computeTotals', () => {
  it('suma en ambas monedas e ignora pendientes', () => {
    const uyu = computeTotals(sept, cats, 'UYU');
    expect(uyu).toMatchObject({
      income: 140000,
      expense: 38500,
      balance: 101500,
      fixed: 34500,
      variable: 4000,
      salary: 120000,
      freelance: 20000,
      otherIncome: 0,
      count: 7,
    });
    const usd = computeTotals(sept, cats, 'USD');
    expect(usd.income).toBe(3500);
    expect(usd.expense).toBe(962.5);
    expect(usd.balance).toBe(2537.5);
    expect(usd.fixed).toBe(862.5);
    expect(usd.variable).toBe(100);
  });

  it('sin movimientos da ceros', () => {
    expect(computeTotals([], cats, 'UYU')).toMatchObject({ income: 0, expense: 0, balance: 0, count: 0 });
  });

  it('fijos + variables = total de gastos', () => {
    const t = computeTotals(sept, cats, 'USD');
    expect(t.fixed + t.variable).toBeCloseTo(t.expense, 10);
  });
});

describe('breakdownByCategory', () => {
  it('agrupa, ordena de mayor a menor y calcula el %', () => {
    const r = breakdownByCategory(sept, cats, 'UYU', { kind: 'expense' });
    expect(r.map((s) => [s.name, s.amount])).toEqual([
      ['Alquiler', 28000],
      ['Gastos comunes', 6500],
      ['Comida', 2000],
      ['Super', 2000],
    ]);
    expect(r[0].share).toBeCloseTo(28000 / 38500);
    expect(r.reduce((a, s) => a + s.share, 0)).toBeCloseTo(1);
    expect(r.find((s) => s.name === 'Comida')?.count).toBe(2);
  });

  it('filtra fijos o variables', () => {
    expect(breakdownByCategory(sept, cats, 'UYU', { kind: 'expense', group: 'fixed' }).map((s) => s.id)).toEqual([
      'alq',
      'gc',
    ]);
    const vars = breakdownByCategory(sept, cats, 'USD', { kind: 'expense', group: 'variable' });
    expect(vars.map((s) => [s.id, s.amount, s.share])).toEqual([
      // a igual monto, orden alfabético
      ['com', 50, 0.5],
      ['sup', 50, 0.5],
    ]);
  });

  it('ingresos por tipo', () => {
    const r = breakdownByIncomeGroup(sept, cats, 'USD');
    expect(r.map((s) => [s.id, s.amount])).toEqual([
      ['salary', 3000],
      ['freelance', 500],
    ]);
    expect(r[0].share).toBeCloseTo(3000 / 3500);
    expect(r[1].categoryIds).toEqual(['fre']);
  });
});

describe('topWithOthers', () => {
  const slices = (k: number): Slice[] =>
    Array.from({ length: k }, (_, i) => ({
      id: `c${i}`,
      name: `C${i}`,
      color: '#000',
      amount: 100 - i,
      share: (100 - i) / 1000,
      count: 1,
      categoryIds: [`c${i}`],
    }));

  it('con 7 o menos no agrupa', () => {
    expect(topWithOthers(slices(7)).visible).toHaveLength(7);
    expect(topWithOthers(slices(7)).rest).toHaveLength(0);
    expect(topWithOthers(slices(3)).visible).toHaveLength(3);
  });

  it('con más de 7 muestra 6 + Otros', () => {
    const r = topWithOthers(slices(10));
    expect(r.visible).toHaveLength(7);
    expect(r.visible[6].id).toBe(OTHERS_ID);
    expect(r.visible[6].amount).toBe(94 + 93 + 92 + 91);
    expect(r.visible[6].categoryIds).toEqual(['c6', 'c7', 'c8', 'c9']);
    expect(r.visible[6].count).toBe(4);
    expect(r.rest.map((s) => s.id)).toEqual(['c6', 'c7', 'c8', 'c9']);
  });
});

describe('monthlySeries', () => {
  it('separa fijos, variables e ingresos por mes', () => {
    const txs = [...sept, tx('alq', 27000, 'UYU', '2026-08-05'), tx('sue', 3000, 'USD', '2026-08-01', 'confirmed', 39)];
    const s = monthlySeries(txs, cats, 'UYU', ['2026-07', '2026-08', '2026-09']);
    expect(s[0]).toEqual({ month: '2026-07', fixed: 0, variable: 0, expense: 0, income: 0, balance: 0 });
    expect(s[1]).toEqual({ month: '2026-08', fixed: 27000, variable: 0, expense: 27000, income: 117000, balance: 90000 });
    expect(s[2]).toMatchObject({ fixed: 34500, variable: 4000, expense: 38500, income: 140000, balance: 101500 });
  });
});

describe('indicadores', () => {
  it('% del ingreso que se va en gastos', () => {
    expect(spendingRatio({ income: 1000, expense: 620 })).toBeCloseTo(0.62);
    expect(spendingRatio({ income: 0, expense: 620 })).toBeNull();
  });

  it('USD que se fueron en pesos (solo gastos cargados en UYU)', () => {
    // 28000/40 + 6500/40 + 1890/40 + 110/40 = 700 + 162,5 + 47,25 + 2,75
    expect(usdSpentInPesos(sept)).toBe(912.5);
    expect(usdSpentInPesos([tx('com', 100, 'UYU', '2026-09-01', 'confirmed', 39.05)])).toBe(2.56);
  });

  it('proporción fijos/variables', () => {
    expect(groupShare(750, 250)).toEqual({ fixed: 0.75, variable: 0.25 });
    expect(groupShare(0, 0)).toEqual({ fixed: 0, variable: 0 });
  });
});

describe('meses de los gráficos', () => {
  const today = '2026-09-16';
  it('un mes → los últimos 6', () => {
    expect(evolutionMonths({ mode: 'month', anchor: '2026-09-16' }, today)).toEqual([
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
    ]);
    expect(evolutionMonths({ mode: 'month', anchor: '2026-03-02' }, today)[5]).toBe('2026-03');
  });
  it('trimestre y año, sin meses futuros', () => {
    expect(evolutionMonths({ mode: 'last3', anchor: today }, today)).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(evolutionMonths({ mode: 'year', anchor: today }, today)).toHaveLength(9);
    expect(evolutionMonths({ mode: 'year', anchor: '2025-05-01' }, today)).toHaveLength(12);
  });
  it('personalizado corto → últimos 6 meses', () => {
    expect(evolutionMonths({ mode: 'custom', anchor: today, from: '2026-09-01', to: '2026-09-10' }, today)).toHaveLength(6);
  });
  it('resumen: 6 meses que terminan en el período', () => {
    expect(summaryMonths({ mode: 'month', anchor: '2026-06-10' }, today).at(-1)).toBe('2026-06');
    expect(summaryMonths({ mode: 'year', anchor: today }, today).at(-1)).toBe('2026-09');
  });
});
