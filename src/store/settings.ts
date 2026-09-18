import { create } from 'zustand';
import { DEFAULT_SETTINGS } from '../db/settings';
import type { Currency, Kind, Settings } from '../domain/types';
import { useUI } from './ui';

interface SettingsState {
  settings: Settings;
  loaded: boolean;
}

/** Copia sincrónica de los ajustes guardados (la mantiene al día <App/>). */
export const useSettingsStore = create<SettingsState>()(() => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
}));

export function useSettings(): Settings {
  return useSettingsStore((s) => s.settings);
}

export function useDisplayCurrency(): Currency {
  const fromUI = useUI((s) => s.displayCurrency);
  const fallback = useSettingsStore((s) => s.settings.displayCurrency);
  return fromUI ?? fallback;
}

export function defaultCurrencyFor(kind: Kind, settings: Settings): Currency {
  return kind === 'expense' ? settings.defaultExpenseCurrency : settings.defaultIncomeCurrency;
}
