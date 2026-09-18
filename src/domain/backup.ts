import type { EncryptedEnvelope } from '../lib/crypto';
import { isISODate } from '../lib/dates';
import { normalizeName } from './categories';
import {
  GROUPS_BY_KIND,
  type Budget,
  type Category,
  type Currency,
  type Group,
  type Kind,
  type Rate,
  type Recurring,
  type Settings,
  type Transaction,
} from './types';

export const BACKUP_FORMAT = 'finanzas-backup';
/** Versión del formato del archivo de respaldo. */
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 30 * 1024 * 1024;
const MAX_ITEMS = 200_000;

/** Preferencias que viajan en el respaldo. PIN y Face ID NO: son de cada dispositivo. */
export type PortableSettings = Pick<
  Settings,
  'displayCurrency' | 'defaultExpenseCurrency' | 'defaultIncomeCurrency' | 'autoLockMinutes'
>;

export interface BackupPayload {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  recurrings: Recurring[];
  rates: Rate[];
  settings: PortableSettings;
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  schemaVersion: number;
  exportedAt: string;
  encrypted: boolean;
  /** Si encrypted: sobre cifrado; si no: los datos en claro. */
  content: EncryptedEnvelope | BackupPayload;
  counts: { transactions: number; categories: number };
}

export class BackupError extends Error {
  override name = 'BackupError';
}

// ── Validación estricta: se copia solo lo conocido, con tipos y rangos controlados ──

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function str(o: Obj, k: string, max = 200): string {
  const v = o[k];
  if (typeof v !== 'string' || v.length === 0 || v.length > max) throw new BackupError(`Campo inválido: ${k}`);
  return v;
}
function optStr(o: Obj, k: string, max = 200): string | undefined {
  const v = o[k];
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v !== 'string' || v.length > max) throw new BackupError(`Campo inválido: ${k}`);
  return v;
}
function num(o: Obj, k: string, min: number, max: number): number {
  const v = o[k];
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw new BackupError(`Campo inválido: ${k}`);
  return v;
}
function bool(o: Obj, k: string): boolean {
  if (typeof o[k] !== 'boolean') throw new BackupError(`Campo inválido: ${k}`);
  return o[k] as boolean;
}
function optTrue(o: Obj, k: string): true | undefined {
  return o[k] === true ? true : undefined;
}
function oneOf<T extends string>(o: Obj, k: string, values: readonly T[]): T {
  const v = o[k];
  if (typeof v !== 'string' || !values.includes(v as T)) throw new BackupError(`Campo inválido: ${k}`);
  return v as T;
}
function isoDate(o: Obj, k: string): string {
  const v = o[k];
  if (!isISODate(v)) throw new BackupError(`Fecha inválida: ${k}`);
  return v;
}

const CURRENCIES: readonly Currency[] = ['UYU', 'USD'];
const KINDS: readonly Kind[] = ['expense', 'income'];
const HEX = /^#[0-9a-fA-F]{6}$/;
const MAX_MONEY = 1e13;

function clean<T extends object>(o: T): T {
  for (const k of Object.keys(o) as (keyof T)[]) if (o[k] === undefined) delete o[k];
  return o;
}

export function validateTransaction(raw: unknown): Transaction {
  if (!isObj(raw)) throw new BackupError('Movimiento inválido');
  return clean<Transaction>({
    id: str(raw, 'id', 64),
    kind: oneOf(raw, 'kind', KINDS),
    amount: num(raw, 'amount', 0.01, MAX_MONEY),
    currency: oneOf(raw, 'currency', CURRENCIES),
    rateAtDate: num(raw, 'rateAtDate', 0.0001, 100_000),
    rateApprox: optTrue(raw, 'rateApprox'),
    rateCustom: optTrue(raw, 'rateCustom'),
    amountUYU: num(raw, 'amountUYU', 0, MAX_MONEY * 100_000),
    amountUSD: num(raw, 'amountUSD', 0, MAX_MONEY),
    categoryId: str(raw, 'categoryId', 64),
    date: isoDate(raw, 'date'),
    note: optStr(raw, 'note', 200),
    recurringId: optStr(raw, 'recurringId', 64),
    status: oneOf(raw, 'status', ['confirmed', 'pending'] as const),
    createdAt: str(raw, 'createdAt', 40),
    updatedAt: str(raw, 'updatedAt', 40),
    isDemo: optTrue(raw, 'isDemo'),
  });
}

