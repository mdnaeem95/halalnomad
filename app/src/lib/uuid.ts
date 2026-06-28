/**
 * Client-side UUID v4.
 *
 * Deliberately dependency-free: adding `expo-crypto` would pull in a native
 * module and break the "everything ships as an OTA this wave" constraint for
 * Trip Planning M1. We prefer a real CSPRNG when the runtime exposes one
 * (Hermes/JSC sometimes do via `crypto.getRandomValues`) and fall back to
 * `Math.random`. These IDs are list primary keys used as idempotency keys, not
 * security tokens — at our scale the fallback's collision risk is negligible.
 */

function randomBytes(n: number): Uint8Array {
  const bytes = new Uint8Array(n);
  const g = globalThis as unknown as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } };
  if (g.crypto?.getRandomValues) {
    g.crypto.getRandomValues(bytes);
    return bytes;
  }
  for (let i = 0; i < n; i++) bytes[i] = Math.floor(Math.random() * 256);
  return bytes;
}

const HEX: string[] = Array.from({ length: 256 }, (_, i) => (i + 0x100).toString(16).slice(1));

export function uuidv4(): string {
  const b = randomBytes(16);
  // Per RFC 4122 §4.4: set version (4) and variant (10xx) bits.
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  return (
    HEX[b[0]] + HEX[b[1]] + HEX[b[2]] + HEX[b[3]] + '-' +
    HEX[b[4]] + HEX[b[5]] + '-' +
    HEX[b[6]] + HEX[b[7]] + '-' +
    HEX[b[8]] + HEX[b[9]] + '-' +
    HEX[b[10]] + HEX[b[11]] + HEX[b[12]] + HEX[b[13]] + HEX[b[14]] + HEX[b[15]]
  );
}
