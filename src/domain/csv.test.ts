import { describe, expect, it } from 'vitest';
import { csvText, transactionsToCsv } from './csv';
import type { Category, Transaction } from './types';

describe('csvText', () => {
  it('protege contra fórmulas y escapa separadores', () => {
    expect(csvText('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvText('+54')).toBe("'+54");
    expect(csvText('@cmd')).toBe("'@cmd");
    expect(csvText('a;b')).toBe('"a;b"');
    expect(csvText('línea\nnueva')).toBe('línea nueva');
    expect(csvText('Supermercado')).toBe('Supermercado');
  });
});

describe('transactionsToCsv', () => {
  it('formato para Excel en español', () => {
    const cat: Category = {
      id: 'c1',
      kind: 'expense',
      group: 'fixed',
      name: 'Alquiler',
      normalizedName: 'alquiler',
      color: '#000000',
      usageCount: 1,
      archived: false,
      createdAt: '',
    };
    const tx: Transaction = {
      id: 't1',
      kind: 'expense',
      amount: 28000.5,
      currency: 'UYU',
      rateAtDate: 40.1,
      amountUYU: 28000.5,
      amountUSD: 698.27,
      categoryId: 'c1',
      date: '2026-09-05',
      note: 'Setiembre; con aumento',
      status: 'confirmed',
      createdAt: '',
      updatedAt: '',
    };
    const csv = transactionsToCsv([tx], new Map([['c1', cat]]));
    expect(csv.startsWith('﻿Fecha;Tipo;Grupo;Categoría;Nota;Monto;Moneda;Cotización;Monto UYU;Monto USD;Estado\r\n')).toBe(true);
    expect(csv).toContain('2026-09-05;Gasto;Fijo;Alquiler;"Setiembre; con aumento";28000,50;UYU;40,1000;28000,50;698,27;Confirmado');
  });
});
