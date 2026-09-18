/**
 * Desbloqueo con Face ID / Touch ID usando WebAuthn (llave de acceso del dispositivo).
 * Sin servidor: se genera un desafío aleatorio, el iPhone lo firma tras verificar tu cara
 * o huella, y la app comprueba la firma con la clave pública guardada al activarlo.
 */
import { fromBase64, fromBase64Url, randomBytes, timingSafeEqual, toBase64, toBase64Url } from './crypto';

const ES256 = -7;
const RS256 = -257;

export async function isPlatformAuthAvailable(): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !window.isSecureContext || !window.PublicKeyCredential) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export interface RegisteredPasskey {
  credentialId: string;
  publicKey?: string;
  alg?: number;
}

export async function registerPasskey(): Promise<RegisteredPasskey> {
  const cred = (await navigator.credentials.create({
    publicKey: {
      rp: { name: 'Finanzas', id: location.hostname },
      user: { id: randomBytes(16), name: 'Finanzas', displayName: 'Finanzas' },
      challenge: randomBytes(32),
      pubKeyCredParams: [
        { type: 'public-key', alg: ES256 },
        { type: 'public-key', alg: RS256 },
      ],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
      attestation: 'none',
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error('No se pudo activar');
  const response = cred.response as AuthenticatorAttestationResponse;
  const pk = typeof response.getPublicKey === 'function' ? response.getPublicKey() : null;
  const alg = typeof response.getPublicKeyAlgorithm === 'function' ? response.getPublicKeyAlgorithm() : undefined;
  return {
    credentialId: toBase64Url(new Uint8Array(cred.rawId)),
    publicKey: pk ? toBase64(new Uint8Array(pk)) : undefined,
    alg,
  };
}

/** Firma ECDSA en DER → formato r||s que usa Web Crypto. */
export function derToRawEcdsa(der: Uint8Array, size = 32): Uint8Array<ArrayBuffer> {
  if (der[0] !== 0x30) throw new Error('Firma inválida');
  let offset = 2;
  const read = () => {
    if (der[offset] !== 0x02) throw new Error('Firma inválida');
    const len = der[offset + 1];
    let int = der.subarray(offset + 2, offset + 2 + len);
    offset += 2 + len;
    while (int.length > size && int[0] === 0) int = int.subarray(1);
    if (int.length > size) throw new Error('Firma inválida');
    const out = new Uint8Array(size);
    out.set(int, size - int.length);
    return out;
  };
  const r = read();
  const s = read();
  const raw = new Uint8Array(size * 2);
  raw.set(r, 0);
  raw.set(s, size);
  return raw;
}

async function sha256(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', data));
}

async function verifySignature(publicKeyB64: string, alg: number, data: Uint8Array<ArrayBuffer>, signature: Uint8Array<ArrayBuffer>) {
  const spki = fromBase64(publicKeyB64);
  if (alg === ES256) {
    const key = await crypto.subtle.importKey('spki', spki, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, derToRawEcdsa(signature), data);
  }
  if (alg === RS256) {
    const key = await crypto.subtle.importKey('spki', spki, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    return crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, data);
  }
  return false;
}

/** Pide Face ID / Touch ID y verifica la respuesta. true solo si todo coincide. */
export async function verifyPasskey(saved: RegisteredPasskey): Promise<boolean> {
  const challenge = randomBytes(32);
  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: location.hostname,
      allowCredentials: [{ type: 'public-key', id: fromBase64Url(saved.credentialId), transports: ['internal', 'hybrid'] }],
      userVerification: 'required',
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) return false;
  if (!timingSafeEqual(new Uint8Array(cred.rawId), fromBase64Url(saved.credentialId))) return false;

  const response = cred.response as AuthenticatorAssertionResponse;
  const clientDataBytes = new Uint8Array(response.clientDataJSON);
  const clientData = JSON.parse(new TextDecoder().decode(clientDataBytes)) as { type?: string; challenge?: string; origin?: string };
  if (clientData.type !== 'webauthn.get') return false;
  if (clientData.challenge !== toBase64Url(challenge)) return false;
  if (clientData.origin !== location.origin) return false;

  const authData = new Uint8Array(response.authenticatorData);
  const rpIdHash = await sha256(new TextEncoder().encode(location.hostname));
  if (!timingSafeEqual(authData.subarray(0, 32), rpIdHash)) return false;
  const flags = authData[32];
  const userPresent = (flags & 0x01) !== 0;
  const userVerified = (flags & 0x04) !== 0;
  if (!userPresent || !userVerified) return false;

  if (saved.publicKey && saved.alg !== undefined) {
    const signed = new Uint8Array(authData.length + 32);
    signed.set(authData, 0);
    signed.set(await sha256(clientDataBytes), authData.length);
    return verifySignature(saved.publicKey, saved.alg, signed, new Uint8Array(response.signature));
  }
  return true;
}
