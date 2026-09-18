import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { removeManualRate, setManualRate, upsertBrouRates } from './rates';
import {
  deleteTransaction,
  findRecalculable,
  NoRateError,
  recalculateTransactions,
  restoreTransaction,
  saveTransaction,
  ValidationError,
} from './transactions';

const NOW = new Date('2026-09-16T15:00:00Z');

async function seedRates() {
  await upsertBrouRates([
    { date: '2026-09-11', buy: 39.6, sell: 42, source: 'BROU', fetchedAt: '' },
    { date: '2026-09-16', buy: 40.1, sell: 42.5, source: 'BROU', fetchedAt: '' },
  ]);
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await seedRates();
});

describe('saveTransaction', () => {
  it('crea la categoría automáticamente bajo el grupo elegido', async () => {
    const { tx, category, createdCategory } = await saveTransaction(
      { kind: 'expense', group: 'fixed', amount: 28000, currency: 'UYU', date: '2026-09-16', categoryName: 'alquiler' },
      NOW,
    );
    expect(createdCategory).toBe(true);
    expect(category).toMatchObject({ name: 'Alquiler', group: 'fixed', kind: 'expense', usageCount: 1 });
    expect(tx).toMatchObject({
      amount: 28000,
      currency: 'UYU',
      rateAtDate: 40.1,
      amountUYU: 28000,
      amountUSD: 698.25,
      status: 'confirmed',
      categoryId: category.id,
    });
    expect(await db.categories.count()).toBe(1);
  });

  it('reutiliza la categoría existente sin duplicar (mayúsculas, tildes, espacios)', async () => {
    const first = await saveTransaction(
      { kind: 'expense', group: 'variable', amount: 1890, currency: 'UYU', date: '2026-09-16', categoryName: 'Comida' },
      NOW,
    );
    for (const name of ['comida', 'Comida ', 'cómida']) {
      const r = await saveTransaction(
        { kind: 'expense', group: 'variable', amount: 100, currency: 'UYU', date: '2026-09-16', categoryName: name },
        NOW,
      );
      expect(r.createdCategory).toBe(false);
      expect(r.category.id).toBe(first.category.id);
    }
    expect(await db.categories.count()).toBe(1);
    expect((await db.categories.get(first.category.id))?.usageCount).toBe(4);
  });

  it('la misma palabra en gastos e ingresos son categorías distintas', async () => {
    await saveTransaction({ kind: 'expense', group: 'variable', amount: 1, currency: 'UYU', date: '2026-09-16', categoryName: 'Varios' }, NOW);
    const r = await saveTransaction({ kind: 'income', group: 'other', amount: 1, currency: 'UYU', date: '2026-09-16', categoryName: 'Varios' }, NOW);
    expect(r.createdCategory).toBe(true);
    expect(await db.categories.count()).toBe(2);
  });

  it('ingreso sin detalle usa el nombre del tipo', async () => {
    const r = await saveTransaction({ kind: 'income', group: 'salary', amount: 2500, currency: 'USD', date: '2026-09-16' }, NOW);
    expect(r.category).toMatchObject({ name: 'Sueldo', group: 'salary' });
    expect(r.tx).toMatchObject({ amountUSD: 2500, amountUYU: 100250 });
  });

  it('gasto sin categoría no se guarda', async () => {
    await expect(
      saveTransaction({ kind: 'expense', group: 'fixed', amount: 10, currency: 'UYU', date: '2026-09-16' }, NOW),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('valida monto, fecha y grupo', async () => {
    const base = { kind: 'expense' as const, group: 'fixed' as const, currency: 'UYU' as const, date: '2026-09-16', categoryName: 'X' };
    await expect(saveTransaction({ ...base, amount: 0 }, NOW)).rejects.toBeInstanceOf(ValidationError);
    await expect(saveTransaction({ ...base, amount: -5 }, NOW)).rejects.toBeInstanceOf(ValidationError);
    await expect(saveTransaction({ ...base, amount: NaN }, NOW)).rejects.toBeInstanceOf(ValidationError);
    await expect(saveTransaction({ ...base, amount: 0.001 }, NOW)).rejects.toBeInstanceOf(ValidationError);
    await expect(saveTransaction({ ...base, amount: 5, date: '2026-02-30' }, NOW)).rejects.toBeInstanceOf(ValidationError);
    await expect(saveTransaction({ ...base, amount: 5, group: 'salary' }, NOW)).rejects.toBeInstanceOf(ValidationError);
    expect(await db.transactions.count()).toBe(0);
  });

  it('fin de semana usa la cotización del viernes', async () => {
    const { tx } = await saveTransaction(
      { kind: 'expense', group: 'variable', amount: 396, currency: 'UYU', date: '2026-09-13', categoryName: 'Feria' },
      NOW,
    );
    expect(tx.rateAtDate).toBe(39.6);
    expect(tx.amountUSD).toBe(10);
    expect(tx.rateApprox).toBeUndefined();
  });

  it('respeta el override manual del día', async () => {
    await setManualRate('2026-09-16', 41);
    const { tx } = await saveTransaction(
      { kind: 'expense', group: 'variable', amount: 10, currency: 'USD', date: '2026-09-16', categoryName: 'Netflix' },
      NOW,
    );
    expect(tx.rateAtDate).toBe(41);
    expect(tx.amountUYU).toBe(410);
  });

  it('sin ninguna cotización pide una manual', async () => {
    await db.rates.clear();
    await expect(
      saveTransaction({ kind: 'expense', group: 'variable', amount: 10, currency: 'UYU', date: '2026-09-16', categoryName: 'A' }, NOW),
    ).rejects.toBeInstanceOf(NoRateError);
    const { tx } = await saveTransaction(
      { kind: 'expense', group: 'variable', amount: 10, currency: 'USD', date: '2026-09-16', categoryName: 'A', rateOverride: 40 },
      NOW,
    );
    expect(tx.amountUYU).toBe(400);
  });

  it('al editar conserva la cotización salvo que cambie la fecha', async () => {
    const { tx } = await saveTransaction(
      { kind: 'expense', group: 'variable', amount: 100, currency: 'USD', date: '2026-09-16', categoryName: 'Viaje' },
      NOW,
    );
    // el dólar se mueve
    await upsertBrouRates([{ date: '2026-09-16', buy: 45, sell: 47, source: 'BROU', fetchedAt: '' }]);
    const edited = await saveTransaction(
      { id: tx.id, kind: 'expense', group: 'variable', amount: 200, currency: 'USD', date: '2026-09-16', categoryId: tx.categoryId },
      new Date('2026-09-17T10:00:00Z'),
    );
    expect(edited.tx.rateAtDate).toBe(40.1);
    expect(edited.tx.amountUYU).toBe(8020);
    expect(edited.tx.createdAt).toBe(tx.createdAt);
    expect(edited.tx.updatedAt).not.toBe(tx.updatedAt);
    expect(await db.transactions.count()).toBe(1);

    const moved = await saveTransaction(
      { id: tx.id, kind: 'expense', group: 'variable', amount: 200, currency: 'USD', date: '2026-09-11', categoryId: tx.categoryId },
      NOW,
    );
    expect(moved.tx.rateAtDate).toBe(39.6);
  });

  it('borrar y deshacer', async () => {
    const { tx } = await saveTransaction(
      { kind: 'expense', group: 'variable', amount: 1, currency: 'UYU', date: '2026-09-16', categoryName: 'A', note: '  hola  ' },
      NOW,
    );
    expect(tx.note).toBe('hola');
    const removed = await deleteTransaction(tx.id);
    expect(await db.transactions.count()).toBe(0);
    await restoreTransaction(removed!);
    expect(await db.transactions.get(tx.id)).toEqual(tx);
  });
});

describe('recalcular con otra cotización', () => {
  const base = { kind: 'expense' as const, group: 'variable' as const, currency: 'USD' as const, categoryName: 'Viaje' };

  it('un override manual del día se puede aplicar a los movimientos existentes', async () => {
    const { tx } = await saveTransaction({ ...base, amount: 100, date: '2026-09-16' }, NOW);
    expect(tx.rateAtDate).toBe(40.1);
    expect(await findRecalculable()).toHaveLength(0);

    await setManualRate('2026-09-16', 41);
    const pending = await findRecalculable();
    expect(pending.map((t) => t.id)).toEqual([tx.id]);
    expect(await recalculateTransactions(pending.map((t) => t.id))).toBe(1);
    expect(await db.transactions.get(tx.id)).toMatchObject({ rateAtDate: 41, amountUYU: 4100, amountUSD: 100 });

    // sacar el override y volver al BROU
    await removeManualRate('2026-09-16');
    expect(await recalculateTransactions()).toBe(1);
    expect((await db.transactions.get(tx.id))?.rateAtDate).toBe(40.1);
  });

  it('una cotización fijada a mano en el movimiento no se recalcula', async () => {
    const { tx } = await saveTransaction({ ...base, amount: 100, date: '2026-09-16', rateOverride: 45 }, NOW);
    expect(tx).toMatchObject({ rateAtDate: 45, rateCustom: true, amountUYU: 4500 });
    await setManualRate('2026-09-16', 41);
    expect(await findRecalculable()).toHaveLength(0);
    expect(await recalculateTransactions()).toBe(0);

    // al editar sin tocar la cotización, se mantiene la fijada
    const kept = await saveTransaction({ ...base, id: tx.id, amount: 200, date: '2026-09-16', categoryId: tx.categoryId }, NOW);
    expect(kept.tx).toMatchObject({ rateAtDate: 45, rateCustom: true, amountUYU: 9000 });

    // "usar la del día" vuelve al histórico
    const reset = await saveTransaction(
      { ...base, id: tx.id, amount: 200, date: '2026-09-16', categoryId: tx.categoryId, resetRate: true },
      NOW,
    );
    expect(reset.tx.rateAtDate).toBe(41);
    expect(reset.tx.rateCustom).toBeUndefined();
  });

  it('los movimientos demo no se recalculan', async () => {
    const { tx } = await saveTransaction({ ...base, amount: 10, date: '2026-09-16', isDemo: true }, NOW);
    await setManualRate('2026-09-16', 41);
    expect(await findRecalculable()).toHaveLength(0);
    expect(await recalculateTransactions()).toBe(0);
    expect((await db.transactions.get(tx.id))?.rateAtDate).toBe(40.1);
  });
});
