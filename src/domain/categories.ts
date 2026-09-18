import type { Category, Group, Kind } from './types';

/**
 * Clave de comparación: sin mayúsculas, sin tildes ni diéresis, sin espacios.
 * La ñ se conserva ("año" ≠ "ano").
 * "Comida " = "comida" = "cómida" → "comida".
 */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/([nN])̃/g, (_, n: string) => (n === 'n' ? 'ñ' : 'Ñ'))
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('es')
    .replace(/\s+/g, '');
}

/** Limpia el nombre que se muestra: espacios de más y primera letra en mayúscula. */
export function cleanDisplayName(name: string): string {
  const s = name.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (s === '') return s;
  return s.charAt(0).toLocaleUpperCase('es') + s.slice(1);
}

const DAY_MS = 86_400_000;

/** Puntaje de "frecuencia + recencia": gana lo usado seguido y hace poco. */
export function frecency(cat: Pick<Category, 'usageCount' | 'lastUsedAt'>, now: number): number {
  const last = cat.lastUsedAt ? Date.parse(cat.lastUsedAt) : NaN;
  const days = Number.isNaN(last) ? 365 : Math.max(0, (now - last) / DAY_MS);
  return (cat.usageCount + 1) / (1 + days / 14);
}

export interface SuggestInput {
  kind: Kind;
  group: Group;
  query: string;
  now?: number;
}

export interface SuggestResult {
  /** Categorías sugeridas, ya ordenadas. */
  items: Category[];
  /** Categoría existente (de cualquier grupo del mismo tipo) con el mismo nombre normalizado. */
  exact?: Category;
  /** Nombre limpio a crear si no existe. */
  createName?: string;
}

export function suggestCategories(all: readonly Category[], input: SuggestInput): SuggestResult {
  const now = input.now ?? Date.now();
  const q = normalizeName(input.query);
  const sameKind = all.filter((c) => c.kind === input.kind);
  const exact = q ? sameKind.find((c) => c.normalizedName === q) : undefined;

  const byScore = (a: Category, b: Category) =>
    frecency(b, now) - frecency(a, now) || a.name.localeCompare(b.name, 'es');

  let items: Category[];
  if (!q) {
    items = sameKind.filter((c) => !c.archived && c.group === input.group).sort(byScore);
  } else {
    items = sameKind
      .filter((c) => c.normalizedName.includes(q) && (!c.archived || c === exact))
      .sort((a, b) => {
        const rank = (c: Category) =>
          (c === exact ? 0 : 4) + (c.group === input.group ? 0 : 2) + (c.normalizedName.startsWith(q) ? 0 : 1);
        return rank(a) - rank(b) || byScore(a, b);
      });
  }

  const createName = q && !exact ? cleanDisplayName(input.query) : undefined;
  return { items, exact, createName };
}

/**
 * Paleta de gastos: azules, índigos y violetas para el fondo oscuro.
 * Alterna tonos claros y profundos para que dos categorías vecinas se distingan
 * (validada: luminosidad, croma, daltonismo y contraste ≥ 3:1 sobre #121212).
 */
export const EXPENSE_PALETTE = [
  '#4895F3',
  '#6C54BE',
  '#00A6BA',
  '#3365C5',
  '#04A1D8',
  '#854DAA',
  '#888ADB',
  '#0172A8',
] as const;

/** Paleta de ingresos: verdes y turquesas, con el mismo criterio. */
export const INCOME_PALETTE = [
  '#16AA9A',
  '#287F25',
  '#88A01C',
  '#097D5E',
  '#6DA73E',
  '#0D7F49',
  '#15A7B0',
  '#427C03',
] as const;

export function paletteFor(kind: Kind): readonly string[] {
  return kind === 'expense' ? EXPENSE_PALETTE : INCOME_PALETTE;
}

/** Elige el color menos usado de la paleta (en orden, si hay empate). */
export function nextCategoryColor(kind: Kind, existing: readonly Pick<Category, 'kind' | 'color'>[]): string {
  const palette = paletteFor(kind);
  const counts = new Map<string, number>(palette.map((c) => [c, 0]));
  for (const c of existing) {
    if (c.kind !== kind) continue;
    const key = c.color.toUpperCase();
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best = palette[0];
  let bestCount = Infinity;
  for (const color of palette) {
    const n = counts.get(color) ?? 0;
    if (n < bestCount) {
      best = color;
      bestCount = n;
    }
  }
  return best;
}
