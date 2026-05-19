// crypto.randomUUID() is gated to "secure contexts" (HTTPS or localhost) in
// every major browser. When the demo is served over plain HTTP on a public
// IP, it's missing. crypto.getRandomValues() is available in all contexts,
// so we build a v4 UUID from random bytes.

declare global {
  interface Crypto {
    randomUUID(): `${string}-${string}-${string}-${string}-${string}`;
  }
}

if (typeof crypto !== 'undefined' && typeof crypto.randomUUID !== 'function') {
  const polyfill = (): `${string}-${string}-${string}-${string}-${string}` => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // RFC 4122 v4: set version (top nibble of byte 6 = 0100) and variant
    // (top two bits of byte 8 = 10).
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}` as `${string}-${string}-${string}-${string}-${string}`;
  };
  Object.defineProperty(crypto, 'randomUUID', {
    value: polyfill,
    writable: true,
    configurable: true,
  });
}

export {};
