import { describe, expect, it } from 'vitest';
import { derToRawEcdsa } from './webauthn';

describe('derToRawEcdsa', () => {
  it('convierte una firma real (con y sin byte de relleno) y verifica', async () => {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const data = new TextEncoder().encode('desafío');
    const raw = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, data));
    // Armar el DER como lo manda el iPhone
    const int = (b: Uint8Array) => {
      let x = Array.from(b);
      while (x.length > 1 && x[0] === 0 && x[1] < 0x80) x = x.slice(1);
      if (x[0] >= 0x80) x = [0, ...x];
      return [0x02, x.length, ...x];
    };
    const body = [...int(raw.subarray(0, 32)), ...int(raw.subarray(32))];
    const der = new Uint8Array([0x30, body.length, ...body]);
    const back = derToRawEcdsa(der);
    expect(Array.from(back)).toEqual(Array.from(raw));
    expect(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pair.publicKey, back, data)).toBe(true);
  });

  it('rechaza basura', () => {
    expect(() => derToRawEcdsa(new Uint8Array([1, 2, 3]))).toThrow();
  });
});
