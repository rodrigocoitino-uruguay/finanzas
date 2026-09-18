import { buildDemoData } from '../domain/demo';
import { newId } from '../lib/id';
import { db } from './db';

export async function hasDemoData(): Promise<boolean> {
  const tx = await db.transactions.filter((t) => t.isDemo === true).first();
  if (tx) return true;
  return Boolean(await db.categories.filter((c) => c.isDemo === true).first());
}

/** Carga 6 meses de movimientos de ejemplo. No toca los datos reales. */
export async function loadDemoData(today: string): Promise<{ transactions: number; categories: number }> {
  return db.transaction('rw', db.transactions, db.categories, async () => {
    if (await hasDemoData()) throw new Error('Los datos de ejemplo ya están cargados');
    const existing = await db.categories.toArray();
    const data = buildDemoData(today, existing, { seed: Date.now() % 1_000_000, makeId: newId });
    await db.categories.bulkAdd(data.categories);
    await db.transactions.bulkAdd(data.transactions);
    return { transactions: data.transactions.length, categories: data.categories.length };
  });
}

/**
 * Borra los movimientos de ejemplo y sus categorías. Si usaste una categoría de
 * ejemplo en un movimiento real, la categoría se conserva (pasa a ser tuya).
 */
export async function clearDemoData(): Promise<{ transactions: number; categories: number }> {
  return db.transaction('rw', db.transactions, db.categories, db.budgets, db.recurrings, async () => {
    const txIds = await db.transactions.filter((t) => t.isDemo === true).primaryKeys();
    await db.transactions.bulkDelete(txIds);

    const demoCats = await db.categories.filter((c) => c.isDemo === true).toArray();
    let removed = 0;
    for (const cat of demoCats) {
      const used = await db.transactions.where('categoryId').equals(cat.id).count();
      if (used > 0) {
        const { isDemo: _drop, ...rest } = cat;
        await db.categories.put(rest);
      } else {
        await db.categories.delete(cat.id);
        await db.budgets.where('categoryId').equals(cat.id).delete();
        removed++;
      }
    }
    const demoBudgets = await db.budgets.filter((b) => b.isDemo === true).primaryKeys();
    await db.budgets.bulkDelete(demoBudgets);
    const demoRecurring = await db.recurrings.filter((r) => r.isDemo === true).primaryKeys();
    await db.recurrings.bulkDelete(demoRecurring);
    return { transactions: txIds.length, categories: removed };
  });
}
