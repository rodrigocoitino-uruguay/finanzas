import { beforeEach, describe, expect, it } from 'vitest';
import { buildDemoData } from '../domain/demo';
import { db } from './db';
import { clearDemoData, hasDemoData, loadDemoData } from './demo';
import { upsertBrouRates } from './rates';
import { saveTransaction } from './transactions';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await upsertBrouRates([{ date: '2026-09-01', buy: 40, sell: 42, source: 'BROU', fetchedAt: '' }]);
});

describe('buildDemoData', () => {
  it('es reproducible y no genera fechas futuras', () => {
    const a = buildDemoData('2026-09-16', []);
    const b = buildDemoData('2026-09-16', []);
    expect(a.transactions.map((t) => t.amount)).toEqual(b.transactions.map((t) => t.amount));
    expect(a.transactions.every((t) => t.date <= '2026-09-16' && t.date >= '2026-04-01')).toBe(true);
    expect(a.transactions.length).toBeGreaterThan(150);
    expect(a.transactions.every((t) => t.isDemo && t.amountUYU > 0 && t.amountUSD > 0)).toBe(true);
  });

  it('reutiliza categorías existentes con el mismo nombre', () => {
    const existing = buildDemoData('2026-09-16', []).categories.filter((c) => c.name === 'Alquiler');
    const r = buildDemoData('2026-09-16', existing.map((c) => ({ ...c, id: 'real', isDemo: undefined })));
    expect(r.categories.find((c) => c.name === 'Alquiler')).toBeUndefined();
    expect(r.transactions.some((t) => t.categoryId === 'real')).toBe(true);
  });
});

describe('cargar y borrar datos demo', () => {
  it('no toca los datos reales', async () => {
    const real = await saveTransaction({
      kind: 'expense',
      group: 'variable',
      amount: 500,
      currency: 'UYU',
      date: '2026-09-10',
      categoryName: 'Comida',
    });
    const loaded = await loadDemoData('2026-09-16');
    expect(loaded.transactions).toBeGreaterThan(150);
    expect(await hasDemoData()).toBe(true);
    await expect(loadDemoData('2026-09-16')).rejects.toThrow();

    // "Comida" ya existía: los demo la usan, pero no se duplica
    expect(await db.categories.filter((c) => c.name === 'Comida').count()).toBe(1);

    // un movimiento real en una categoría demo la conserva
    const supermercado = (await db.categories.filter((c) => c.name === 'Supermercado').first())!;
    await saveTransaction({
      kind: 'expense',
      group: 'variable',
      amount: 900,
      currency: 'UYU',
      date: '2026-09-11',
      categoryId: supermercado.id,
    });

    await clearDemoData();
    expect(await hasDemoData()).toBe(false);
    const left = await db.transactions.toArray();
    expect(left.map((t) => t.amount).sort()).toEqual([500, 900]);
    expect(left.find((t) => t.id === real.tx.id)).toBeTruthy();
    const cats = await db.categories.toArray();
    expect(cats.map((c) => c.name).sort()).toEqual(['Comida', 'Supermercado']);
    expect(cats.every((c) => !c.isDemo)).toBe(true);
  });
});
