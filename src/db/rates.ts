import { pickRate, type RateLookup } from '../domain/fx';
import type { Rate } from '../domain/types';
import { db } from './db';

export async function getAllRates(): Promise<Rate[]> {
  return db.rates.toArray();
}

export async function lookupRate(date: string): Promise<RateLookup | null> {
  return pickRate(await getAllRates(), date);
}

/** Guarda cotizaciones del BROU. Nunca pisa los overrides manuales (la clave incluye la fuente). */
export async function upsertBrouRates(rates: readonly Rate[]): Promise<void> {
  const brou = rates.filter((r) => r.source === 'BROU');
  if (brou.length > 0) await db.rates.bulkPut(brou);
}

export async function setManualRate(date: string, buy: number, sell = buy): Promise<void> {
  await db.rates.put({ date, buy, sell, source: 'manual', fetchedAt: new Date().toISOString() });
}

export async function removeManualRate(date: string): Promise<void> {
  await db.rates.delete([date, 'manual']);
}
