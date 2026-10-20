// btoa/atob operate on Latin1, so a raw multibyte string would be mis-encoded (and code points > 255 throw).
// Round-tripping through the UTF-8 byte sequence keeps `base64_encode`/`base64_decode` correct for any string.
export const utf8ToBase64 = (str: string): string => {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
};

export const base64ToUtf8 = (str: string): string => {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new TextDecoder().decode(bytes);
};

// RFC 1321 MD5 over the UTF-8 bytes of the input. Dependency-free so it behaves identically in the browser
// (builder) and Node, and deterministic so template output stays stable.
export const md5Hex = (input: string): string => {
  const shifts = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15,
    21
  ];
  const sines = new Uint32Array(64);
  for (let i = 0; i < 64; i++) {
    sines[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296);
  }

  const msg = new TextEncoder().encode(input);
  const bitLen = msg.length * 8;
  const paddedLen = (((msg.length + 8) >> 6) + 1) << 6;
  const bytes = new Uint8Array(paddedLen);
  bytes.set(msg);
  bytes[msg.length] = 0x80;
  const view = new DataView(bytes.buffer);
  view.setUint32(paddedLen - 8, bitLen >>> 0, true);
  view.setUint32(paddedLen - 4, Math.floor(bitLen / 4294967296) >>> 0, true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const rotl = (x: number, c: number): number => (x << c) | (x >>> (32 - c));

  for (let chunk = 0; chunk < paddedLen; chunk += 64) {
    const words = new Uint32Array(16);
    for (let i = 0; i < 16; i++) {
      words[i] = view.getUint32(chunk + i * 4, true);
    }

    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;
    for (let i = 0; i < 64; i++) {
      let f: number;
      let g: number;
      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
      }

      f = (f + a + sines[i] + words[g]) | 0;
      a = d;
      d = c;
      c = b;
      b = (b + rotl(f, shifts[i])) | 0;
    }

    a0 = (a0 + a) | 0;
    b0 = (b0 + b) | 0;
    c0 = (c0 + c) | 0;
    d0 = (d0 + d) | 0;
  }

  const toHexLE = (x: number): string => {
    let hex = '';
    for (let i = 0; i < 4; i++) {
      hex += ((x >>> (i * 8)) & 0xff).toString(16).padStart(2, '0');
    }

    return hex;
  };

  return toHexLE(a0) + toHexLE(b0) + toHexLE(c0) + toHexLE(d0);
};
