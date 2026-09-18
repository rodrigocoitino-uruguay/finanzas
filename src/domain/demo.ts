import { lastDayOfMonth } from 'date-fns';
import { addDaysISO, addMonthsISO, parseISODate, toISODate } from '../lib/dates';
import { EXPENSE_PALETTE, INCOME_PALETTE, normalizeName } from './categories';
import { convert, round2 } from './money';
import type { Budget, Category, Currency, Group, Kind, Recurring, Transaction } from './types';

/** Generador pseudoaleatorio con semilla (los datos demo son reproducibles). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface CatSpec {
  name: string;
  kind: Kind;
  group: Group;
}

const CATS: CatSpec[] = [
  { name: 'Alquiler', kind: 'expense', group: 'fixed' },
  { name: 'Gastos comunes', kind: 'expense', group: 'fixed' },
  { name: 'UTE', kind: 'expense', group: 'fixed' },
  { name: 'Antel', kind: 'expense', group: 'fixed' },
  { name: 'Mutualista', kind: 'expense', group: 'fixed' },
  { name: 'Suscripciones', kind: 'expense', group: 'fixed' },
  { name: 'Supermercado', kind: 'expense', group: 'variable' },
  { name: 'Comida', kind: 'expense', group: 'variable' },
  { name: 'Transporte', kind: 'expense', group: 'variable' },
  { name: 'Salidas', kind: 'expense', group: 'variable' },
  { name: 'Farmacia', kind: 'expense', group: 'variable' },
  { name: 'Ropa', kind: 'expense', group: 'variable' },
  { name: 'Regalos', kind: 'expense', group: 'variable' },
  { name: 'Compras online', kind: 'expense', group: 'variable' },
  { name: 'Sueldo', kind: 'income', group: 'salary' },
  { name: 'Estudio Pérez', kind: 'income', group: 'freelance' },
  { name: 'Cliente EE.UU.', kind: 'income', group: 'freelance' },
  { name: 'Venta usados', kind: 'income', group: 'other' },
];

export interface DemoData {
  categories: Category[];
  transactions: Transaction[];
  recurrings: Recurring[];
  budgets: Budget[];
}

/** Recurrentes demo: [categoría, día, monto, moneda]. Los del mes en curso quedan pendientes. */
const DEMO_RECURRING: [string, number, number, Currency][] = [
  ['Sueldo', 1, 3200, 'USD'],
  ['Alquiler', 5, 28000, 'UYU'],
  ['Gastos comunes', 8, 6500, 'UYU'],
  ['Mutualista', 10, 2450, 'UYU'],
];

const DEMO_BUDGETS: [string, number, Currency][] = [
  ['Supermercado', 20000, 'UYU'],
  ['Comida', 9000, 'UYU'],
  ['Salidas', 7000, 'UYU'],
  ['Compras online', 120, 'USD'],
];

/** Cotización sintética para los datos demo (no se guarda como histórico real). */
function demoRate(date: string, rnd: () => number): number {
  const t = parseISODate(date).getTime() / 86_400_000;
  return round2(39.6 + Math.sin(t / 23) * 0.9 + (rnd() - 0.5) * 0.2);
}

/**
 * Seis meses de movimientos inventados que terminan hoy.
 * `existing` evita duplicar categorías que el usuario ya tiene con el mismo nombre.
 */
