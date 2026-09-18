import { hashPin, verifyPin, PBKDF2_ITERATIONS } from '../lib/crypto';
import { getMeta, setMeta } from './meta';
import { getSettings, updateSettings } from './settings';
import { ValidationError } from './transactions';

const ATTEMPTS_KEY = 'pinAttempts';
export const FREE_ATTEMPTS = 5;
const BASE_WAIT_MS = 30_000;
const MAX_WAIT_MS = 15 * 60_000;

interface Attempts {
  failures: number;
  lockedUntil?: number;
}

/** Espera después de fallar: 5 intentos libres, luego 30 s, 1 min, 2 min… hasta 15 min. */
export function lockoutMs(failures: number): number {
  if (failures < FREE_ATTEMPTS) return 0;
  return Math.min(MAX_WAIT_MS, BASE_WAIT_MS * 2 ** (failures - FREE_ATTEMPTS));
}

export function isValidPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

export async function hasPin(): Promise<boolean> {
  return Boolean((await getSettings()).pinHash);
}

export async function setPin(pin: string, iterations = PBKDF2_ITERATIONS): Promise<void> {
  if (!isValidPin(pin)) throw new ValidationError('El PIN tiene que tener de 4 a 6 números');
  const h = await hashPin(pin, iterations);
  await updateSettings({ pinHash: h.hash, pinSalt: h.salt, pinIterations: h.iterations, pinLength: pin.length });
  await setMeta(ATTEMPTS_KEY, { failures: 0 } satisfies Attempts);
}

export interface PinCheck {
  ok: boolean;
  /** ms que faltan para poder volver a intentar. */
  waitMs: number;
  failures: number;
}

/** Verifica el PIN con espera creciente tras varios errores (guardada: recargar no la saltea). */
export async function checkPin(pin: string, now = Date.now()): Promise<PinCheck> {
  const attempts = (await getMeta<Attempts>(ATTEMPTS_KEY)) ?? { failures: 0 };
  if (attempts.lockedUntil && attempts.lockedUntil > now) {
    return { ok: false, waitMs: attempts.lockedUntil - now, failures: attempts.failures };
  }
  const s = await getSettings();
  if (!s.pinHash || !s.pinSalt) return { ok: true, waitMs: 0, failures: 0 };
  const ok = await verifyPin(pin, { hash: s.pinHash, salt: s.pinSalt, iterations: s.pinIterations ?? PBKDF2_ITERATIONS });
  if (ok) {
    await setMeta(ATTEMPTS_KEY, { failures: 0 } satisfies Attempts);
    return { ok: true, waitMs: 0, failures: 0 };
  }
  const failures = attempts.failures + 1;
  const wait = lockoutMs(failures);
  await setMeta(ATTEMPTS_KEY, { failures, lockedUntil: wait ? now + wait : undefined } satisfies Attempts);
  return { ok: false, waitMs: wait, failures };
}

export async function currentWaitMs(now = Date.now()): Promise<number> {
  const a = await getMeta<Attempts>(ATTEMPTS_KEY);
  return a?.lockedUntil && a.lockedUntil > now ? a.lockedUntil - now : 0;
}

/** Quita el PIN y Face ID. */
export async function removePin(): Promise<void> {
  await updateSettings({
    pinHash: undefined,
    pinSalt: undefined,
    pinIterations: undefined,
    pinLength: undefined,
    webauthnCredentialId: undefined,
    webauthnPublicKey: undefined,
    webauthnAlg: undefined,
  });
  await setMeta(ATTEMPTS_KEY, { failures: 0 } satisfies Attempts);
}

export async function savePasskey(credentialId: string, publicKey?: string, alg?: number): Promise<void> {
  await updateSettings({ webauthnCredentialId: credentialId, webauthnPublicKey: publicKey, webauthnAlg: alg });
}

export async function removePasskey(): Promise<void> {
  await updateSettings({ webauthnCredentialId: undefined, webauthnPublicKey: undefined, webauthnAlg: undefined });
}
