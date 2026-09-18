import { cleanDisplayName, nextCategoryColor, normalizeName } from '../domain/categories';
import { pickRate, recalcTransaction } from '../domain/fx';
import { convert, round2 } from '../domain/money';
import type { DateRange } from '../domain/periods';
import {
  DEFAULT_INCOME_CATEGORY,
  GROUPS_BY_KIND,
  kindOfGroup,
  type Category,
  type Currency,
  type Group,
  type IncomeGroup,
  type Kind,
  type Transaction,
  type TxStatus,
} from '../domain/types';
import { isISODate } from '../lib/dates';
import { newId } from '../lib/id';
import { db } from './db';

export const MAX_AMOUNT = 999_999_999_999;
export const MAX_NOTE_LENGTH = 200;
export const MAX_CATEGORY_NAME_LENGTH = 40;

export class ValidationError extends Error {
  override name = 'ValidationError';
}

/** No hay ninguna cotización guardada: hay que escribirla a mano. */
export class NoRateError extends Error {
  override name = 'NoRateError';
  constructor() {
    super('No hay cotización disponible para esa fecha');
  }
}

export interface TransactionInput {
  /** Si viene, se edita ese movimiento. */
  id?: string;
  kind: Kind;
  /** Grupo elegido en la carga (solo se usa si hay que crear la categoría). */
  group: Group;
  amount: number;
  currency: Currency;
  date: string;
  note?: string;
  /** Categoría existente elegida de las sugerencias. */
  categoryId?: string;
  /** Nombre escrito: se busca (sin mayúsculas/tildes/espacios) y, si no existe, se crea. */
  categoryName?: string;
  /** Cotización fijada a mano para este movimiento (no se recalcula sola). */
  rateOverride?: number;
  /** Al editar: volver a usar la cotización del histórico para la fecha. */
  resetRate?: boolean;
  status?: TxStatus;
  recurringId?: string;
  isDemo?: boolean;
}

export interface SaveResult {
  tx: Transaction;
  category: Category;
  createdCategory: boolean;
}

function validate(input: TransactionInput): void {
  if (input.kind !== 'expense' && input.kind !== 'income') throw new ValidationError('Tipo inválido');
  if (!GROUPS_BY_KIND[input.kind].includes(input.group) || kindOfGroup(input.group) !== input.kind) {
    throw new ValidationError('Grupo inválido');
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0 || input.amount > MAX_AMOUNT) {
    throw new ValidationError('Ingresá un monto mayor que cero');
  }
  if (round2(input.amount) === 0) throw new ValidationError('Ingresá un monto mayor que cero');
  if (input.currency !== 'UYU' && input.currency !== 'USD') throw new ValidationError('Moneda inválida');
  if (!isISODate(input.date)) throw new ValidationError('Fecha inválida');
  if (input.rateOverride !== undefined && !(input.rateOverride > 0 && input.rateOverride < 10_000)) {
    throw new ValidationError('Cotización inválida');
  }
  if ((input.categoryName ?? '').trim().length > MAX_CATEGORY_NAME_LENGTH) {
    throw new ValidationError(`El nombre de la categoría no puede superar ${MAX_CATEGORY_NAME_LENGTH} caracteres`);
  }
}

async function resolveCategory(
  input: TransactionInput,
  nowISO: string,
): Promise<{ category: Category; created: boolean }> {
  if (input.categoryId) {
    const found = await db.categories.get(input.categoryId);
    if (!found || found.kind !== input.kind) throw new ValidationError('La categoría elegida no existe');
    return { category: found, created: false };
  }

  let name = cleanDisplayName(input.categoryName ?? '');
  if (!name && input.kind === 'income') name = DEFAULT_INCOME_CATEGORY[input.group as IncomeGroup];
  if (!name) throw new ValidationError('Elegí o escribí una categoría');

  const normalizedName = normalizeName(name);
  const existing = await db.categories
    .where('[kind+normalizedName]')
    .equals([input.kind, normalizedName])
    .first();
  if (existing) return { category: existing, created: false };

  const sameKind = await db.categories.where('kind').equals(input.kind).toArray();
  const category: Category = {
    id: newId(),
    kind: input.kind,
    group: input.group,
    name,
    normalizedName,
    color: nextCategoryColor(input.kind, sameKind),
    usageCount: 0,
    archived: false,
    createdAt: nowISO,
  };
  if (input.isDemo) category.isDemo = true;
  await db.categories.add(category);
  return { category, created: true };
}

