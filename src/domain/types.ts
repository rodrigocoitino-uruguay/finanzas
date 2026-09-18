export type Currency = 'UYU' | 'USD';
export type Kind = 'expense' | 'income';
export type ExpenseGroup = 'fixed' | 'variable';
export type IncomeGroup = 'salary' | 'freelance' | 'other';
export type Group = ExpenseGroup | IncomeGroup;
export type TxStatus = 'confirmed' | 'pending';
export type RateSource = 'BROU' | 'manual';

export interface Transaction {
  id: string;
  kind: Kind;
  /** En la moneda original. */
  amount: number;
  currency: Currency;
  /** UYU por USD (BROU compra) usada para convertir. */
  rateAtDate: number;
  /** true si no había cotización para esa fecha y se usó la más cercana disponible. */
  rateApprox?: boolean;
  /** true si el usuario fijó a mano la cotización de este movimiento (no se recalcula sola). */
  rateCustom?: boolean;
  amountUYU: number;
  amountUSD: number;
  categoryId: string;
  /** ISO yyyy-mm-dd (fecha local). */
  date: string;
  note?: string;
  recurringId?: string;
  status: TxStatus;
  createdAt: string;
  updatedAt: string;
  isDemo?: boolean;
}

export interface Category {
  id: string;
  kind: Kind;
  group: Group;
  name: string;
  /** Sin mayúsculas, tildes ni espacios: evita duplicados. */
  normalizedName: string;
  color: string;
  usageCount: number;
  lastUsedAt?: string;
  archived: boolean;
  createdAt: string;
  isDemo?: boolean;
}

export interface Budget {
  id: string;
  categoryId: string;
  amount: number;
  currency: Currency;
  isDemo?: boolean;
}

export interface Recurring {
  id: string;
  templateTx: Pick<Transaction, 'kind' | 'amount' | 'currency' | 'categoryId' | 'note'>;
  dayOfMonth: number;
  active: boolean;
  /** yyyy-mm del último mes generado. */
  lastGeneratedMonth?: string;
  isDemo?: boolean;
}

export interface Rate {
  /** yyyy-mm-dd */
  date: string;
  buy: number;
  sell: number;
  source: RateSource;
  fetchedAt: string;
}

export interface Settings {
  id: 'app';
  displayCurrency: Currency;
  defaultExpenseCurrency: Currency;
  defaultIncomeCurrency: Currency;
  pinHash?: string;
  pinSalt?: string;
  pinIterations?: number;
  webauthnCredentialId?: string;
  autoLockMinutes: number;
  lastBackupAt?: string;
  schemaVersion: number;
}

export interface Meta {
  key: string;
  value: unknown;
}

export const GROUPS_BY_KIND: Record<Kind, readonly Group[]> = {
  expense: ['fixed', 'variable'],
  income: ['salary', 'freelance', 'other'],
};

export const GROUP_LABEL: Record<Group, string> = {
  fixed: 'Fijo',
  variable: 'Variable',
  salary: 'Sueldo',
  freelance: 'Freelance',
  other: 'Otro',
};

export const GROUP_LABEL_PLURAL: Record<Group, string> = {
  fixed: 'Fijos',
  variable: 'Variables',
  salary: 'Sueldo',
  freelance: 'Freelance',
  other: 'Otros',
};

/** Nombre de categoría que se usa si un ingreso se guarda sin subcategoría. */
export const DEFAULT_INCOME_CATEGORY: Record<IncomeGroup, string> = {
  salary: 'Sueldo',
  freelance: 'Freelance',
  other: 'Otros ingresos',
};

export function kindOfGroup(group: Group): Kind {
  return group === 'fixed' || group === 'variable' ? 'expense' : 'income';
}
