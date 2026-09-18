import { pickRate } from '../domain/fx';
import { convert, round2 } from '../domain/money';
import { buildPending, confirmDate, monthsToGenerate, occurrenceDate } from '../domain/recurring';
import type { Currency, Recurring, Transaction } from '../domain/types';
import { addMonthsISO, monthKey } from '../lib/dates';
import { newId } from '../lib/id';
import { db } from './db';
import { MAX_AMOUNT, MAX_NOTE_LENGTH, ValidationError } from './transactions';

function validDay(day: number): number {
  if (!Number.isInteger(day) || day < 1 || day > 31) throw new ValidationError('El día del mes tiene que estar entre 1 y 31');
  return day;
}

/**
 * Marca un movimiento como recurrente mensual. Ese movimiento cuenta como la cuota
 * de su mes; los siguientes se generan como pendientes de confirmar.
 */
export async function createRecurringFromTx(txId: string, dayOfMonth: number, today: string): Promise<Recurring> {
  return db.transaction('rw', db.transactions, db.recurrings, async () => {
    const tx = await db.transactions.get(txId);
    if (!tx) throw new ValidationError('El movimiento ya no existe');
    if (tx.recurringId) {
      const existing = await db.recurrings.get(tx.recurringId);
      if (existing) return existing;
    }
    const txMonth = monthKey(tx.date);
    const current = monthKey(today);
    const rec: Recurring = {
      id: newId(),
      templateTx: { kind: tx.kind, amount: tx.amount, currency: tx.currency, categoryId: tx.categoryId },
      dayOfMonth: validDay(dayOfMonth),
      active: true,
      lastGeneratedMonth: txMonth > current ? txMonth : current,
    };
    if (tx.note) rec.templateTx.note = tx.note;
    if (tx.isDemo) rec.isDemo = true;
    await db.recurrings.add(rec);
    await db.transactions.update(tx.id, { recurringId: rec.id });
    return rec;
  });
}

/**
 * Genera los pendientes del mes (y se pone al día si la app no se abrió).
 * Los pendientes no suman en los totales hasta que se confirman.
 */
export async function generateDueRecurring(today: string, now: Date = new Date()): Promise<number> {
  const current = monthKey(today);
  return db.transaction('rw', db.recurrings, db.transactions, db.rates, async () => {
    const [recs, rates] = await Promise.all([db.recurrings.toArray(), db.rates.toArray()]);
    let created = 0;
    for (const rec of recs) {
      if (!rec.active) continue;
      const months = monthsToGenerate(rec.lastGeneratedMonth, current);
      if (months.length === 0) continue;
      let generatedAll = true;
      for (const month of months) {
        const exists = await db.transactions
          .where('recurringId')
          .equals(rec.id)
          .filter((t) => t.date.startsWith(month))
          .count();
        if (exists) continue;
        const tx = buildPending(rec, month, rates, now.toISOString(), newId);
        if (!tx) {
          generatedAll = false; // sin cotización todavía: se reintenta después
          break;
        }
        await db.transactions.add(tx);
        created++;
      }
      if (generatedAll) await db.recurrings.update(rec.id, { lastGeneratedMonth: current });
    }
    return created;
  });
}

/** Confirma un pendiente: pasa a contar en los totales, con la cotización de su fecha. */
export async function confirmPending(id: string, today: string, now: Date = new Date()): Promise<Transaction> {
  return db.transaction('rw', db.transactions, db.rates, db.categories, async () => {
    const tx = await db.transactions.get(id);
    if (!tx || tx.status !== 'pending') throw new ValidationError('El movimiento ya no está pendiente');
    const date = confirmDate(tx.date, today);
    let rate = tx.rateAtDate;
    let approx = tx.rateApprox ?? false;
    if (!tx.rateCustom) {
      const found = pickRate(await db.rates.toArray(), date);
      if (found) {
        rate = found.rate;
        approx = found.approximate;
      }
    }
    const next: Transaction = {
      ...tx,
      date,
      status: 'confirmed',
      rateAtDate: rate,
      ...convert(tx.amount, tx.currency, rate),
      updatedAt: now.toISOString(),
    };
    if (approx) next.rateApprox = true;
    else delete next.rateApprox;
    await db.transactions.put(next);
    const cat = await db.categories.get(tx.categoryId);
    if (cat) await db.categories.update(cat.id, { usageCount: cat.usageCount + 1, lastUsedAt: now.toISOString() });
    return next;
  });
}