export function buildDemoData(
  today: string,
  existing: readonly Category[],
  opts: { seed?: number; makeId?: () => string } = {},
): DemoData {
  const seed = opts.seed ?? 42;
  const rnd = mulberry32(seed);
  const nowISO = new Date().toISOString();
  let idSeq = 0;
  const id = (p: string) => (opts.makeId ? opts.makeId() : `demo-${p}-${seed}-${++idSeq}`);

  const categories: Category[] = [];
  const catByName = new Map<string, Category>();
  const colorIdx: Record<Kind, number> = { expense: 0, income: 0 };
  for (const spec of CATS) {
    const norm = normalizeName(spec.name);
    const found = existing.find((c) => c.kind === spec.kind && c.normalizedName === norm);
    if (found) {
      catByName.set(spec.name, found);
      continue;
    }
    const palette = spec.kind === 'expense' ? EXPENSE_PALETTE : INCOME_PALETTE;
    const cat: Category = {
      id: id('cat'),
      kind: spec.kind,
      group: spec.group,
      name: spec.name,
      normalizedName: norm,
      color: palette[colorIdx[spec.kind]++ % palette.length],
      usageCount: 0,
      archived: false,
      createdAt: nowISO,
      isDemo: true,
    };
    categories.push(cat);
    catByName.set(spec.name, cat);
  }

  const currentMonth = today.slice(0, 7);
  const recurrings: Recurring[] = DEMO_RECURRING.map(([name, day, amount, currency]) => ({
    id: id('rec'),
    templateTx: { kind: catByName.get(name)!.kind, amount, currency, categoryId: catByName.get(name)!.id },
    dayOfMonth: day,
    active: true,
    lastGeneratedMonth: currentMonth,
    isDemo: true,
  }));
  const recByName = new Map(DEMO_RECURRING.map(([name], i) => [name, recurrings[i]]));

  const transactions: Transaction[] = [];
  const add = (name: string, date: string, amount: number, currency: Currency, note?: string) => {
    const rec = recByName.get(name);
    const pending = Boolean(rec) && date.startsWith(currentMonth);
    // Los recurrentes del mes en curso se generan como pendientes (aunque su día no haya llegado).
    if (date > today && !pending) return;
    const cat = catByName.get(name)!;
    const rate = demoRate(date, rnd);
    const tx: Transaction = {
      id: id('tx'),
      kind: cat.kind,
      amount: round2(amount),
      currency,
      rateAtDate: rate,
      ...convert(amount, currency, rate),
      categoryId: cat.id,
      date,
      status: pending ? 'pending' : 'confirmed',
      createdAt: `${date}T12:00:00.000Z`,
      updatedAt: nowISO,
      isDemo: true,
    };
    if (note) tx.note = note;
    if (rec) tx.recurringId = rec.id;
    transactions.push(tx);
  };
  const between = (min: number, max: number) => min + rnd() * (max - min);
  const roundTo = (n: number, step: number) => Math.round(n / step) * step;

  const firstMonth = addMonthsISO(`${today.slice(0, 7)}-01`, -5);
  for (let m = 0; m < 6; m++) {
    const monthStart = addMonthsISO(firstMonth, m);
    const last = toISODate(lastDayOfMonth(parseISODate(monthStart)));
    const day = (d: number) => {
      const iso = addDaysISO(monthStart, d - 1);
      return iso > last ? last : iso;
    };

    // Ingresos
    add('Sueldo', day(1), 3200, 'USD');
    if (rnd() < 0.8) add('Estudio Pérez', day(Math.ceil(between(8, 20))), roundTo(between(18000, 42000), 500), 'UYU', 'Diseño web');
    if (rnd() < 0.5) add('Cliente EE.UU.', day(Math.ceil(between(10, 26))), roundTo(between(300, 900), 50), 'USD');
    if (rnd() < 0.2) add('Venta usados', day(Math.ceil(between(5, 25))), roundTo(between(1500, 6000), 100), 'UYU');

    // Fijos
    add('Alquiler', day(5), 28000, 'UYU');
    add('Gastos comunes', day(8), 6500, 'UYU');
    add('UTE', day(12), roundTo(between(1800, 3200), 10), 'UYU');
    add('Antel', day(14), 1690, 'UYU');
    add('Mutualista', day(10), 2450, 'UYU');
    add('Suscripciones', day(3), 15.99, 'USD', 'Netflix');
    add('Suscripciones', day(18), 11.99, 'USD', 'Spotify');

    // Variables
    const daysInMonth = parseISODate(last).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      if (rnd() < 0.35) add('Supermercado', day(d), roundTo(between(600, 4200), 10), 'UYU');
      if (rnd() < 0.3) add('Comida', day(d), roundTo(between(350, 1900), 10), 'UYU');
      if (rnd() < 0.25) add('Transporte', day(d), roundTo(between(65, 520), 5), 'UYU');
    }
    for (let i = 0; i < 3; i++) add('Salidas', day(Math.ceil(between(1, daysInMonth))), roundTo(between(900, 3800), 10), 'UYU');
    if (rnd() < 0.7) add('Farmacia', day(Math.ceil(between(1, daysInMonth))), roundTo(between(300, 1600), 10), 'UYU');
    if (rnd() < 0.4) add('Ropa', day(Math.ceil(between(1, daysInMonth))), roundTo(between(1500, 6500), 50), 'UYU');
    if (rnd() < 0.25) add('Regalos', day(Math.ceil(between(1, daysInMonth))), roundTo(between(800, 3500), 50), 'UYU');
    if (rnd() < 0.45) add('Compras online', day(Math.ceil(between(1, daysInMonth))), round2(between(20, 140)), 'USD', 'Amazon');
  }

  const budgets: Budget[] = DEMO_BUDGETS.map(([name, amount, currency]) => ({
    id: id('bud'),
    categoryId: catByName.get(name)!.id,
    amount,
    currency,
    isDemo: true,
  }));

  // Uso de las categorías demo (para ordenar las sugerencias)
  for (const cat of categories) {
    const txs = transactions.filter((t) => t.categoryId === cat.id);
    cat.usageCount = txs.length;
    const lastTx = txs.reduce<string | undefined>((a, t) => (!a || t.date > a ? t.date : a), undefined);
    if (lastTx) cat.lastUsedAt = `${lastTx}T12:00:00.000Z`;
  }

  return { categories, transactions, recurrings, budgets };
}
