import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BROU_ORIGIN,
  extractDolarBillete,
  findPortletUrl,
  isSuspiciousJump,
  mergeRate,
  montevideoDate,
  parseBrouTable,
  parseEsNumber,
  stringifyHistory,
  validateRate,
} from './brou-parser.mjs';

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const portlet = fixture('brou-portlet.html');

describe('parseEsNumber', () => {
  it('entiende el formato del BROU', () => {
    expect(parseEsNumber(' 39,05000 ')).toBe(39.05);
    expect(parseEsNumber('2.062,50000')).toBe(2062.5);
    expect(parseEsNumber('41')).toBe(41);
    expect(parseEsNumber('-')).toBeNull();
    expect(parseEsNumber('')).toBeNull();
    expect(parseEsNumber('39.05')).toBeNull(); // formato inglés: no se adivina
    expect(parseEsNumber('abc')).toBeNull();
  });
});

describe('tabla del BROU (página real guardada)', () => {
  it('lee columnas y filas', () => {
    const { columns, rows } = parseBrouTable(portlet);
    expect(columns.slice(0, 2)).toEqual(['compra', 'venta']);
    expect(rows.map((r) => r.name)).toContain('Dólar eBROU');
  });

  it('toma el dólar billete, no el eBROU', () => {
    expect(extractDolarBillete(portlet)).toEqual({ buy: 39.05, sell: 41.25 });
  });

  it('respeta el orden de las columnas aunque cambie', () => {
    const table = (head, row) =>
      `<table><thead><tr>${head.map((h) => `<td><p class="valor">${h}</p></td>`).join('')}</tr></thead>` +
      `<tbody><tr><td><p class="moneda">Dólar</p></td>${row.map((v) => `<td><p class="valor"> ${v} </p></td>`).join('')}</tr></tbody></table>`;
    expect(extractDolarBillete(table(['Venta', 'Compra'], ['41,25000', '39,05000']))).toEqual({ buy: 39.05, sell: 41.25 });
  });

  it('falla con motivo si la fila no está o los valores son absurdos', () => {
    expect(() => extractDolarBillete('<html>mantenimiento</html>')).toThrow(/tabla/);
    expect(() => extractDolarBillete(portlet.replace('>Dólar<', '>Dolar USA<'))).toThrow(/Dólar/);
    expect(() => extractDolarBillete(portlet.replace(' 39,05000 ', ' 3,90500 '))).toThrow(/rango/);
    expect(() => extractDolarBillete(portlet.replace(' 41,25000 ', ' - '))).toThrow(/numéricos/);
  });
});

describe('validateRate', () => {
  it('controla compra/venta', () => {
    expect(() => validateRate({ buy: 40, sell: 42 })).not.toThrow();
    expect(() => validateRate({ buy: 42, sell: 40 })).toThrow(/menor/);
    expect(() => validateRate({ buy: 40, sell: 60 })).toThrow(/sospechosa/);
    expect(() => validateRate({ buy: NaN, sell: 42 })).toThrow();
  });
  it('detecta saltos sospechosos', () => {
    expect(isSuspiciousJump(39, 40)).toBe(false);
    expect(isSuspiciousJump(39, 46)).toBe(true);
    expect(isSuspiciousJump(undefined, 46)).toBe(false);
  });
});

describe('findPortletUrl', () => {
  it('encuentra la dirección escapada dentro de la página', () => {
    const url = findPortletUrl(fixture('brou-page-snippet.html'));
    expect(url).toMatch(/^https:\/\/www\.brou\.com\.uy\/c\/portal\/render_portlet\?/);
    expect(url).toContain('p_p_id=cotizacionfull_WAR_broutmfportlet_INSTANCE_otHfewh1klyS');
    expect(url).toContain('p_p_isolated=1');
  });
  it('nunca devuelve otro dominio', () => {
    expect(findPortletUrl('"//evil.example/c/portal/render_portlet?p_p_id=cotizacionfull_WAR_x"')).toBe(
      `${BROU_ORIGIN}/c/portal/render_portlet?p_p_id=cotizacionfull_WAR_x`,
    );
    expect(findPortletUrl('<html>sin portlet</html>')).toBeNull();
  });
});

describe('histórico', () => {
  it('fecha de Montevideo (UTC−3)', () => {
    expect(montevideoDate(new Date('2026-09-17T02:30:00Z'))).toBe('2026-09-16');
    expect(montevideoDate(new Date('2026-09-17T13:30:00Z'))).toBe('2026-09-17');
  });

  it('agrega, ordena y no cambia nada si el valor es el mismo', () => {
    const h = { '2026-09-16': { buy: 39.05, sell: 41.45, source: 'BROU', fetchedAt: 'a' } };
    expect(mergeRate(h, '2026-09-16', { buy: 39.05, sell: 41.45 }, 'b')).toBeNull();
    const m = mergeRate(h, '2026-09-15', { buy: 39.1, sell: 41.5 }, 'c');
    expect(Object.keys(m)).toEqual(['2026-09-15', '2026-09-16']);
    const u = mergeRate(h, '2026-09-16', { buy: 39.2, sell: 41.6 }, 'd');
    expect(u['2026-09-16']).toEqual({ buy: 39.2, sell: 41.6, source: 'BROU', fetchedAt: 'd' });
  });

  it('JSON válido con una fecha por línea', () => {
    const text = stringifyHistory({ '2026-09-16': { buy: 39.05, sell: 41.45, source: 'BROU', fetchedAt: 'x' } });
    expect(JSON.parse(text)).toEqual({ '2026-09-16': { buy: 39.05, sell: 41.45, source: 'BROU', fetchedAt: 'x' } });
    expect(text.split('\n')).toHaveLength(4);
  });
});
