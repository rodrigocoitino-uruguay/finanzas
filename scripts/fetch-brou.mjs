#!/usr/bin/env node
// Lo corre el GitHub Action "Cotización BROU" (.github/workflows/rates.yml).
// Si algo falla, NO toca los archivos: queda el último valor válido y un aviso en el log.
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import {
  BROU_PAGE_URL,
  FALLBACK_PORTLET_URL,
  extractDolarBillete,
  findPortletUrl,
  isSuspiciousJump,
  mergeRate,
  montevideoDate,
  stringifyHistory,
} from './brou-parser.mjs';

const RATES_DIR = new URL('../public/rates/', import.meta.url);
const HISTORY = new URL('history.json', RATES_DIR);
const LATEST = new URL('latest.json', RATES_DIR);
const USER_AGENT = 'Mozilla/5.0 (compatible; FinanzasPersonales/1.0; uso personal, 3 consultas por dia)';

const warn = (msg) => console.log(`::warning title=Cotización BROU::${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

async function fetchText(url, attempts = 3) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': USER_AGENT, accept: 'text/html' },
        redirect: 'follow',
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (text.length > 2_000_000) throw new Error('Respuesta demasiado grande');
      return text;
    } catch (e) {
      lastError = e;
      if (i < attempts - 1) await sleep(5_000 * (i + 1));
    }
  }
  throw lastError;
}

async function readJSON(url, fallback) {
  try {
    return JSON.parse(await readFile(url, 'utf8'));
  } catch {
    return fallback;
  }
}

async function main() {
  const now = new Date();
  const date = montevideoDate(now);
  const errors = [];

  let discovered = null;
  try {
    discovered = findPortletUrl(await fetchText(BROU_PAGE_URL));
    if (!discovered) errors.push('No se encontró el portlet en la página; se usa la dirección conocida');
  } catch (e) {
    errors.push(`Página de cotizaciones: ${e.message}`);
  }

  let rate = null;
  for (const url of [...new Set([discovered, FALLBACK_PORTLET_URL].filter(Boolean))]) {
    try {
      rate = extractDolarBillete(await fetchText(url));
      break;
    } catch (e) {
      errors.push(`${url.slice(0, 80)}…: ${e.message}`);
    }
  }

  if (!rate) {
    warn(`No se pudo leer la cotización. Se mantiene el último valor válido. ${errors.join(' | ')}`);
    await setOutput('changed', 'false');
    return;
  }
  for (const e of errors) console.log(`Aviso: ${e}`);

  const latest = await readJSON(LATEST, null);
  if (latest && isSuspiciousJump(latest.buy, rate.buy)) {
    warn(`Salto sospechoso: ${latest.buy} → ${rate.buy}. No se guarda; revisá la página del BROU.`);
    await setOutput('changed', 'false');
    return;
  }

  const history = await readJSON(HISTORY, {});
  const merged = mergeRate(history, date, rate, now.toISOString());
  if (!merged) {
    console.log(`Sin cambios: ${date} compra ${rate.buy} venta ${rate.sell}`);
    await setOutput('changed', 'false');
    return;
  }

  await writeFile(HISTORY, stringifyHistory(merged));
  const newest = Object.keys(merged).at(-1);
  const top = merged[newest];
  await writeFile(
    LATEST,
    `${JSON.stringify({ date: newest, buy: top.buy, sell: top.sell, source: 'BROU', fetchedAt: top.fetchedAt }, null, 2)}\n`,
  );
  console.log(`Guardado: ${date} compra ${rate.buy} venta ${rate.sell}`);
  await setOutput('changed', 'true');
}

main().catch(async (e) => {
  // Nunca rompe el workflow: el último valor válido sigue publicado.
  warn(`Error inesperado: ${e?.message ?? e}`);
  await setOutput('changed', 'false');
});
