import {
  BackupError,
  buildBackupFile,
  mergePayload,
  parseBackupFile,
  validatePayload,
  type BackupFile,
  type BackupPayload,
  type MergeStats,
} from '../domain/backup';
import { transactionsToCsv } from '../domain/csv';
import { decryptText, encryptText, PBKDF2_ITERATIONS, type EncryptedEnvelope } from '../lib/crypto';
import { todayISO } from '../lib/dates';
import { SCHEMA_VERSION, db } from './db';
import { getSettings, updateSettings } from './settings';

export const MIN_PASSWORD_LENGTH = 8;

export class PasswordRequiredError extends Error {
  override name = 'PasswordRequiredError';
}

/** Todos tus datos, sin los de ejemplo ni la configuración de seguridad de este dispositivo. */
export async function collectPayload(includeDemo = false): Promise<BackupPayload> {
  const [transactions, categories, budgets, recurrings, rates, settings] = await Promise.all([
    db.transactions.toArray(),
    db.categories.toArray(),
    db.budgets.toArray(),
    db.recurrings.toArray(),
    db.rates.toArray(),
    getSettings(),
  ]);
  const keep = <T extends { isDemo?: boolean }>(x: T) => includeDemo || !x.isDemo;
  const txs = transactions.filter(keep);
  const recs = recurrings.filter(keep);
  const buds = budgets.filter(keep);
  // Una categoría de ejemplo que usaste en datos reales se respalda como tuya.
  const needed = new Set([
    ...txs.map((t) => t.categoryId),
    ...recs.map((r) => r.templateTx.categoryId),
    ...buds.map((b) => b.categoryId),
  ]);
  const cats = categories
    .filter((c) => keep(c) || needed.has(c.id))
    .map((c) => {
      if (includeDemo || !c.isDemo) return c;
      const { isDemo: _drop, ...rest } = c;
      return rest;
    });
  const catIds = new Set(cats.map((c) => c.id));
  return {
    transactions: txs.filter((t) => catIds.has(t.categoryId)),
    categories: cats,
    budgets: buds.filter((b) => catIds.has(b.categoryId)),
    recurrings: recs.filter((r) => catIds.has(r.templateTx.categoryId)),
    rates,
    settings: {
      displayCurrency: settings.displayCurrency,
      defaultExpenseCurrency: settings.defaultExpenseCurrency,
      defaultIncomeCurrency: settings.defaultIncomeCurrency,
      autoLockMinutes: settings.autoLockMinutes,
    },
  };
}

export interface PreparedFile {
  filename: string;
  text: string;
  mime: string;
}

/** Respaldo completo cifrado con la contraseña (AES-256-GCM). */
export async function prepareBackup(password: string, iterations = PBKDF2_ITERATIONS): Promise<PreparedFile & { counts: BackupFile['counts'] }> {
  if (password.length < MIN_PASSWORD_LENGTH) throw new BackupError(`La contraseña tiene que tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
  const payload = await collectPayload();
  const counts = { transactions: payload.transactions.length, categories: payload.categories.length };
  const envelope = await encryptText(JSON.stringify(payload), password, iterations);
  const file = buildBackupFile(envelope, true, SCHEMA_VERSION, counts);
  return { filename: `finanzas-respaldo-${todayISO()}.json`, text: JSON.stringify(file), mime: 'application/json', counts };
}

export async function markBackupDone(now = new Date()): Promise<void> {
  await updateSettings({ lastBackupAt: now.toISOString() });
}

/** Movimientos en CSV para Excel o Sheets (sin cifrar). */
export async function prepareCsv(): Promise<PreparedFile> {
  const [txs, categories] = await Promise.all([db.transactions.toArray(), db.categories.toArray()]);
  const real = txs.filter((t) => !t.isDemo);
  const text = transactionsToCsv(real, new Map(categories.map((c) => [c.id, c])));
  return { filename: `finanzas-movimientos-${todayISO()}.csv`, text, mime: 'text/csv' };
}

export interface ReadBackup {
  file: BackupFile;
  payload: BackupPayload;
}

/** Lee y valida un respaldo. Si está cifrado, hace falta la contraseña. */
export async function readBackup(text: string, password?: string): Promise<ReadBackup> {
  const file = parseBackupFile(text, SCHEMA_VERSION);
  let raw: unknown = file.content;
  if (file.encrypted) {
    if (!password) throw new PasswordRequiredError('Este respaldo está protegido con contraseña');
    const plain = await decryptText(file.content as EncryptedEnvelope, password);
    try {
      raw = JSON.parse(plain);
    } catch {
      throw new BackupError('El respaldo está dañado');
    }
  }
  return { file, payload: validatePayload(raw) };
}

export type ImportMode = 'replace' | 'merge';

async function writePayload(p: BackupPayload): Promise<void> {
  await db.transactions.clear();
  await db.categories.clear();
  await db.budgets.clear();
  await db.recurrings.clear();
  await db.categories.bulkAdd(p.categories);
  await db.transactions.bulkAdd(p.transactions);
  await db.budgets.bulkAdd(p.budgets);
  await db.recurrings.bulkAdd(p.recurrings);
}

/**
 * Importa un respaldo ya validado.
 * - replace: tus datos pasan a ser exactamente los del respaldo (PIN y Face ID se mantienen).
 * - merge: se suman sin duplicar (ver mergePayload).
 */
export async function importBackup(payload: BackupPayload, mode: ImportMode): Promise<MergeStats> {
  return db.transaction('rw', [db.transactions, db.categories, db.budgets, db.recurrings, db.rates, db.settings], async () => {
    if (mode === 'replace') {
      await writePayload(payload);
      // Las cotizaciones manuales pasan a ser las del respaldo; las del BROU se suman.
      await db.rates.filter((r) => r.source === 'manual').delete();
      await db.rates.bulkPut(payload.rates);
      const current = await getSettings();
      await db.settings.put({ ...current, ...payload.settings, id: 'app' });
      return { added: payload.transactions.length, updated: 0, categoriesReused: 0 };
    }
    const current = await collectPayload(true);
    const { result, stats } = mergePayload(current, payload);
    await writePayload(result);
    await db.rates.bulkPut(result.rates);
    return stats;
  });
}

/** Borra TODO: movimientos, categorías, ajustes, PIN y cotizaciones guardadas. */
export async function wipeAllData(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });
}
