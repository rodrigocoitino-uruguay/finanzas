import { beforeEach, describe, expect, it } from 'vitest';
import { setBudget, removeBudget } from './budgets';
import { db } from './db';
import { upsertBrouRates } from './rates';
import {
  confirmPending,
  createRecurringFromTx,
  deleteRecurring,
  generateDueRecurring,
  setRecurringActive,
  skipPending,
  updateRecurring,
} from './recurring';
import { saveTransaction, ValidationError } from './transactions';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await upsertBrouRates([
    { date: '2026-08-01', buy: 39, sell: 41, source: 'BROU', fetchedAt: '' },
    { date: '2026-09-01', buy: 40, sell: 42, source: 'BROU', fetchedAt: '' },
  ]);
});

async function alquilerAgosto() {
  const { tx } = await saveTransaction(
    { kind: 'expense', group: 'fixed', amount: 28000, currency: 'UYU', date: '2026-08-05', categoryName: 'Alquiler' },
    new Date('2026-08-05T12:00:00Z'),
  );
  return tx;
}

describe('recurrentes', () => {
  it('al empezar el mes genera el pendiente, una sola vez', async () => {
    const tx = await alquilerAgosto();
    const rec = await createRecurringFromTx(tx.id, 5, '2026-08-05');
    expect(rec.lastGeneratedMonth).toBe('2026-08');
    expect((await db.transactions.get(tx.id))?.recurringId).toBe(rec.id);

    expect(await generateDueRecurring('2026-08-20')).toBe(0); // mismo mes: nada
    expect(await generateDueRecurring('2026-09-01')).toBe(1);
    expect(await generateDueRecurring('2026-09-02')).toBe(0); // no duplica

    const pending = await db.transactions.where('status').equals('pending').toArray();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ date: '2026-09-05', amount: 28000, recurringId: rec.id, amountUSD: 700 });
  });

  it('confirmar antes del día previsto usa la fecha de hoy', async () => {
    const tx = await alquilerAgosto();
    await createRecurringFromTx(tx.id, 5, '2026-08-05');
    await generateDueRecurring('2026-09-01');
    const [p] = await db.transactions.where('status').equals('pending').toArray();
    const confirmed = await confirmPending(p.id, '2026-09-02');
    expect(confirmed).toMatchObject({ status: 'confirmed', date: '2026-09-02', rateAtDate: 40 });
    await expect(confirmPending(p.id, '2026-09-02')).rejects.toBeInstanceOf(ValidationError);
  });

  it('saltear borra el pendiente y no se vuelve a generar ese mes', async () => {
    const tx = await alquilerAgosto();
    await createRecurringFromTx(tx.id, 5, '2026-08-05');
    await generateDueRecurring('2026-09-01');
    const [p] = await db.transactions.where('status').equals('pending').toArray();
    const removed = await skipPending(p.id);
    expect(removed?.id).toBe(p.id);
    expect(await generateDueRecurring('2026-09-10')).toBe(0);
    expect(await db.transactions.where('status').equals('pending').count()).toBe(0);
  });

  it('editar la plantilla actualiza los pendientes, no los confirmados', async () => {
    const tx = await alquilerAgosto();
    const rec = await createRecurringFromTx(tx.id, 5, '2026-08-05');
    await generateDueRecurring('2026-09-01');
    await updateRecurring(rec.id, { amount: 30000, dayOfMonth: 31, note: 'con aumento' });
    const [p] = await db.transactions.where('status').equals('pending').toArray();
    expect(p).toMatchObject({ amount: 30000, amountUYU: 30000, date: '2026-09-30', note: 'con aumento' });
    expect((await db.transactions.get(tx.id))?.amount).toBe(28000);
    await expect(updateRecurring(rec.id, { dayOfMonth: 40 })).rejects.toBeInstanceOf(ValidationError);
  });

  it('pausado no genera; al reanudar no recupera los meses en pausa', async () => {
    const tx = await alquilerAgosto();
    const rec = await createRecurringFromTx(tx.id, 5, '2026-08-05');
    await setRecurringActive(rec.id, false, '2026-08-10');
    expect(await generateDueRecurring('2026-11-01')).toBe(0);
    await setRecurringActive(rec.id, true, '2026-11-03');
    const pending = await db.transactions.where('status').equals('pending').toArray();
    expect(pending.map((t) => t.date)).toEqual(['2026-11-05']);
  });

  it('se pone al día si la app no se abrió en varios meses', async () => {
    const tx = await alquilerAgosto();
    await createRecurringFromTx(tx.id, 5, '2026-08-05');
    expect(await generateDueRecurring('2026-11-15')).toBe(3);
  });

  it('borrar elimina pendientes y conserva lo confirmado', async () => {
    const tx = await alquilerAgosto();
    const rec = await createRecurringFromTx(tx.id, 5, '2026-08-05');
    await generateDueRecurring('2026-09-01');
    await deleteRecurring(rec.id);
    expect(await db.recurrings.count()).toBe(0);
    expect(await db.transactions.where('status').equals('pending').count()).toBe(0);
    const kept = await db.transactions.get(tx.id);
    expect(kept?.amount).toBe(28000);
    expect(kept?.recurringId).toBeUndefined();
  });

  it('confirmar desde el formulario suma uso a la categoría', async () => {
    const tx = await alquilerAgosto();
    await createRecurringFromTx(tx.id, 5, '2026-08-05');
    await generateDueRecurring('2026-09-01');
    const [p] = await db.transactions.where('status').equals('pending').toArray();
    const before = (await db.categories.get(p.categoryId))!.usageCount;
    await saveTransaction({
      id: p.id,
      kind: 'expense',
      group: 'fixed',
      amount: 29000,
      currency: 'UYU',
      date: '2026-09-05',
      categoryId: p.categoryId,
      status: 'confirmed',
      resetRate: true,
    });
    expect((await db.categories.get(p.categoryId))!.usageCount).toBe(before + 1);
    expect((await db.transactions.get(p.id))?.status).toBe('confirmed');
  });
});

describe('presupuestos', () => {
  it('uno por categoría, se actualiza y se borra', async () => {
    const { category } = await saveTransaction({
      kind: 'expense',
      group: 'variable',
      amount: 100,
      currency: 'UYU',
      date: '2026-09-02',
      categoryName: 'Comida',
    });
    await setBudget(category.id, 10000, 'UYU');
    await setBudget(category.id, 250, 'USD');
    expect(await db.budgets.toArray()).toMatchObject([{ categoryId: category.id, amount: 250, currency: 'USD' }]);
    await expect(setBudget(category.id, 0, 'UYU')).rejects.toBeInstanceOf(ValidationError);
    await expect(setBudget('nope', 10, 'UYU')).rejects.toBeInstanceOf(ValidationError);
    await removeBudget(category.id);
    expect(await db.budgets.count()).toBe(0);
  });
});
