import { describe, expect, it } from 'vitest';
import { amountToCanonical, displayAmount, parseAmount, sanitizeAmountInput } from './amount';

describe('parseAmount', () => {
  it('entiende el formato uruguayo', () => {
    expect(parseAmount('28.000')).toBe(28000);
    expect(parseAmount('1.250,50')).toBe(1250.5);
    expect(parseAmount('1890')).toBe(1890);
    expect(parseAmount('1890,5')).toBe(1890.5);
    expect(parseAmount('$ 6.500')).toBe(6500);
    expect(parseAmount('US$ 9,99')).toBe(9.99);
    expect(parseAmount('1.234.567,89')).toBe(1234567.89);
  });

  it('un solo punto con 1-2 decimales es coma decimal', () => {
    expect(parseAmount('1.5')).toBe(1.5);
    expect(parseAmount('39.05')).toBe(39.05);
    expect(parseAmount('0.500')).toBe(0.5);
  });

  it('rechaza basura', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('1,2,3')).toBeNull();
    expect(parseAmount('.')).toBeNull();
  });
});

describe('entrada del campo de monto', () => {
  it('muestra separadores de miles', () => {
    expect(displayAmount('28000')).toBe('28.000');
    expect(displayAmount('1250,5')).toBe('1.250,5');
    expect(displayAmount('0,')).toBe('0,');
    expect(displayAmount('')).toBe('');
  });

  it('limpia lo tecleado', () => {
    expect(sanitizeAmountInput('28.0001', '28.000')).toBe('280001');
    expect(sanitizeAmountInput('1.890,', '1.890')).toBe('1890,');
    expect(sanitizeAmountInput('1.890,555', '1.890,55')).toBe('1890,55');
    expect(sanitizeAmountInput('007', '00')).toBe('7');
    expect(sanitizeAmountInput(',5', '')).toBe('0,5');
    expect(sanitizeAmountInput('12a3', '12')).toBe('123');
  });

  it('un "." tecleado al final (teclado en inglés) es coma decimal', () => {
    expect(sanitizeAmountInput('1.890.', '1.890')).toBe('1890,');
    expect(sanitizeAmountInput('12.', '12')).toBe('12,');
    // si ya hay coma, se ignora
    expect(sanitizeAmountInput('12,5.', '12,5')).toBe('12,5');
  });

  it('pasa números a texto editable', () => {
    expect(amountToCanonical(28000)).toBe('28000');
    expect(amountToCanonical(1250.5)).toBe('1250,5');
    expect(amountToCanonical(9.99)).toBe('9,99');
    expect(amountToCanonical(0)).toBe('');
  });
});