export function validateCategory(raw: unknown): Category {
  if (!isObj(raw)) throw new BackupError('Categoría inválida');
  const kind = oneOf(raw, 'kind', KINDS);
  const group = oneOf(raw, 'group', GROUPS_BY_KIND[kind] as readonly Group[]);
  const name = str(raw, 'name', 40).trim();
  const color = str(raw, 'color', 7);
  if (!HEX.test(color)) throw new BackupError('Color inválido');
  return clean<Category>({
    id: str(raw, 'id', 64),
    kind,
    group,
    name,
    // Se recalcula: nunca se confía en el valor del archivo.
    normalizedName: normalizeName(name),
    color,
    usageCount: Math.floor(num(raw, 'usageCount', 0, 10_000_000)),
    lastUsedAt: optStr(raw, 'lastUsedAt', 40),
    archived: bool(raw, 'archived'),
    createdAt: str(raw, 'createdAt', 40),
    isDemo: optTrue(raw, 'isDemo'),
  });
}

export function validateBudget(raw: unknown): Budget {
  if (!isObj(raw)) throw new BackupError('Presupuesto inválido');
  return clean<Budget>({
    id: str(raw, 'id', 64),
    categoryId: str(raw, 'categoryId', 64),
    amount: num(raw, 'amount', 0.01, MAX_MONEY),
    currency: oneOf(raw, 'currency', CURRENCIES),
    isDemo: optTrue(raw, 'isDemo'),
  });
}

export function validateRecurring(raw: unknown): Recurring {
  if (!isObj(raw) || !isObj(raw.templateTx)) throw new BackupError('Recurrente inválido');
  const t = raw.templateTx;
  const last = optStr(raw, 'lastGeneratedMonth', 7);
  if (last !== undefined && !/^\d{4}-\d{2}$/.test(last)) throw new BackupError('Mes inválido');
  return clean<Recurring>({
    id: str(raw, 'id', 64),
    templateTx: clean({
      kind: oneOf(t, 'kind', KINDS),
      amount: num(t, 'amount', 0.01, MAX_MONEY),
      currency: oneOf(t, 'currency', CURRENCIES),
      categoryId: str(t, 'categoryId', 64),
      note: optStr(t, 'note', 200),
    }),
    dayOfMonth: Math.floor(num(raw, 'dayOfMonth', 1, 31)),
    active: bool(raw, 'active'),
    lastGeneratedMonth: last,
    isDemo: optTrue(raw, 'isDemo'),
  });
}

export function validateRate(raw: unknown): Rate {
  if (!isObj(raw)) throw new BackupError('Cotización inválida');
  return {
    date: isoDate(raw, 'date'),
    buy: num(raw, 'buy', 0.0001, 100_000),
    sell: num(raw, 'sell', 0.0001, 100_000),
    source: oneOf(raw, 'source', ['BROU', 'manual'] as const),
    fetchedAt: typeof raw.fetchedAt === 'string' ? raw.fetchedAt.slice(0, 40) : '',
  };
}

function validateSettings(raw: unknown): PortableSettings {
  const o = isObj(raw) ? raw : {};
  const cur = (k: string, d: Currency): Currency => (CURRENCIES.includes(o[k] as Currency) ? (o[k] as Currency) : d);
  const lock = typeof o.autoLockMinutes === 'number' && o.autoLockMinutes >= 0 && o.autoLockMinutes <= 240 ? o.autoLockMinutes : 5;
  return {
    displayCurrency: cur('displayCurrency', 'UYU'),
    defaultExpenseCurrency: cur('defaultExpenseCurrency', 'UYU'),
    defaultIncomeCurrency: cur('defaultIncomeCurrency', 'USD'),
    autoLockMinutes: lock,
  };
}

function list<T>(raw: unknown, name: string, fn: (x: unknown) => T): T[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw new BackupError(`Lista inválida: ${name}`);
  if (raw.length > MAX_ITEMS) throw new BackupError(`Demasiados elementos en ${name}`);
  return raw.map((x, i) => {
    try {
      return fn(x);
    } catch (e) {
      throw new BackupError(`${name} #${i + 1}: ${e instanceof Error ? e.message : 'inválido'}`);
    }
  });
}

/** Valida los datos del respaldo y controla que todo lo que referencia una categoría la tenga. */
export function validatePayload(raw: unknown): BackupPayload {
  if (!isObj(raw)) throw new BackupError('El respaldo no tiene datos');
  const payload: BackupPayload = {
    transactions: list(raw.transactions, 'movimientos', validateTransaction),
    categories: list(raw.categories, 'categorías', validateCategory),
    budgets: list(raw.budgets, 'presupuestos', validateBudget),
    recurrings: list(raw.recurrings, 'recurrentes', validateRecurring),
    rates: list(raw.rates, 'cotizaciones', validateRate),
    settings: validateSettings(raw.settings),
  };
  const catIds = new Set(payload.categories.map((c) => c.id));
  const orphan = payload.transactions.filter((t) => !catIds.has(t.categoryId)).length;
  if (orphan > 0) throw new BackupError(`${orphan} movimientos apuntan a categorías que no están en el respaldo`);
  payload.budgets = payload.budgets.filter((b) => catIds.has(b.categoryId));
  payload.recurrings = payload.recurrings.filter((r) => catIds.has(r.templateTx.categoryId));
  return payload;
}

