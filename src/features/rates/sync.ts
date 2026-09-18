import { create } from 'zustand';
import { getMeta, setMeta } from '../../db/meta';
import { upsertBrouRates } from '../../db/rates';
import type { Rate } from '../../domain/types';
import { isISODate } from '../../lib/dates';

/** Rango de cordura para UYU por USD: descarta datos corruptos. */
const MIN_RATE = 10;
const MAX_RATE = 500;

interface RawRate {
  buy?: unknown;
  sell?: unknown;
  fetchedAt?: unknown;
  date?: unknown;
}

export function toValidRate(date: unknown, raw: RawRate): Rate | null {
  if (!isISODate(date)) return null;
  const { buy, sell } = raw;
  if (typeof buy !== 'number' || typeof sell !== 'number') return null;
  if (!(buy >= MIN_RATE && buy <= MAX_RATE && sell >= MIN_RATE && sell <= MAX_RATE)) return null;
  const fetchedAt = typeof raw.fetchedAt === 'string' && raw.fetchedAt.length <= 40 ? raw.fetchedAt : '';
  return { date, buy, sell, source: 'BROU', fetchedAt };
}

export function parseRatesFiles(history: unknown, latest: unknown): Rate[] {
  const out = new Map<string, Rate>();
  if (history && typeof history === 'object' && !Array.isArray(history)) {
    for (const [date, raw] of Object.entries(history as Record<string, unknown>)) {
      if (!raw || typeof raw !== 'object') continue;
      const r = toValidRate(date, raw as RawRate);
      if (r) out.set(r.date, r);
    }
  }
  if (latest && typeof latest === 'object') {
    const raw = latest as RawRate;
    const r = toValidRate(raw.date, raw);
    if (r) out.set(r.date, r);
  }
  return [...out.values()];
}

async function fetchJSON(url: string, signal: AbortSignal): Promise<unknown> {
  const res = await fetch(url, { cache: 'no-store', signal, credentials: 'omit' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export type SyncResult = { ok: true; count: number } | { ok: false; reason: 'offline' | 'invalid' };

export interface SyncStatus {
  syncing: boolean;
  lastAttemptAt?: string;
  lastSuccessAt?: string;
  lastError?: 'offline' | 'invalid';
}

const META_KEY = 'ratesSync';

/** Estado de la última actualización (se guarda para mostrarlo aunque abras la app sin red). */
export const useRatesSync = create<SyncStatus>()(() => ({ syncing: false }));

export async function loadSyncStatus(): Promise<void> {
  const saved = await getMeta<Omit<SyncStatus, 'syncing'>>(META_KEY);
  if (saved) useRatesSync.setState({ ...saved, syncing: false });
}

let inFlight: Promise<SyncResult> | null = null;

/**
 * Lee las cotizaciones publicadas junto a la app (siempre de la red, sin caché)
 * y las guarda en IndexedDB. Sin red, la app sigue con la última guardada.
 */
export function syncRates(): Promise<SyncResult> {
  inFlight ??= doSync().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function doSync(): Promise<SyncResult> {
  const base = import.meta.env.BASE_URL;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  const attemptAt = new Date().toISOString();
  useRatesSync.setState({ syncing: true });
  let result: SyncResult;
  try {
    const [history, latest] = await Promise.all([
      fetchJSON(`${base}rates/history.json`, ctrl.signal).catch(() => null),
      fetchJSON(`${base}rates/latest.json`, ctrl.signal),
    ]);
    const rates = parseRatesFiles(history, latest);
    if (rates.length === 0) {
      result = { ok: false, reason: 'invalid' };
    } else {
      await upsertBrouRates(rates);
      result = { ok: true, count: rates.length };
    }
  } catch {
    result = { ok: false, reason: 'offline' };
  } finally {
    clearTimeout(timer);
  }
  const prev = useRatesSync.getState();
  const status: Omit<SyncStatus, 'syncing'> = result.ok
    ? { lastAttemptAt: attemptAt, lastSuccessAt: attemptAt }
    : { lastAttemptAt: attemptAt, lastSuccessAt: prev.lastSuccessAt, lastError: result.reason };
  useRatesSync.setState({ ...status, syncing: false }, true);
  await setMeta(META_KEY, status).catch(() => undefined);
  return result;
}
