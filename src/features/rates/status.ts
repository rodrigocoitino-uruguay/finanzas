import { rateFreshness } from '../../domain/fx';
import type { Rate } from '../../domain/types';
import { formatDayMonth } from '../../lib/dates';
import { formatRate } from '../../lib/format';
import type { SyncStatus } from './sync';

export type RateState = 'ok' | 'offline' | 'stale' | 'error' | 'none';

export interface RateStatus {
  state: RateState;
  /** Texto del chip del encabezado. */
  chip: string;
  /** Explicación para la hoja de cotización (vacía si todo está bien). */
  detail: string;
  /** La cotización vigente fue cargada a mano. */
  manual: boolean;
}

interface Input {
  latest: Rate | null;
  today: string;
  online: boolean;
  sync: Pick<SyncStatus, 'lastAttemptAt' | 'lastSuccessAt' | 'lastError'>;
}

export function describeRateStatus({ latest, today, online, sync }: Input): RateStatus {
  if (!latest) {
    return {
      manual: false,
      state: 'none',
      chip: 'Sin cotización',
      detail: online
        ? 'Todavía no hay cotización guardada. Tocá "Actualizar" o cargala a mano.'
        : 'Sin conexión y sin cotización guardada. Cargala a mano para poder convertir montos.',
    };
  }
  const day = formatDayMonth(latest.date);
  const value = formatRate(latest.buy);
  const manual = latest.source === 'manual';
  const lastFailed =
    Boolean(sync.lastError) && (!sync.lastSuccessAt || (sync.lastAttemptAt ?? '') > sync.lastSuccessAt);

  if (!online || (lastFailed && sync.lastError === 'offline')) {
    return {
      manual,
      state: 'offline',
      chip: `Cotización del ${day}`,
      detail: `Sin conexión: se usa la última cotización guardada, del ${day}.`,
    };
  }
  if (rateFreshness(latest, today) === 'stale') {
    return {
      manual,
      state: 'stale',
      chip: `Cotización del ${day}`,
      detail: `La última cotización es del ${day}. Puede que la actualización automática esté fallando: probá "Actualizar" o cargala a mano.`,
    };
  }
  if (lastFailed && sync.lastError === 'invalid') {
    return {
      manual,
      state: 'error',
      chip: `USD compra ${value} · ${day}`,
      detail: 'No se pudo leer el archivo de cotizaciones. Se usa la última guardada.',
    };
  }
  return { manual, state: 'ok', chip: `USD compra ${value} · ${day}`, detail: '' };
}
