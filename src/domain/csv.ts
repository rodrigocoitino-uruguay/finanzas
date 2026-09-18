import { GROUP_LABEL, type Category, type Transaction } from './types';

const SEP = ';';

/** Número con coma decimal y sin separador de miles (lo que espera Excel en español). */
function csvNumber(n: number, digits = 2): string {
  return n.toFixed(digits).replace('.', ',');
}

/**
 * Texto seguro para CSV: comillas cuando hace falta y protección contra fórmulas
 * (un texto que empieza con = + - @ se ejecutaría como fórmula en Excel).
 */
export function csvText(value: string): string {
  let v = value.replace(/\r?\n/g, ' ');
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  if (v.includes(SEP) || v.includes('"')) v = `"${v.replace(/"/g, '""')}"`;
  return v;
}

const HEADER = [
  'Fecha',
  'Tipo',
  'Grupo',
  'Categoría',
  'Nota',
  'Monto',
  'Moneda',
  'Cotización',
  'Monto UYU',
  'Monto USD',
  'Estado',
];

/** Movimientos en CSV (separador ";", decimales con coma, UTF-8 con BOM para Excel). */
export function transactionsToCsv(txs: readonly Transaction[], categories: ReadonlyMap<string, Category>): string {
  const rows = [...txs]
    .sort((a, b) => (a.date === b.date ? (a.createdAt < b.createdAt ? -1 : 1) : a.date < b.date ? -1 : 1))
    .map((t) => {
      const cat = categories.get(t.categoryId);
      return [
        t.date,
        t.kind === 'income' ? 'Ingreso' : 'Gasto',
        cat ? GROUP_LABEL[cat.group] : '',
        csvText(cat?.name ?? ''),
        csvText(t.note ?? ''),
        csvNumber(t.amount),
        t.currency,
        csvNumber(t.rateAtDate, 4),
        csvNumber(t.amountUYU),
        csvNumber(t.amountUSD),
        t.status === 'pending' ? 'Pendiente' : 'Confirmado',
      ].join(SEP);
    });
  return `﻿${[HEADER.join(SEP), ...rows].join('\r\n')}\r\n`;
}
