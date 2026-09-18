import { describe, expect, it } from 'vitest';
import {
  BackupError,
  buildBackupFile,
  mergePayload,
  parseBackupFile,
  validateCategory,
  validatePayload,
  validateTransaction,
  type BackupPayload,
} from './backup';
import { normalizeName } from './categories';
import type { Category, Transaction } from './types';

const cat = (id: string, name: string, extra: Partial<Category> = {}): Category => ({
  id,
  kind: 'expense',
  group: 'variable',
  name,
  normalizedName: normalizeName(name),
  color: '#4895F3',
  usageCount: 1,
  archived: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...extra,
});
const tx = (id: string, categoryId: string, extra: Partial<Transaction> = {}): Transaction => ({
  id,
  kind: 'expense',
  amount: 100,
  currency: 'UYU',
  rateAtDate: 40,
  amountUYU: 100,
  amountUSD: 2.5,
  categoryId,
  date: '2026-09-10',
  status: 'confirmed',
  createdAt: '2026-09-10T10:00:00.000Z',
  updatedAt: '2026-09-10T10:00:00.000Z',
  ...extra,
});
const settings = { displayCurrency: 'UYU', defaultExpenseCurrency: 'UYU', defaultIncomeCurrency: 'USD', autoLockMinutes: 5 } as const;
const payload = (p: Partial<BackupPayload>): BackupPayload => ({
  transactions: [],
  categories: [],
  budgets: [],
  recurrings: [],
  rates: [],
  settings,
  ...p,
});

describe('validación', () => {
  it('acepta datos válidos y descarta campos desconocidos', () => {
    const t = validateTransaction({ ...tx('t1', 'c1'), hack: '<script>', note: 'ok' });
    expect(t).not.toHaveProperty('hack');
    expect(t.note).toBe('ok');
  });

  it('rechaza tipos y rangos inválidos', () => {
    expect(() => validateTransaction({ ...tx('t1', 'c1'), amount: -5 })).toThrow(BackupError);
    expect(() => validateTransaction({ ...tx('t1', 'c1'), date: '2026-13-40' })).toThrow(BackupError);
    expect(() => validateTransaction({ ...tx('t1', 'c1'), currency: 'EUR' })).toThrow(BackupError);
    expect(() => validateTransaction({ ...tx('t1', 'c1'), status: 'x' })).toThrow(BackupError);
  });

  it('el color tiene que ser un hex (se usa en estilos)', () => {
    expect(() => validateCategory({ ...cat('c1', 'Comida'), color: 'url(https://evil)' })).toThrow(BackupError);
    expect(() => validateCategory({ ...cat('c1', 'Comida'), color: 'red;x' })).toThrow(/Color/);
    expect(validateCategory(cat('c1', 'Comida')).color).toBe('#4895F3');
  });

  it('recalcula el nombre normalizado y el grupo debe corresponder al tipo', () => {
    expect(validateCategory({ ...cat('c1', 'Cómida'), normalizedName: 'otra' }).normalizedName).toBe('comida');
    expect(() => validateCategory({ ...cat('c1', 'X'), group: 'salary' })).toThrow(BackupError);
  });

  it('movimientos sin su categoría: error claro', () => {
    expect(() => validatePayload(payload({ transactions: [tx('t1', 'nope')] }))).toThrow(/categorías/);
  });

  it('descarta presupuestos y recurrentes huérfanos', () => {
    const p = validatePayload(
      payload({
        categories: [cat('c1', 'Comida')],
        budgets: [
          { id: 'b1', categoryId: 'c1', amount: 10, currency: 'UYU' },
          { id: 'b2', categoryId: 'zz', amount: 10, currency: 'UYU' },
        ],
      }),
    );
    expect(p.budgets.map((b) => b.id)).toEqual(['b1']);
  });
});

describe('archivo', () => {
  it('ida y vuelta sin cifrar', () => {
    const file = buildBackupFile(payload({}), false, 1, { transactions: 0, categories: 0 });
    const parsed = parseBackupFile(JSON.stringify(file), 1);
    expect(parsed.encrypted).toBe(false);
  });

  it('rechaza archivos que no son respaldos o de una versión más nueva', () => {
    expect(() => parseBackupFile('no json', 1)).toThrow(/JSON/);
    expect(() => parseBackupFile('{"format":"otra"}', 1)).toThrow(/Finanzas/);
    const newer = buildBackupFile(payload({}), false, 5, { transactions: 0, categories: 0 });
    expect(() => parseBackupFile(JSON.stringify(newer), 1)).toThrow(/más nueva/);
  });
});

describe('combinar', () => {
  it('unifica categorías con el mismo nombre y no duplica movimientos', () => {
    const current = payload({
      categories: [cat('c1', 'Comida')],
      transactions: [tx('t1', 'c1', { amount: 100, updatedAt: '2026-09-11T00:00:00Z' })],
      budgets: [{ id: 'b1', categoryId: 'c1', amount: 9000, currency: 'UYU' }],
    });
    const incoming = payload({
      categories: [cat('x9', 'comida '), cat('x2', 'Salidas')],
      transactions: [
        tx('t1', 'x9', { amount: 50, updatedAt: '2026-09-10T00:00:00Z' }), // más viejo: no pisa
        tx('t2', 'x9'),
        tx('t3', 'x2'),
      ],
      budgets: [{ id: 'b9', categoryId: 'x9', amount: 1, currency: 'UYU' }], // ya hay tope para Comida
    });
    const { result, stats } = mergePayload(current, incoming);
    expect(result.categories.map((c) => c.name).sort()).toEqual(['Comida', 'Salidas']);
    expect(result.transactions.find((t) => t.id === 't1')?.amount).toBe(100);
    expect(result.transactions.find((t) => t.id === 't2')?.categoryId).toBe('c1');
    expect(result.budgets).toEqual(current.budgets);
    expect(stats).toEqual({ added: 2, updated: 0, categoriesReused: 1 });
  });

  it('un movimiento editado después en el respaldo reemplaza al actual', () => {
    const current = payload({ categories: [cat('c1', 'Comida')], transactions: [tx('t1', 'c1', { amount: 1 })] });
    const incoming = payload({
      categories: [cat('c1', 'Comida')],
      transactions: [tx('t1', 'c1', { amount: 2, updatedAt: '2026-09-12T00:00:00Z' })],
    });
    const { result, stats } = mergePayload(current, incoming);
    expect(result.transactions[0].amount).toBe(2);
    expect(stats.updated).toBe(1);
  });
});
