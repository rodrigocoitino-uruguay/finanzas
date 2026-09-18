import { describe, expect, it } from 'vitest';
import { budgetAlerts, budgetProgress, budgetState } from './budgets';
import { convert } from './money';
import type { Budget, Category, Transaction } from './types';

const cat = (id: string, name: string): Category => ({
  id,
  kind: 'expense',
  group: 'variable',
  name,
  normalizedName: name.toLowerCase(),
  color: '#000',
  usageCount: 0,
  archived: false,
  createdAt: '',
});
const cats = new Map([cat('com', 'Comida'), cat('sal', 'Salidas'), cat('sup', 'Super'), cat('amz', 'Amazon')].map((c) => [c.id, c]));

let n = 0;
const tx = (categoryId: string, amount: number, currency: 'UYU' | 'USD', date = '2026-09-10', status: Transaction['status'] = 'confirmed'): Transaction => ({
  id: `t${++n}`,
  kind: 'expense',
  amount,
  currency,
  rateAtDate: 40,
  ...convert(amount, currency, 40),
  categoryId,
  date,
  status,
  createdAt: '',
  updatedAt: '',
});

const budgets: Budget[] = [
  { id: 'b1', categoryId: 'com', amount: 10000, currency: 'UYU' },
  { id: 'b2', categoryId: 'sal', amount: 5000, currency: 'UYU' },
  { id: 'b3', categoryId: 'sup', amount: 20000, currency: 'UYU' },
  { id: 'b4', categoryId: 'amz', amount: 100, currency: 'USD' },
];

describe('budgetState', () => {
  it('umbrales 80 % y 100 %', () => {
    expect(budgetState(0.79)).toBe('ok');
    expect(budgetState(0.8)).toBe('warn');
    expect(budgetState(1)).toBe('warn');
    expect(budgetState(1.01)).toBe('over');
  });
});

describe('budgetProgress', () => {
  const txs = [
    tx('com', 6000, 'UYU'),
    tx('com', 4500, 'UYU'), // 105 %
    tx('sal', 4200, 'UYU'), // 84 %
    tx('sup', 2000, 'UYU'),
    tx('sup', 50000, 'UYU', '2026-08-30'), // otro mes: no cuenta
    tx('amz', 1600, 'UYU'), // 40 USD en un tope en dólares
    tx('sal', 3000, 'UYU', '2026-09-28', 'pending'), // pendiente: aparte
  ];
  const p = budgetProgress(budgets, txs, cats, '2026-09');

  it('ordena de mayor a menor uso y convierte a la moneda del tope', () => {
    expect(p.map((x) => [x.category.name, x.spent, x.state])).toEqual([
      ['Comida', 10500, 'over'],
      ['Salidas', 4200, 'warn'],
      ['Amazon', 40, 'ok'],
      ['Super', 2000, 'ok'],
    ]);
    expect(p.find((x) => x.category.id === 'sal')?.pending).toBe(3000);
  });

  it('alertas: solo las de 80 % o más', () => {
    expect(budgetAlerts(p).map((x) => x.category.name)).toEqual(['Comida', 'Salidas']);
  });

  it('ignora topes de categorías que ya no existen', () => {
    expect(budgetProgress([{ id: 'x', categoryId: 'nope', amount: 1, currency: 'UYU' }], txs, cats, '2026-09')).toEqual([]);
  });
});
