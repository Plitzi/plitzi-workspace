import { createHash, createHmac, pbkdf2Sync } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { guestBytes } from './bytes';
import { guestCrypto } from './crypto';

/**
 * The guest's `crypto`, run in Node as it is printed into the isolate, over a host that computes what the runner would
 * — every rule the part states held here. What the runner itself bounds (rounds, bits) is the isolate's
 * suite (`isolate.test.ts`).
 */

const bytes = guestBytes();
const encode = (text: string) => new TextEncoder().encode(text);
const hex = (buffer: ArrayBuffer) => Buffer.from(buffer).toString('hex');

type Sent = Record<string, string | undefined>;

/** A host that answers as the runner does, and keeps what it was asked. */
const hostAnswering = (answer?: (sent: Sent) => unknown) => {
  const sent: Sent[] = [];
  const compute = (message: Sent): Buffer => {
    const data = Buffer.from(message.data ?? '', 'base64');
    const key = Buffer.from(message.key ?? '', 'base64');
    const hash = (message.hash ?? '').replace('-', '').toLowerCase();
    switch (message.op) {
      case 'digest':
        return createHash(hash).update(data).digest();
      case 'hmac':
        return createHmac(hash, key).update(data).digest();
      default:
        return pbkdf2Sync(
          key,
          Buffer.from(message.salt ?? '', 'base64'),
          Number(message.iterations),
          Number(message.bits) / 8,
          hash
        );
    }
  };

  return {
    sent,
    host: {
      random: (length: number) => Array.from({ length }, () => 0xff),
      crypto: (message: string) => {
        const parsed = JSON.parse(message) as Sent;
        sent.push(parsed);

        return Promise.resolve(
          JSON.stringify(answer ? answer(parsed) : { ok: true, value: compute(parsed).toString('base64') })
        );
      }
    }
  };
};

const named = async (attempt: () => unknown): Promise<string> => {
  try {
    await attempt();

    return 'no error';
  } catch (error) {
    return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  }
};

describe("the guest's random values", () => {
  it("fills the array from the runner's random bytes, 65536 at most at a time", () => {
    const { getRandomValues } = guestCrypto(hostAnswering().host, bytes);
    const filled = getRandomValues(new Uint16Array(2));

    expect([...filled]).toEqual([0xffff, 0xffff]);
    expect(() => getRandomValues(new Uint8Array(65537))).toThrow('At most 65536 bytes at a time');
  });

  it('makes a version 4 UUID, its version and variant set whatever the bytes were', () => {
    expect(guestCrypto(hostAnswering().host, bytes).randomUUID()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
  });
});

describe("the guest's crypto.subtle", () => {
  it('digests with the hashes it names, and refuses another by name', async () => {
    const { subtle } = guestCrypto(hostAnswering().host, bytes);

    expect(hex(await subtle.digest('sha-256', encode('a')))).toBe(createHash('sha256').update('a').digest('hex'));
    expect(await named(() => subtle.digest('MD5', encode('a')))).toBe(
      'NotSupportedError: MD5 is not a supported hash (SHA-1, SHA-256, SHA-384, SHA-512)'
    );
    expect(await named(() => subtle.digest('SHA-256', 'a string'))).toBe(
      'TypeError: crypto.subtle takes bytes: an ArrayBuffer or a typed array'
    );
  });

  it("says the runner's refusal as an OperationError, in the runner's words when it gave some", async () => {
    const said = guestCrypto(hostAnswering(() => ({ ok: false, error: 'Too many rounds' })).host, bytes);
    const garbled = guestCrypto(hostAnswering(() => ({ ok: true })).host, bytes);

    expect(await named(() => said.subtle.digest('SHA-256', encode('a')))).toBe('OperationError: Too many rounds');
    expect(await named(() => garbled.subtle.digest('SHA-256', encode('a')))).toBe(
      'OperationError: The operation failed'
    );
  });

  it('imports raw HMAC and PBKDF2 keys alone, and a PBKDF2 key never extractable', async () => {
    const { subtle } = guestCrypto(hostAnswering().host, bytes);

    expect(await named(() => subtle.importKey('jwk', encode('k'), { name: 'HMAC', hash: 'SHA-256' }, false, []))).toBe(
      'NotSupportedError: This runtime imports raw keys for HMAC and PBKDF2 only (format "raw", { name: "HMAC", hash } or "PBKDF2")'
    );
    expect(await named(() => subtle.importKey('raw', encode('k'), 'AES-GCM', false, []))).toContain(
      'NotSupportedError'
    );
    expect(await named(() => subtle.importKey('raw', encode('pw'), 'PBKDF2', true, ['deriveBits']))).toBe(
      'SyntaxError: A PBKDF2 key is never extractable'
    );
  });

  it('signs and verifies with HMAC, and verifies false on any byte or length that differs', async () => {
    const { subtle } = guestCrypto(hostAnswering().host, bytes);
    const key = await subtle.importKey('raw', encode('k'), { name: 'HMAC', hash: 'SHA-256' }, false, [
      'sign',
      'verify'
    ]);
    const signature = await subtle.sign('HMAC', key, encode('board'));
    const tampered = new Uint8Array(signature).slice();
    tampered[0] ^= 1;

    expect(hex(signature)).toBe(createHmac('sha256', 'k').update('board').digest('hex'));
    expect(await subtle.verify('HMAC', key, signature, encode('board'))).toBe(true);
    expect(await subtle.verify('HMAC', key, tampered, encode('board'))).toBe(false);
    expect(await subtle.verify('HMAC', key, new Uint8Array(signature).slice(0, 31), encode('board'))).toBe(false);
  });

  it('derives with PBKDF2 alone, from a PBKDF2 key, with its rounds and length said', async () => {
    const { subtle } = guestCrypto(hostAnswering().host, bytes);
    const password = await subtle.importKey('raw', encode('pw'), 'PBKDF2', false, ['deriveBits']);
    const pbkdf2 = { name: 'PBKDF2', hash: 'SHA-256', salt: encode('salt'), iterations: 10 };

    expect(hex(await subtle.deriveBits(pbkdf2, password, 256))).toBe(
      pbkdf2Sync('pw', 'salt', 10, 32, 'sha256').toString('hex')
    );
    expect(await named(() => subtle.deriveBits({ name: 'HKDF' }, password, 256))).toBe(
      'NotSupportedError: This runtime derives with PBKDF2 only'
    );
    expect(
      await named(() => subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: encode('s') }, password, 256))
    ).toBe('TypeError: PBKDF2 takes { name, hash, salt, iterations } and a length in bits');
  });

  it("derives an HMAC key alone, as long as its hash's block when its algorithm names no length", async () => {
    const { host, sent } = hostAnswering();
    const { subtle } = guestCrypto(host, bytes);
    const password = await subtle.importKey('raw', encode('pw'), 'PBKDF2', false, ['deriveKey']);
    const pbkdf2 = { name: 'PBKDF2', hash: 'SHA-256', salt: encode('salt'), iterations: 10 };

    const key = await subtle.deriveKey(pbkdf2, password, { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);

    expect(key.algorithm).toEqual({ name: 'HMAC', hash: { name: 'SHA-512' } });
    expect(sent.at(-1)?.bits).toBe('1024');
    expect(await named(() => subtle.deriveKey(pbkdf2, password, { name: 'AES-GCM' }, false, []))).toBe(
      'NotSupportedError: This runtime derives HMAC keys only'
    );
  });
});
