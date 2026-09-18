import type { Currency } from '../domain/types';
import { round2 } from '../domain/money';
import { newId } from '../lib/id';
import { db } from './db';
import { MAX_AMOUNT, ValidationError } from './transactions';

/** Tope mensual para una categoría de gasto (uno por categoría). */
export async function setBudget(categoryId: string, amount: number, currency: Currency): Promise<void> {
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) throw new ValidationError('Ingresá un tope mayor que cero');
  if (currency !== 'UYU' && currency !== 'USD') throw new ValidationError('Moneda inválida');
  await db.transaction('rw', db.budgets, db.categories, async () => {
    const cat = await db.categories.get(categoryId);
    if (!cat || cat.kind !== 'expense') throw new ValidationError('La categoría no existe');
    const existing = await db.budgets.where('categoryId').equals(categoryId).first();
    await db.budgets.put({ id: existing?.id ?? newId(), categoryId, amount: round2(amount), currency });
  });
}

export async function removeBudget(categoryId: string): Promise<void> {
  await db.budgets.where('categoryId').equals(categoryId).delete();
}
