import { describe, expect, it } from 'vitest';
import type { Rate } from '../../domain/types';
import { describeRateStatus } from './status';

const nb = (s: string) => s.replace(/ /g, ' ');
const rate = (date: string, source: Rate['source'] = 'BROU'): Rate => ({ date, buy: 40.1, sell: 42.5, source, fetchedAt: '' });
const ok = { lastAttemptAt: '2026-09-16T13:00:00Z', lastSuccessAt: '2026-09-16T13:00:00Z' };

describe('describeRateStatus', () => {
  it('al día: el chip del encabezado', () => {
    const s = describeRateStatus({ latest: rate('2026-09-16'), today: '2026-09-16', online: true, sync: ok });
    expect(s.state).toBe('ok');
    expect(nb(s.chip)).toBe('USD compra 40,10 · 16/09');
    expect(s.detail).toBe('');
  });

  it('marca las cotizaciones manuales', () => {
    const s = describeRateStatus({ latest: rate('2026-09-16', 'manual'), today: '2026-09-16', online: true, sync: ok });
    expect(nb(s.chip)).toBe('USD compra 40,10 · 16/09');
    expect(s.manual).toBe(true);
  });

  it('sin red: "Cotización del DD/MM"', () => {
    const s = describeRateStatus({ latest: rate('2026-09-12'), today: '2026-09-14', online: false, sync: ok });
    expect(s.state).toBe('offline');
    expect(nb(s.chip)).toBe('Cotización del 12/09');
    const failed = describeRateStatus({
      latest: rate('2026-09-12'),
      today: '2026-09-14',
      online: true,
      sync: { lastAttemptAt: '2026-09-14T10:00:00Z', lastSuccessAt: '2026-09-12T10:00:00Z', lastError: 'offline' },
    });
    expect(failed.state).toBe('offline');
  });

  it('fin de semana: sigue al día; muchos días sin datos: desactualizada', () => {
    expect(describeRateStatus({ latest: rate('2026-09-11'), today: '2026-09-13', online: true, sync: ok }).state).toBe('ok');
    const stale = describeRateStatus({ latest: rate('2026-09-01'), today: '2026-09-13', online: true, sync: ok });
    expect(stale.state).toBe('stale');
    expect(stale.detail).toMatch(/01\/09/);
  });

  it('un error viejo no importa si después hubo un éxito', () => {
    const s = describeRateStatus({
      latest: rate('2026-09-16'),
      today: '2026-09-16',
      online: true,
      sync: { lastAttemptAt: '2026-09-16T13:00:00Z', lastSuccessAt: '2026-09-16T13:00:00Z', lastError: 'offline' },
    });
    expect(s.state).toBe('ok');
  });

  it('sin ninguna cotización', () => {
    expect(describeRateStatus({ latest: null, today: '2026-09-16', online: true, sync: {} }).state).toBe('none');
  });
});
