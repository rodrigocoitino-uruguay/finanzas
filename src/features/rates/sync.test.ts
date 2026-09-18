import { describe, expect, it } from 'vitest';
import { parseRatesFiles } from './sync';

describe('parseRatesFiles', () => {
  it('combina histórico y último valor', () => {
    const rates = parseRatesFiles(
      { '2026-09-15': { buy: 39.1, sell: 41.5, source: 'BROU', fetchedAt: 'x' } },
      { date: '2026-09-16', buy: 39.05, sell: 41.45, source: 'BROU', fetchedAt: 'y' },
    );
    expect(rates).toHaveLength(2);
    expect(rates.every((r) => r.source === 'BROU')).toBe(true);
  });

  it('descarta datos corruptos o sospechosos', () => {
    const rates = parseRatesFiles(
      {
        '2026-09-15': { buy: '39', sell: 41 },
        'no-es-fecha': { buy: 39, sell: 41 },
        '2026-09-14': { buy: 0.5, sell: 41 },
        '2026-09-13': null,
        '2026-09-12': { buy: 39, sell: 41 },
      },
      '<html>',
    );
    expect(rates.map((r) => r.date)).toEqual(['2026-09-12']);
    expect(parseRatesFiles(null, null)).toEqual([]);
    expect(parseRatesFiles([1, 2], { date: '2026-13-01', buy: 39, sell: 41 })).toEqual([]);
  });
});
