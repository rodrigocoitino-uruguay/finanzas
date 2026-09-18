import { describe, expect, it } from 'vitest';
import {
  decryptText,
  encryptText,
  fromBase64,
  fromBase64Url,
  hashPin,
  timingSafeEqual,
  toBase64,
  toBase64Url,
  verifyPin,
  WrongPasswordError,
} from './crypto';

// En los tests se usan menos iteraciones para que corran rápido; la app usa 600.000.
const FAST = 10_000;

describe('base64', () => {
  it('ida y vuelta, también en formato URL', () => {
    const bytes = new Uint8Array([0, 1, 250, 251, 252, 253, 254, 255]);
    expect(Array.from(fromBase64(toBase64(bytes)))).toEqual(Array.from(bytes));
    expect(toBase64Url(bytes)).not.toMatch(/[+/=]/);
    expect(Array.from(fromBase64Url(toBase64Url(bytes)))).toEqual(Array.from(bytes));
  });
});

describe('timingSafeEqual', () => {
  it('compara bytes', () => {
    expect(timingSafeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true);
    expect(timingSafeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false);
    expect(timingSafeEqual(new Uint8Array([1]), new Uint8Array([1, 2]))).toBe(false);
  });
});

describe('PIN', () => {
  it('guarda solo el hash y verifica', async () => {
    const stored = await hashPin('4821', FAST);
    expect(stored.hash).not.toContain('4821');
    expect(fromBase64(stored.salt)).toHaveLength(16);
    expect(await verifyPin('4821', stored)).toBe(true);
    expect(await verifyPin('4822', stored)).toBe(false);
    expect(await verifyPin('482', stored)).toBe(false);
  });

  it('la sal hace que el mismo PIN dé hashes distintos', async () => {
    const a = await hashPin('1234', FAST);
    const b = await hashPin('1234', FAST);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe('cifrado del respaldo', () => {
  it('ida y vuelta con la contraseña correcta', async () => {
    const env = await encryptText('{"hola":"mundo"}', 'una contraseña larga', FAST);
    expect(env.data).not.toContain('hola');
    expect(await decryptText(env, 'una contraseña larga')).toBe('{"hola":"mundo"}');
  });

  it('contraseña incorrecta o archivo alterado: error claro', async () => {
    const env = await encryptText('secreto', 'correcta-123', FAST);
    await expect(decryptText(env, 'otra-cosa')).rejects.toBeInstanceOf(WrongPasswordError);
    const tampered = { ...env, data: toBase64(fromBase64(env.data).map((b, i) => (i === 0 ? b ^ 1 : b))) };
    await expect(decryptText(tampered, 'correcta-123')).rejects.toBeInstanceOf(WrongPasswordError);
  });

  it('rechaza parámetros absurdos', async () => {
    const env = await encryptText('x', 'correcta-123', FAST);
    await expect(decryptText({ ...env, kdf: { ...env.kdf, iterations: 1 } }, 'correcta-123')).rejects.toThrow(/inválidos/);
  });
});
