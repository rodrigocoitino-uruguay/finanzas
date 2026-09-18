import Dexie, { type EntityTable, type Table } from 'dexie';
import type { Budget, Category, Meta, Rate, RateSource, Recurring, Settings, Transaction } from '../domain/types';

/** Versión del esquema de datos (también va en los respaldos). */
export const SCHEMA_VERSION = 1;

export type FinanzasDB = Dexie & {
  transactions: EntityTable<Transaction, 'id'>;
  categories: EntityTable<Category, 'id'>;
  budgets: EntityTable<Budget, 'id'>;
  recurrings: EntityTable<Recurring, 'id'>;
  rates: Table<Rate, [string, RateSource]>;
  settings: EntityTable<Settings, 'id'>;
  meta: EntityTable<Meta, 'key'>;
};

export function createDB(name = 'finanzas'): FinanzasDB {
  const db = new Dexie(name) as FinanzasDB;
  // Migraciones: nunca editar una versión publicada; agregar db.version(2)… con .upgrade().
  db.version(1).stores({
    transactions: 'id, date, kind, categoryId, status, recurringId, [kind+date], [status+date]',
    categories: 'id, kind, group, [kind+normalizedName]',
    budgets: 'id, &categoryId',
    recurrings: 'id',
    rates: '[date+source], date',
    settings: 'id',
    meta: 'key',
  });
  return db;
}

export const db = createDB();

export const ALL_TABLES = ['transactions', 'categories', 'budgets', 'recurrings', 'rates', 'settings', 'meta'] as const;
