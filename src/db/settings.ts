import type { Settings } from '../domain/types';
import { SCHEMA_VERSION, db } from './db';

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  displayCurrency: 'UYU',
  defaultExpenseCurrency: 'UYU',
  defaultIncomeCurrency: 'USD',
  autoLockMinutes: 5,
  schemaVersion: SCHEMA_VERSION,
};

export async function getSettings(): Promise<Settings> {
  const stored = await db.settings.get('app');
  return { ...DEFAULT_SETTINGS, ...stored, id: 'app' };
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const current = await getSettings();
    await db.settings.put({ ...current, ...patch, id: 'app' });
  });
}
