import { cleanDisplayName, normalizeName } from '../domain/categories';
import { GROUPS_BY_KIND, type Category, type Group } from '../domain/types';
import { db } from './db';
import { MAX_CATEGORY_NAME_LENGTH, ValidationError } from './transactions';

const HEX = /^#[0-9a-fA-F]{6}$/;

export interface CategoryUsage {
  transactions: number;
  recurrings: number;
  hasBudget: boolean;
}

export async function categoryUsage(id: string): Promise<CategoryUsage> {
  const [transactions, recurrings, budget] = await Promise.all([
    db.transactions.where('categoryId').equals(id).count(),
    db.recurrings.filter((r) => r.templateTx.categoryId === id).count(),
    db.budgets.where('categoryId').equals(id).first(),
  ]);
  return { transactions, recurrings, hasBudget: Boolean(budget) };
}

/** Renombra (el cambio se ve en todo el historial). No permite dos categorías con el mismo nombre. */
export async function renameCategory(id: string, name: string): Promise<Category> {
  const clean = cleanDisplayName(name);
  if (!clean) throw new ValidationError('Escribí un nombre');
  if (clean.length > MAX_CATEGORY_NAME_LENGTH) throw new ValidationError(`Máximo ${MAX_CATEGORY_NAME_LENGTH} caracteres`);
  return db.transaction('rw', db.categories, async () => {
    const cat = await db.categories.get(id);
    if (!cat) throw new ValidationError('La categoría ya no existe');
    const normalizedName = normalizeName(clean);
    const dup = await db.categories.where('[kind+normalizedName]').equals([cat.kind, normalizedName]).first();
    if (dup && dup.id !== id) throw new ValidationError(`Ya existe «${dup.name}». Si querés unirlas, usá Fusionar.`);
    const next = { ...cat, name: clean, normalizedName };
    await db.categories.put(next);
    return next;
  });
}

export async function updateCategory(id: string, patch: { color?: string; group?: Group }): Promise<void> {
  await db.transaction('rw', db.categories, async () => {
    const cat = await db.categories.get(id);
    if (!cat) throw new ValidationError('La categoría ya no existe');
    if (patch.color !== undefined && !HEX.test(patch.color)) throw new ValidationError('Color inválido');
    if (patch.group !== undefined && !GROUPS_BY_KIND[cat.kind].includes(patch.group)) throw new ValidationError('Grupo inválido');
    await db.categories.put({ ...cat, ...patch });
  });
}

export async function setCategoryArchived(id: string, archived: boolean): Promise<void> {
  await db.categories.update(id, { archived });
}

/**
 * Fusiona `sourceId` dentro de `targetId`: movimientos, recurrentes y presupuesto pasan
 * a la categoría destino y la de origen desaparece.
 */
export async function mergeCategories(sourceId: string, targetId: string): Promise<number> {
  if (sourceId === targetId) throw new ValidationError('Elegí otra categoría');
  return db.transaction('rw', [db.categories, db.transactions, db.budgets, db.recurrings], async () => {
    const [source, target] = await Promise.all([db.categories.get(sourceId), db.categories.get(targetId)]);
    if (!source || !target) throw new ValidationError('La categoría ya no existe');
    if (source.kind !== target.kind) throw new ValidationError('Solo se pueden fusionar categorías del mismo tipo');

    const moved = await db.transactions.where('categoryId').equals(sourceId).modify({ categoryId: targetId });
    await db.recurrings
      .filter((r) => r.templateTx.categoryId === sourceId)
      .modify((r) => {
        r.templateTx.categoryId = targetId;
      });
    const [sourceBudget, targetBudget] = await Promise.all([
      db.budgets.where('categoryId').equals(sourceId).first(),
      db.budgets.where('categoryId').equals(targetId).first(),
    ]);
    if (sourceBudget) {
      if (targetBudget) await db.budgets.delete(sourceBudget.id);
      else await db.budgets.update(sourceBudget.id, { categoryId: targetId });
    }
    const lastUsedAt = [source.lastUsedAt, target.lastUsedAt].filter(Boolean).sort().at(-1);
    await db.categories.put({
      ...target,
      usageCount: target.usageCount + source.usageCount,
      ...(lastUsedAt ? { lastUsedAt } : {}),
      archived: false,
    });
    await db.categories.delete(sourceId);
    return moved;
  });
}

/** Solo se puede borrar si no tiene movimientos ni recurrentes (su presupuesto se borra con ella). */
export async function deleteCategory(id: string): Promise<void> {
  await db.transaction('rw', [db.categories, db.transactions, db.budgets, db.recurrings], async () => {
    const usage = await categoryUsage(id);
    if (usage.transactions > 0 || usage.recurrings > 0) {
      throw new ValidationError('Tiene movimientos: archivala o fusionala con otra');
    }
    await db.budgets.where('categoryId').equals(id).delete();
    await db.categories.delete(id);
  });
}
