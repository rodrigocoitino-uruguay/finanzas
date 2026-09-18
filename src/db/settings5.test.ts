import { beforeEach, describe, expect, it } from 'vitest';
import { WrongPasswordError } from '../lib/crypto';
import { importBackup, prepareBackup, prepareCsv, readBackup, wipeAllData, PasswordRequiredError } from './backup';
import { setBudget } from './budgets';
import { categoryUsage, deleteCategory, mergeCategories, renameCategory, setCategoryArchived, updateCategory } from './categories';
import { db } from './db';
import { loadDemoData } from './demo';
import { setManualRate, upsertBrouRates } from './rates';
import { createRecurringFromTx } from './recurring';
import { checkPin, currentWaitMs, lockoutMs, removePin, setPin } from './security';
import { getSettings, updateSettings } from './settings';
import { saveTransaction, ValidationError } from './transactions';

const FAST = 10_000;

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await upsertBrouRates([{ date: '2026-09-01', buy: 40, sell: 42, source: 'BROU', fetchedAt: '' }]);
});

const gasto = (categoryName: string, amount = 100, group: 'fixed' | 'variable' = 'variable') =>
  saveTransaction({ kind: 'expense', group, amount, currency: 'UYU', date: '2026-09-10', categoryName });

describe('categorías', () => {
  it('renombrar se refleja en todo y no permite duplicados', async () => {
    const { category } = await gasto('Comida');
    await gasto('Salidas');
    await renameCategory(category.id, '  comida y super ');
    expect((await db.categories.get(category.id))?.name).toBe('Comida y super');
    await expect(renameCategory(category.id, 'SALIDAS')).rejects.toBeInstanceOf(ValidationError);
  });

  it('color y grupo validados', async () => {
    const { category } = await gasto('Luz', 100, 'variable');
    await updateCategory(category.id, { color: '#123ABC', group: 'fixed' });
    expect(await db.categories.get(category.id)).toMatchObject({ color: '#123ABC', group: 'fixed' });
    await expect(updateCategory(category.id, { color: 'red' })).rejects.toBeInstanceOf(ValidationError);
    await expect(updateCategory(category.id, { group: 'salary' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('fusionar mueve movimientos, recurrentes y presupuesto', async () => {
    const a = await gasto('Super', 100);
    await gasto('Super', 50);
    const b = await gasto('Supermercado', 30);
    await setBudget(a.category.id, 5000, 'UYU');
    await createRecurringFromTx(a.tx.id, 10, '2026-09-10');
    const moved = await mergeCategories(a.category.id, b.category.id);
    expect(moved).toBe(2);
    expect(await db.categories.get(a.category.id)).toBeUndefined();
    expect(await db.transactions.where('categoryId').equals(b.category.id).count()).toBe(3);
    expect((await db.budgets.toArray()).map((x) => x.categoryId)).toEqual([b.category.id]);
    expect((await db.recurrings.toArray())[0].templateTx.categoryId).toBe(b.category.id);
    expect((await db.categories.get(b.category.id))?.usageCount).toBe(3);
  });

  it('no se fusionan gastos con ingresos', async () => {
    const g = await gasto('Varios');
    const i = await saveTransaction({ kind: 'income', group: 'other', amount: 1, currency: 'UYU', date: '2026-09-10', categoryName: 'Venta' });
    await expect(mergeCategories(g.category.id, i.category.id)).rejects.toBeInstanceOf(ValidationError);
  });

  it('solo se borra si no tiene movimientos; archivar la oculta', async () => {
    const { category, tx } = await gasto('Temporal');
    await expect(deleteCategory(category.id)).rejects.toBeInstanceOf(ValidationError);
    await setCategoryArchived(category.id, true);
    expect((await db.categories.get(category.id))?.archived).toBe(true);
    await db.transactions.delete(tx.id);
    expect(await categoryUsage(category.id)).toEqual({ transactions: 0, recurrings: 0, hasBudget: false });
    await deleteCategory(category.id);
    expect(await db.categories.get(category.id)).toBeUndefined();
  });
});

describe('PIN', () => {
  it('se guarda como hash y bloquea con espera creciente', async () => {
    await setPin('4821', FAST);
    const s = await getSettings();
    expect(s.pinHash).toBeTruthy();
    expect(JSON.stringify(s)).not.toContain('4821');
    expect(s.pinLength).toBe(4);

    const t0 = 1_000_000;
    for (let i = 1; i <= 4; i++) expect((await checkPin('0000', t0)).waitMs).toBe(0);
    const fifth = await checkPin('0000', t0);
    expect(fifth).toMatchObject({ ok: false, waitMs: 30_000, failures: 5 });
    // durante la espera ni el PIN correcto entra
    expect((await checkPin('4821', t0 + 1000)).ok).toBe(false);
    expect(await currentWaitMs(t0 + 1000)).toBe(29_000);
    // pasada la espera, entra y se resetea el contador
    expect((await checkPin('4821', t0 + 31_000)).ok).toBe(true);
    expect((await checkPin('0000', t0 + 32_000)).waitMs).toBe(0);
  });

  it('esperas: 30 s, 1 min, 2 min… hasta 15 min', () => {
    expect([4, 5, 6, 7, 20].map(lockoutMs)).toEqual([0, 30_000, 60_000, 120_000, 900_000]);
  });

  it('solo 4 a 6 números; se puede quitar', async () => {
    await expect(setPin('12', FAST)).rejects.toBeInstanceOf(ValidationError);
    await expect(setPin('12a4', FAST)).rejects.toBeInstanceOf(ValidationError);
    await setPin('123456', FAST);
    await removePin();
    expect((await getSettings()).pinHash).toBeUndefined();
  });
});

describe('respaldo', () => {
  it('cifrado, sin datos demo ni PIN, e importable reemplazando', async () => {
    await gasto('Comida', 1890);
    await setManualRate('2026-09-10', 41);
    await setPin('4821', FAST);
    await updateSettings({ displayCurrency: 'USD' });
    await loadDemoData('2026-09-16');

    const file = await prepareBackup('clave-segura-1', FAST);
    expect(file.filename).toMatch(/^finanzas-respaldo-\d{4}-\d{2}-\d{2}\.json$/);
    expect(file.text).not.toContain('Comida');
    expect(file.text).not.toContain('pinHash');
    expect(file.counts).toEqual({ transactions: 1, categories: 1 });

    await expect(readBackup(file.text)).rejects.toBeInstanceOf(PasswordRequiredError);
    await expect(readBackup(file.text, 'otra-clave-1')).rejects.toBeInstanceOf(WrongPasswordError);
    const { payload } = await readBackup(file.text, 'clave-segura-1');
    expect(payload.transactions.map((t) => t.amount)).toEqual([1890]);
    expect(JSON.stringify(payload)).not.toContain('pinHash');

    // en "otro dispositivo": todo borrado, se importa reemplazando
    await wipeAllData();
    await importBackup(payload, 'replace');
    expect(await db.transactions.count()).toBe(1);
    expect((await getSettings()).displayCurrency).toBe('USD');
    expect((await db.rates.toArray()).some((r) => r.source === 'manual' && r.buy === 41)).toBe(true);
    expect((await getSettings()).pinHash).toBeUndefined();
  });

  it('un movimiento real en una categoría de ejemplo entra en el respaldo', async () => {
    await loadDemoData('2026-09-16');
    const antel = (await db.categories.filter((c) => c.name === 'Antel').first())!;
    await saveTransaction({ kind: 'expense', group: 'fixed', amount: 1690, currency: 'UYU', date: '2026-09-10', categoryId: antel.id });
    const { payload } = await readBackup((await prepareBackup('clave-segura-1', FAST)).text, 'clave-segura-1');
    expect(payload.transactions.map((t) => t.amount)).toEqual([1690]);
    expect(payload.categories.map((c) => [c.name, c.isDemo])).toEqual([['Antel', undefined]]);
  });

  it('combinar no duplica', async () => {
    await gasto('Comida', 100);
    const { payload } = await readBackup((await prepareBackup('clave-segura-1', FAST)).text, 'clave-segura-1');
    await gasto('comida', 200);
    const stats = await importBackup(payload, 'merge');
    expect(stats.added).toBe(0);
    expect(await db.transactions.count()).toBe(2);
    expect(await db.categories.count()).toBe(1);
  });

  it('exige contraseña de al menos 8 caracteres', async () => {
    await expect(prepareBackup('corta', FAST)).rejects.toThrow(/8/);
  });

  it('CSV sin los datos demo', async () => {
    await gasto('Comida', 1890);
    await loadDemoData('2026-09-16');
    const csv = await prepareCsv();
    expect(csv.text.trim().split('\r\n')).toHaveLength(2);
    expect(csv.filename).toMatch(/\.csv$/);
  });

  it('borrar todo deja la base vacía', async () => {
    await gasto('Comida');
    await setPin('4821', FAST);
    await wipeAllData();
    expect(await db.transactions.count()).toBe(0);
    expect(await db.categories.count()).toBe(0);
    expect((await getSettings()).pinHash).toBeUndefined();
  });
});
