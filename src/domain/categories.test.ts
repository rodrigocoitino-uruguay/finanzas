import { describe, expect, it } from 'vitest';
import { cleanDisplayName, frecency, nextCategoryColor, normalizeName, suggestCategories, EXPENSE_PALETTE } from './categories';
import type { Category } from './types';

describe('normalizeName', () => {
  it('ignora mayúsculas, tildes y espacios', () => {
    expect(normalizeName('comida')).toBe('comida');
    expect(normalizeName('Comida ')).toBe('comida');
    expect(normalizeName('cómida')).toBe('comida');
    expect(normalizeName('  COMIDA')).toBe('comida');
    expect(normalizeName('Gastos  comunes')).toBe(normalizeName('gastos comunes'));
    expect(normalizeName('Pingüino')).toBe('pinguino');
  });

  it('conserva la ñ', () => {
    expect(normalizeName('Año')).toBe('año');
    expect(normalizeName('AÑO')).toBe('año');
    expect(normalizeName('Año')).not.toBe(normalizeName('Ano'));
    // ñ escrita como n + tilde combinable
    expect(normalizeName('Año')).toBe('año');
  });
});

describe('cleanDisplayName', () => {
  it('limpia espacios y capitaliza', () => {
    expect(cleanDisplayName('  alquiler ')).toBe('Alquiler');
    expect(cleanDisplayName('gastos   comunes')).toBe('Gastos comunes');
    expect(cleanDisplayName('ñoquis')).toBe('Ñoquis');
    expect(cleanDisplayName('   ')).toBe('');
  });
});

const NOW = Date.parse('2026-09-16T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

let seq = 0;
function cat(partial: Partial<Category> & Pick<Category, 'name' | 'group'>): Category {
  return {
    id: `c${++seq}`,
    kind: partial.group === 'fixed' || partial.group === 'variable' ? 'expense' : 'income',
    normalizedName: normalizeName(partial.name),
    color: '#4F8CFF',
    usageCount: 0,
    archived: false,
    createdAt: daysAgo(100),
    ...partial,
  };
}

describe('frecency', () => {
  it('lo reciente le gana a lo viejo aunque se haya usado menos', () => {
    expect(frecency({ usageCount: 2, lastUsedAt: daysAgo(1) }, NOW)).toBeGreaterThan(
      frecency({ usageCount: 10, lastUsedAt: daysAgo(60) }, NOW),
    );
  });
  it('a igual recencia gana lo más usado', () => {
    expect(frecency({ usageCount: 20, lastUsedAt: daysAgo(3) }, NOW)).toBeGreaterThan(
      frecency({ usageCount: 2, lastUsedAt: daysAgo(3) }, NOW),
    );
  });
});

describe('suggestCategories', () => {
  const alquiler = cat({ name: 'Alquiler', group: 'fixed', usageCount: 5, lastUsedAt: daysAgo(10) });
  const gc = cat({ name: 'Gastos comunes', group: 'fixed', usageCount: 5, lastUsedAt: daysAgo(12) });
  const comida = cat({ name: 'Comida', group: 'variable', usageCount: 30, lastUsedAt: daysAgo(0) });
  const super_ = cat({ name: 'Supermercado', group: 'variable', usageCount: 3, lastUsedAt: daysAgo(20) });
  const viejo = cat({ name: 'Gimnasio', group: 'fixed', archived: true });
  const cliente = cat({ name: 'Acme', group: 'freelance', usageCount: 1 });
  const all = [alquiler, gc, comida, super_, viejo, cliente];

  it('sin texto: solo el grupo elegido, sin archivadas, ordenadas por uso', () => {
    const r = suggestCategories(all, { kind: 'expense', group: 'fixed', query: '', now: NOW });
    expect(r.items.map((c) => c.name)).toEqual(['Alquiler', 'Gastos comunes']);
    expect(r.createName).toBeUndefined();
  });

  it('con texto nuevo ofrece crear', () => {
    const r = suggestCategories(all, { kind: 'expense', group: 'fixed', query: 'luz ', now: NOW });
    expect(r.items).toEqual([]);
    expect(r.exact).toBeUndefined();
    expect(r.createName).toBe('Luz');
  });

  it('no ofrece crear duplicados (mayúsculas, tildes, espacios)', () => {
    for (const q of ['comida', 'Comida ', 'cómida', 'COMIDA']) {
      const r = suggestCategories(all, { kind: 'expense', group: 'variable', query: q, now: NOW });
      expect(r.exact?.id).toBe(comida.id);
      expect(r.createName).toBeUndefined();
      expect(r.items[0].id).toBe(comida.id);
    }
  });

  it('encuentra coincidencias en el otro grupo, después de las del grupo elegido', () => {
    const r = suggestCategories(all, { kind: 'expense', group: 'fixed', query: 'com', now: NOW });
    expect(r.items.map((c) => c.name)).toEqual(['Gastos comunes', 'Comida']);
  });

  it('una categoría archivada con el mismo nombre se reutiliza', () => {
    const r = suggestCategories(all, { kind: 'expense', group: 'fixed', query: 'gimnasio', now: NOW });
    expect(r.exact?.id).toBe(viejo.id);
    expect(r.createName).toBeUndefined();
  });

  it('no mezcla gastos con ingresos', () => {
    const r = suggestCategories(all, { kind: 'income', group: 'freelance', query: '', now: NOW });
    expect(r.items.map((c) => c.name)).toEqual(['Acme']);
    const r2 = suggestCategories(all, { kind: 'income', group: 'freelance', query: 'comida', now: NOW });
    expect(r2.exact).toBeUndefined();
    expect(r2.createName).toBe('Comida');
  });
});

describe('nextCategoryColor', () => {
  it('usa el color menos repetido de la paleta', () => {
    expect(nextCategoryColor('expense', [])).toBe(EXPENSE_PALETTE[0]);
    const used = [{ kind: 'expense' as const, color: EXPENSE_PALETTE[0] }];
    expect(nextCategoryColor('expense', used)).toBe(EXPENSE_PALETTE[1]);
    const allUsed = EXPENSE_PALETTE.map((color) => ({ kind: 'expense' as const, color }));
    expect(nextCategoryColor('expense', allUsed)).toBe(EXPENSE_PALETTE[0]);
  });
});