export function buildBackupFile(
  content: EncryptedEnvelope | BackupPayload,
  encrypted: boolean,
  schemaVersion: number,
  counts: BackupFile['counts'],
  now = new Date(),
): BackupFile {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, schemaVersion, exportedAt: now.toISOString(), encrypted, content, counts };
}

/** Lee el archivo (sin descifrar): controla formato y versiones. */
export function parseBackupFile(text: string, currentSchemaVersion: number): BackupFile {
  if (text.length > MAX_BACKUP_BYTES) throw new BackupError('El archivo es demasiado grande');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('El archivo no es un respaldo válido (no es JSON)');
  }
  if (!isObj(raw) || raw.format !== BACKUP_FORMAT) throw new BackupError('El archivo no es un respaldo de Finanzas');
  if (typeof raw.version !== 'number' || raw.version > BACKUP_VERSION) {
    throw new BackupError('El respaldo es de una versión más nueva de la app. Actualizá la app y probá de nuevo.');
  }
  if (typeof raw.schemaVersion !== 'number' || raw.schemaVersion > currentSchemaVersion) {
    throw new BackupError('El respaldo es de una versión más nueva de la app. Actualizá la app y probá de nuevo.');
  }
  if (typeof raw.encrypted !== 'boolean' || !isObj(raw.content)) throw new BackupError('El respaldo está incompleto');
  const counts = isObj(raw.counts) ? raw.counts : {};
  return {
    format: BACKUP_FORMAT,
    version: raw.version,
    schemaVersion: raw.schemaVersion,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
    encrypted: raw.encrypted,
    content: raw.content as unknown as EncryptedEnvelope | BackupPayload,
    counts: {
      transactions: typeof counts.transactions === 'number' ? counts.transactions : 0,
      categories: typeof counts.categories === 'number' ? counts.categories : 0,
    },
  };
}

export interface MergeStats {
  added: number;
  updated: number;
  categoriesReused: number;
}

/**
 * Combina el respaldo con lo que ya hay:
 * - categorías con el mismo nombre (y tipo) se unifican, sin duplicar;
 * - un mismo movimiento se queda con la versión editada más recientemente;
 * - presupuestos, recurrentes y cotizaciones que ya existen se conservan.
 */
export function mergePayload(current: BackupPayload, incoming: BackupPayload): { result: BackupPayload; stats: MergeStats } {
  const stats: MergeStats = { added: 0, updated: 0, categoriesReused: 0 };
  const categories = [...current.categories];
  const byId = new Map(categories.map((c) => [c.id, c]));
  const byName = new Map(categories.map((c) => [`${c.kind}:${c.normalizedName}`, c]));
  const remap = new Map<string, string>();

  for (const c of incoming.categories) {
    if (byId.has(c.id)) {
      remap.set(c.id, c.id);
      continue;
    }
    const same = byName.get(`${c.kind}:${c.normalizedName}`);
    if (same) {
      remap.set(c.id, same.id);
      stats.categoriesReused++;
      continue;
    }
    categories.push(c);
    byId.set(c.id, c);
    byName.set(`${c.kind}:${c.normalizedName}`, c);
    remap.set(c.id, c.id);
  }
  const mapCat = (id: string) => remap.get(id) ?? id;

  const txs = new Map(current.transactions.map((t) => [t.id, t]));
  for (const t of incoming.transactions) {
    const next = { ...t, categoryId: mapCat(t.categoryId) };
    const prev = txs.get(t.id);
    if (!prev) {
      txs.set(t.id, next);
      stats.added++;
    } else if (next.updatedAt > prev.updatedAt) {
      txs.set(t.id, next);
      stats.updated++;
    }
  }

  const budgetCats = new Set(current.budgets.map((b) => b.categoryId));
  const budgetIds = new Set(current.budgets.map((b) => b.id));
  const budgets = [...current.budgets];
  for (const b of incoming.budgets) {
    const categoryId = mapCat(b.categoryId);
    if (budgetCats.has(categoryId) || budgetIds.has(b.id)) continue;
    budgets.push({ ...b, categoryId });
    budgetCats.add(categoryId);
  }

  const recIds = new Set(current.recurrings.map((r) => r.id));
  const recurrings = [...current.recurrings];
  for (const r of incoming.recurrings) {
    if (recIds.has(r.id)) continue;
    recurrings.push({ ...r, templateTx: { ...r.templateTx, categoryId: mapCat(r.templateTx.categoryId) } });
  }

  const rateKey = (r: Rate) => `${r.date}:${r.source}`;
  const rates = new Map(current.rates.map((r) => [rateKey(r), r]));
  for (const r of incoming.rates) if (!rates.has(rateKey(r))) rates.set(rateKey(r), r);

  return {
    result: {
      transactions: [...txs.values()],
      categories,
      budgets,
      recurrings,
      rates: [...rates.values()],
      settings: current.settings,
    },
    stats,
  };
}
