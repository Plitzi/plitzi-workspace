import type { GuestBytes } from './bytes';
import type { Bytes, GuestHost } from './types';

/**
 * `crypto`: random values from the runner's CSPRNG, and a `crypto.subtle` of digests, HMAC and PBKDF2 the runner computes.
 *
 * Printed into the isolate on its own, as the guest is (`isolate.ts`): it may use nothing but its parameters.
 */
export const guestCrypto = (
  host: Pick<GuestHost, 'random' | 'crypto'>,
  { isRecord, bytesToBase64, base64ToBytes, copyBytes }: GuestBytes
) => {
  const getRandomValues = <T extends ArrayBufferView>(array: T): T => {
    if (array.byteLength > 65536) {
      throw new DOMException('At most 65536 bytes at a time', 'QuotaExceededError');
    }

    new Uint8Array(array.buffer, array.byteOffset, array.byteLength).set(host.random(array.byteLength));

    return array;
  };

  const randomUUID = (): string => {
    const bytes = getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');

    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };

  const HASHES = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];

  const nameOf = (algorithm: unknown): string => {
    const name = typeof algorithm === 'string' ? algorithm : isRecord(algorithm) ? algorithm.name : undefined;

    return typeof name === 'string' ? name.toUpperCase() : '';
  };

  const hashOf = (algorithm: unknown): string => {
    const upper = nameOf(algorithm);
    if (!HASHES.includes(upper)) {
      throw new DOMException(
        `${upper || String(algorithm)} is not a supported hash (${HASHES.join(', ')})`,
        'NotSupportedError'
      );
    }

    return upper;
  };

  /** An HMAC key's length when its algorithm names none: the hash's block, as Web Crypto has it. */
  const blockBitsOf = (hash: string): number => (hash === 'SHA-384' || hash === 'SHA-512' ? 1024 : 512);

  type KeyAlgorithm = { name: 'HMAC'; hash: { name: string } } | { name: 'PBKDF2' };

  /**
   * The two kinds of key this runtime's `crypto.subtle` makes: HMAC, what signing a webhook needs, and PBKDF2, a
   * password to derive from — what keeping a password needs.
   */
  class GuestCryptoKey {
    readonly type = 'secret';
    readonly algorithm: KeyAlgorithm;
    readonly extractable: boolean;
    readonly usages: string[];
    readonly raw: Bytes;

    constructor(raw: Bytes, algorithm: KeyAlgorithm, extractable: boolean, usages: string[]) {
      this.raw = raw;
      this.algorithm = algorithm;
      this.extractable = extractable;
      this.usages = usages;
    }
  }

  const bytesOf = (data: unknown): Bytes => {
    if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
      return copyBytes(data);
    }

    throw new TypeError('crypto.subtle takes bytes: an ArrayBuffer or a typed array');
  };

  const cryptoCall = async (message: Record<string, string>): Promise<Bytes> => {
    const answer: unknown = JSON.parse(await host.crypto(JSON.stringify(message)));
    if (!isRecord(answer) || answer.ok !== true || typeof answer.value !== 'string') {
      throw new DOMException(
        isRecord(answer) && typeof answer.error === 'string' ? answer.error : 'The operation failed',
        'OperationError'
      );
    }

    return base64ToBytes(answer.value);
  };

  type KeyOf<N extends KeyAlgorithm['name']> = GuestCryptoKey & { algorithm: Extract<KeyAlgorithm, { name: N }> };

  const isKeyOf = <N extends KeyAlgorithm['name']>(key: unknown, name: N): key is KeyOf<N> =>
    key instanceof GuestCryptoKey && key.algorithm.name === name;

  /** The key an operation was handed, when it is of the kind the operation takes and was imported for it. */
  const keyFor = <N extends KeyAlgorithm['name']>(key: unknown, name: N, usage: string): KeyOf<N> => {
    if (!isKeyOf(key, name)) {
      throw new DOMException(`${usage} takes a ${name} key, from crypto.subtle.importKey`, 'InvalidAccessError');
    }

    if (!key.usages.includes(usage)) {
      throw new DOMException(`The key was not imported for ${usage}`, 'InvalidAccessError');
    }

    return key;
  };

  const hmacOf = (key: unknown, usage: 'sign' | 'verify', data: unknown): Promise<Bytes> => {
    const { algorithm, raw } = keyFor(key, 'HMAC', usage);

    return cryptoCall({
      op: 'hmac',
      hash: algorithm.hash.name,
      key: bytesToBase64(raw),
      data: bytesToBase64(bytesOf(data))
    });
  };

  /** How many rounds and bits a derivation may take is the runner's to say: it is the one doing the work. */
  const pbkdf2Of = (algorithm: unknown, baseKey: unknown, bits: unknown, usage: string): Promise<Bytes> => {
    if (!isRecord(algorithm) || nameOf(algorithm) !== 'PBKDF2') {
      throw new DOMException('This runtime derives with PBKDF2 only', 'NotSupportedError');
    }

    const { raw } = keyFor(baseKey, 'PBKDF2', usage);
    if (typeof algorithm.iterations !== 'number' || typeof bits !== 'number') {
      throw new TypeError('PBKDF2 takes { name, hash, salt, iterations } and a length in bits');
    }

    return cryptoCall({
      op: 'pbkdf2',
      hash: hashOf(algorithm.hash),
      key: bytesToBase64(raw),
      salt: bytesToBase64(bytesOf(algorithm.salt)),
      iterations: String(algorithm.iterations),
      bits: String(bits)
    });
  };

  /** The key `importKey` makes — thrown, not answered, when it is none this runtime has. */
  const importedKey = (
    format: string,
    keyData: unknown,
    algorithm: unknown,
    extractable: boolean,
    usages: string[]
  ): GuestCryptoKey => {
    const name = nameOf(algorithm);
    if (format === 'raw' && name === 'HMAC' && isRecord(algorithm)) {
      return new GuestCryptoKey(
        bytesOf(keyData),
        { name, hash: { name: hashOf(algorithm.hash) } },
        extractable,
        usages
      );
    }

    if (format === 'raw' && name === 'PBKDF2') {
      if (extractable) {
        throw new DOMException('A PBKDF2 key is never extractable', 'SyntaxError');
      }

      return new GuestCryptoKey(bytesOf(keyData), { name }, false, usages);
    }

    throw new DOMException(
      'This runtime imports raw keys for HMAC and PBKDF2 only (format "raw", { name: "HMAC", hash } or "PBKDF2")',
      'NotSupportedError'
    );
  };

  const subtle = {
    digest: async (algorithm: unknown, data: unknown): Promise<ArrayBuffer> =>
      (await cryptoCall({ op: 'digest', hash: hashOf(algorithm), data: bytesToBase64(bytesOf(data)) })).buffer,
    importKey: (
      format: string,
      keyData: unknown,
      algorithm: unknown,
      extractable: boolean,
      usages: string[]
    ): Promise<GuestCryptoKey> =>
      new Promise(resolve => {
        resolve(importedKey(format, keyData, algorithm, extractable, usages));
      }),
    sign: async (_algorithm: unknown, key: unknown, data: unknown): Promise<ArrayBuffer> =>
      (await hmacOf(key, 'sign', data)).buffer,
    verify: async (_algorithm: unknown, key: unknown, signature: unknown, data: unknown): Promise<boolean> => {
      const expected = await hmacOf(key, 'verify', data);
      const given = bytesOf(signature);
      let difference = expected.length ^ given.length;
      expected.forEach((byte, index) => {
        difference |= byte ^ (given[index] ?? 0);
      });

      return difference === 0;
    },
    deriveBits: async (algorithm: unknown, baseKey: unknown, length: unknown): Promise<ArrayBuffer> =>
      (await pbkdf2Of(algorithm, baseKey, length, 'deriveBits')).buffer,
    /** Derives an HMAC key — the one other kind this runtime has. */
    deriveKey: async (
      algorithm: unknown,
      baseKey: unknown,
      derivedKeyAlgorithm: unknown,
      extractable: boolean,
      usages: string[]
    ): Promise<GuestCryptoKey> => {
      if (!isRecord(derivedKeyAlgorithm) || nameOf(derivedKeyAlgorithm) !== 'HMAC') {
        throw new DOMException('This runtime derives HMAC keys only', 'NotSupportedError');
      }

      const hash = hashOf(derivedKeyAlgorithm.hash);
      const length = derivedKeyAlgorithm.length ?? blockBitsOf(hash);
      const raw = await pbkdf2Of(algorithm, baseKey, length, 'deriveKey');

      return new GuestCryptoKey(raw, { name: 'HMAC', hash: { name: hash } }, extractable, usages);
    }
  };

  return { getRandomValues, randomUUID, subtle };
};

export type GuestCrypto = ReturnType<typeof guestCrypto>;