/** Saltear: se borra el pendiente de ese mes (no se vuelve a generar). Devuelve el borrado para deshacer. */
export async function skipPending(id: string): Promise<Transaction | undefined> {
  return db.transaction('rw', db.transactions, async () => {
    const tx = await db.transactions.get(id);
    if (!tx || tx.status !== 'pending') return undefined;
    await db.transactions.delete(id);
    return tx;
  });
}

export interface RecurringPatch {
  amount?: number;
  currency?: Currency;
  dayOfMonth?: number;
  note?: string;
}

/** Cambia la plantilla. Los pendientes que todavía no confirmaste se actualizan también. */
export async function updateRecurring(id: string, patch: RecurringPatch, now: Date = new Date()): Promise<void> {
  if (patch.amount !== undefined && !(patch.amount > 0 && patch.amount <= MAX_AMOUNT)) {
    throw new ValidationError('Ingresá un monto mayor que cero');
  }
  if (patch.dayOfMonth !== undefined) validDay(patch.dayOfMonth);
  await db.transaction('rw', db.recurrings, db.transactions, db.rates, async () => {
    const rec = await db.recurrings.get(id);
    if (!rec) throw new ValidationError('El recurrente ya no existe');
    const note = patch.note === undefined ? rec.templateTx.note : patch.note.trim().slice(0, MAX_NOTE_LENGTH) || undefined;
    const templateTx = {
      ...rec.templateTx,
      amount: patch.amount !== undefined ? round2(patch.amount) : rec.templateTx.amount,
      currency: patch.currency ?? rec.templateTx.currency,
    };
    if (note) templateTx.note = note;
    else delete templateTx.note;
    const updated: Recurring = { ...rec, templateTx, dayOfMonth: patch.dayOfMonth ?? rec.dayOfMonth };
    await db.recurrings.put(updated);

    const rates = await db.rates.toArray();
    const pending = await db.transactions
      .where('recurringId')
      .equals(id)
      .filter((t) => t.status === 'pending')
      .toArray();
    for (const tx of pending) {
      const date = occurrenceDate(tx.date.slice(0, 7), updated.dayOfMonth);
      const found = pickRate(rates, date);
      const rate = found?.rate ?? tx.rateAtDate;
      const next: Transaction = {
        ...tx,
        amount: templateTx.amount,
        currency: templateTx.currency,
        date,
        rateAtDate: rate,
        ...convert(templateTx.amount, templateTx.currency, rate),
        updatedAt: now.toISOString(),
      };
      if (note) next.note = note;
      else delete next.note;
      await db.transactions.put(next);
    }
  });
}

/** Pausar o reanudar. Al reanudar se genera el pendiente del mes actual si todavía no existe. */
export async function setRecurringActive(id: string, active: boolean, today: string): Promise<void> {
  await db.transaction('rw', db.recurrings, async () => {
    const rec = await db.recurrings.get(id);
    if (!rec) return;
    const patch: Partial<Recurring> = { active };
    // Al reanudar no se generan los meses que estuvo en pausa.
    if (active && !rec.active) patch.lastGeneratedMonth = addMonthsISO(`${monthKey(today)}-01`, -1).slice(0, 7);
    await db.recurrings.update(id, patch);
  });
  if (active) await generateDueRecurring(today);
}

/** Borra el recurrente y sus pendientes. Los movimientos ya confirmados se conservan. */
export async function deleteRecurring(id: string): Promise<void> {
  await db.transaction('rw', db.recurrings, db.transactions, async () => {
    const linked = await db.transactions.where('recurringId').equals(id).toArray();
    for (const tx of linked) {
      if (tx.status === 'pending') await db.transactions.delete(tx.id);
      else {
        const { recurringId: _drop, ...rest } = tx;
        await db.transactions.put(rest);
      }
    }
    await db.recurrings.delete(id);
  });
}