/**
 * Crea o edita un movimiento. Si la categoría no existe, la crea bajo el grupo elegido.
 * La cotización se fija al guardar (`rateAtDate`) y solo cambia si cambia la fecha.
 */
export async function saveTransaction(input: TransactionInput, now: Date = new Date()): Promise<SaveResult> {
  validate(input);
  const nowISO = now.toISOString();

  return db.transaction('rw', [db.transactions, db.categories, db.rates], async () => {
    const existing = input.id ? await db.transactions.get(input.id) : undefined;
    if (input.id && !existing) throw new ValidationError('El movimiento ya no existe');

    const { category, created } = await resolveCategory(input, nowISO);

    let rate: number;
    let approx = false;
    let custom = false;
    if (input.rateOverride !== undefined) {
      rate = input.rateOverride;
      custom = true;
    } else if (existing && existing.date === input.date && !input.resetRate) {
      rate = existing.rateAtDate;
      approx = existing.rateApprox ?? false;
      custom = existing.rateCustom ?? false;
    } else {
      const found = pickRate(await db.rates.toArray(), input.date);
      if (!found) throw new NoRateError();
      rate = found.rate;
      approx = found.approximate;
    }

    const { amountUYU, amountUSD } = convert(input.amount, input.currency, rate);
    const note = input.note?.trim().slice(0, MAX_NOTE_LENGTH);
    const recurringId = input.recurringId ?? existing?.recurringId;

    const tx: Transaction = {
      id: existing?.id ?? newId(),
      kind: input.kind,
      amount: round2(input.amount),
      currency: input.currency,
      rateAtDate: rate,
      amountUYU,
      amountUSD,
      categoryId: category.id,
      date: input.date,
      status: input.status ?? existing?.status ?? 'confirmed',
      createdAt: existing?.createdAt ?? nowISO,
      updatedAt: nowISO,
    };
    if (approx) tx.rateApprox = true;
    if (custom) tx.rateCustom = true;
    if (note) tx.note = note;
    if (recurringId) tx.recurringId = recurringId;
    if (input.isDemo ?? existing?.isDemo) tx.isDemo = true;

    await db.transactions.put(tx);

    const confirmedNow = existing?.status === 'pending' && tx.status === 'confirmed';
    if (!existing || existing.categoryId !== category.id || confirmedNow) {
      const updated: Category = { ...category, usageCount: category.usageCount + 1, lastUsedAt: nowISO, archived: false };
      await db.categories.put(updated);
      return { tx, category: updated, createdCategory: created };
    }
    return { tx, category, createdCategory: created };
  });
}

/** Borra y devuelve el movimiento (para poder deshacer). */
export async function deleteTransaction(id: string): Promise<Transaction | undefined> {
  return db.transaction('rw', db.transactions, async () => {
    const tx = await db.transactions.get(id);
    if (tx) await db.transactions.delete(id);
    return tx;
  });
}

export async function restoreTransaction(tx: Transaction): Promise<void> {
  await db.transactions.put(tx);
}

export async function listTransactionsInRange(range: DateRange): Promise<Transaction[]> {
  return db.transactions.where('date').between(range.from, range.to, true, true).toArray();
}

/** Movimientos (no demo) cuya cotización no coincide con el histórico actual. */
export async function findRecalculable(): Promise<Transaction[]> {
  const [txs, rates] = await Promise.all([db.transactions.toArray(), db.rates.toArray()]);
  const now = new Date().toISOString();
  return txs.filter((t) => !t.isDemo && recalcTransaction(t, rates, now) !== null);
}

/** Recalcula con el histórico actual (todos los que no coinciden, o solo los ids dados). */
export async function recalculateTransactions(ids?: readonly string[]): Promise<number> {
  return db.transaction('rw', db.transactions, db.rates, async () => {
    const rates = await db.rates.toArray();
    const txs = ids ? (await db.transactions.bulkGet([...ids])).filter((t): t is Transaction => Boolean(t)) : await db.transactions.toArray();
    const now = new Date().toISOString();
    const updated = txs.filter((t) => !t.isDemo).map((t) => recalcTransaction(t, rates, now)).filter((t): t is Transaction => t !== null);
    if (updated.length) await db.transactions.bulkPut(updated);
    return updated.length;
  });
}
