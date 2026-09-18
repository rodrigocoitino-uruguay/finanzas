/**
 * Criptografía con la Web Crypto API del navegador (sin librerías externas).
 * Requiere contexto seguro (https o localhost).
 */

/** Recomendación OWASP para PBKDF2-HMAC-SHA256. */
export const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export class WrongPasswordError extends Error {
  override name = 'WrongPasswordError';
  constructor() {
    super('Contraseña incorrecta o archivo dañado');
  }
}

export function isCryptoAvailable(): boolean {
  return typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.subtle !== 'undefined';
}

export function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  return globalThis.crypto.getRandomValues(new Uint8Array(n));
}

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  return fromBase64(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
}

/** Comparación en tiempo constante (no revela en qué byte difieren). */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function pbkdf2Key(secret: string): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, [
    'deriveBits',
    'deriveKey',
  ]);
}

export interface PinHash {
  hash: string;
  salt: string;
  iterations: number;
}

/** Hash del PIN con PBKDF2-SHA256 y sal aleatoria. El PIN nunca se guarda. */
export async function hashPin(pin: string, iterations = PBKDF2_ITERATIONS, salt = randomBytes(SALT_BYTES)): Promise<PinHash> {
  const bits = await globalThis.crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    await pbkdf2Key(pin),
    256,
  );
  return { hash: toBase64(new Uint8Array(bits)), salt: toBase64(salt), iterations };
}

export async function verifyPin(pin: string, stored: PinHash): Promise<boolean> {
  const { hash } = await hashPin(pin, stored.iterations, fromBase64(stored.salt));
  return timingSafeEqual(fromBase64(hash), fromBase64(stored.hash));
}

async function aesKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  return globalThis.crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    await pbkdf2Key(password),
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export interface EncryptedEnvelope {
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string };
  cipher: { name: 'AES-GCM'; iv: string };
  data: string;
}

/** Cifra un texto con AES-256-GCM y una clave derivada de la contraseña. */
export async function encryptText(
  plaintext: string,
  password: string,
  iterations = PBKDF2_ITERATIONS,
): Promise<EncryptedEnvelope> {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = await aesKey(password, salt, iterations);
  const data = await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));
  return {
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: toBase64(salt) },
    cipher: { name: 'AES-GCM', iv: toBase64(iv) },
    data: toBase64(new Uint8Array(data)),
  };
}

/** Descifra; si la contraseña no es la correcta (o el archivo se alteró) tira WrongPasswordError. */
export async function decryptText(env: EncryptedEnvelope, password: string): Promise<string> {
  if (env.kdf?.name !== 'PBKDF2' || env.cipher?.name !== 'AES-GCM') throw new Error('Formato de cifrado desconocido');
  const iterations = Number(env.kdf.iterations);
  if (!Number.isInteger(iterations) || iterations < 10_000 || iterations > 10_000_000) {
    throw new Error('Parámetros de cifrado inválidos');
  }
  const key = await aesKey(password, fromBase64(env.kdf.salt), iterations);
  try {
    const plain = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(env.cipher.iv) },
      key,
      fromBase64(env.data),
    );
    return new TextDecoder().decode(plain);
  } catch {
    throw new WrongPasswordError();
  }
}
