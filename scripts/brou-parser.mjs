// Lectura de la cotización del dólar billete del BROU (sin dependencias).
// La página /cotizaciones carga la tabla desde un "portlet" de Liferay que
// devuelve HTML simple. Buscamos su dirección en la página (por si cambia el
// identificador) y, si no aparece, usamos la conocida.

export const BROU_ORIGIN = 'https://www.brou.com.uy';
export const BROU_PAGE_URL = `${BROU_ORIGIN}/cotizaciones`;
export const FALLBACK_PORTLET_URL =
  `${BROU_ORIGIN}/c/portal/render_portlet?p_l_id=20593` +
  '&p_p_id=cotizacionfull_WAR_broutmfportlet_INSTANCE_otHfewh1klyS' +
  '&p_p_lifecycle=0&p_t_lifecycle=0&p_p_state=normal&p_p_mode=view' +
  '&p_p_col_id=column-1&p_p_col_pos=0&p_p_col_count=2&p_p_isolated=1&currentURL=%2Fcotizaciones';

/** Límites de cordura para UYU por USD. */
export const LIMITS = { min: 15, max: 200, maxSpread: 10, maxDailyJump: 0.15 };

function decodeEscapes(s) {
  return s
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&');
}

/** Dirección del portlet de cotizaciones dentro de la página. Solo acepta el dominio del BROU. */
export function findPortletUrl(pageHtml) {
  const decoded = decodeEscapes(pageHtml);
  const m = decoded.match(/\/c\/portal\/render_portlet\?[^"'\s<>]*?p_p_id=cotizacionfull_WAR_[A-Za-z0-9_]+[^"'\s<>]*/);
  if (!m) return null;
  try {
    const url = new URL(m[0], BROU_ORIGIN);
    return url.origin === BROU_ORIGIN ? url.toString() : null;
  } catch {
    return null;
  }
}

/** "39,05000" → 39.05 · "2.062,50000" → 2062.5 · "-" → null */
export function parseEsNumber(text) {
  const s = String(text).trim().replace(/\s/g, '');
  if (!/^\d{1,3}(\.\d{3})*(,\d+)?$|^\d+(,\d+)?$/.test(s)) return null;
  const n = Number(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function normalize(s) {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const VALUE_RE = /<p class="valor">\s*([^<]*?)\s*<\/p>/g;

/** Filas de la tabla: nombre de la moneda y sus valores, en el orden de las columnas. */
export function parseBrouTable(html) {
  const thead = html.match(/<thead>([\s\S]*?)<\/thead>/i)?.[1] ?? '';
  const columns = [...thead.matchAll(VALUE_RE)].map((m) => normalize(m[1]));
  const tbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/i)?.[1] ?? '';
  const rows = tbody
    .split(/<tr[\s>]/i)
    .slice(1)
    .map((row) => ({
      name: row.match(/<p class="moneda">\s*([^<]*?)\s*<\/p>/)?.[1] ?? '',
      values: [...row.matchAll(VALUE_RE)].map((m) => m[1]),
    }))
    .filter((r) => r.name);
  return { columns, rows };
}

/**
 * Dólar billete (fila exactamente "Dólar", no "Dólar eBROU"): compra y venta.
 * Tira un Error con el motivo si algo no cierra.
 */
export function extractDolarBillete(html) {
  const { columns, rows } = parseBrouTable(html);
  if (rows.length === 0) throw new Error('No se encontró la tabla de cotizaciones');
  const row = rows.find((r) => normalize(r.name) === 'dolar');
  if (!row) throw new Error('No se encontró la fila "Dólar"');

  const buyIdx = columns.indexOf('compra');
  const sellIdx = columns.indexOf('venta');
  const buy = parseEsNumber(row.values[buyIdx >= 0 ? buyIdx : 0]);
  const sell = parseEsNumber(row.values[sellIdx >= 0 ? sellIdx : 1]);
  validateRate({ buy, sell });
  return { buy: round(buy), sell: round(sell) };
}

function round(n) {
  return Math.round(n * 10000) / 10000;
}

export function validateRate({ buy, sell }) {
  if (buy === null || sell === null || !Number.isFinite(buy) || !Number.isFinite(sell)) {
    throw new Error('Valores no numéricos');
  }
  if (buy < LIMITS.min || buy > LIMITS.max || sell < LIMITS.min || sell > LIMITS.max) {
    throw new Error(`Valores fuera de rango: compra ${buy}, venta ${sell}`);
  }
  if (sell < buy) throw new Error(`La venta (${sell}) es menor que la compra (${buy})`);
  if (sell - buy > LIMITS.maxSpread) throw new Error(`Diferencia compra/venta sospechosa: ${sell - buy}`);
}

/** Un salto de más del 15 % contra la última cotización válida se descarta (probable error de lectura). */
export function isSuspiciousJump(previousBuy, nextBuy) {
  if (!(previousBuy > 0)) return false;
  return Math.abs(nextBuy - previousBuy) / previousBuy > LIMITS.maxDailyJump;
}

/** Fecha de hoy en Montevideo (yyyy-mm-dd). */
export function montevideoDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Montevideo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Actualiza el histórico. Devuelve null si no cambió nada (evita commits innecesarios). */
export function mergeRate(history, date, rate, fetchedAt) {
  const prev = history[date];
  if (prev && prev.buy === rate.buy && prev.sell === rate.sell) return null;
  const next = { ...history, [date]: { buy: rate.buy, sell: rate.sell, source: 'BROU', fetchedAt } };
  return Object.fromEntries(Object.entries(next).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** JSON con una fecha por línea: diffs chicos y legibles en el repo. */
export function stringifyHistory(history) {
  const lines = Object.entries(history).map(([d, v]) => `  ${JSON.stringify(d)}: ${JSON.stringify(v)}`);
  return `{\n${lines.join(',\n')}\n}\n`;
}
