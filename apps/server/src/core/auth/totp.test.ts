import { describe, expect, it } from 'vitest';

import {
  generateRecoveryCodes,
  generateTotpSecret,
  normalizeRecoveryCode,
  randomCode,
  totpCode,
  totpUri,
  verifyTotp
} from './totp';

describe('TOTP', () => {
  /**
   * RFC 6238's own test vector, with the ASCII secret `12345678901234567890` written in base32. If this drifts,
   * every authenticator app in the world disagrees with us and nobody can sign in — which is exactly the kind of
   * thing that must be pinned to the standard rather than to our own output.
   */
  const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

  it('matches the RFC 6238 vectors', () => {
    expect(totpCode(RFC_SECRET, 59_000)).toBe('287082');
    expect(totpCode(RFC_SECRET, 1_111_111_109_000)).toBe('081804');
    expect(totpCode(RFC_SECRET, 1_234_567_890_000)).toBe('005924');
  });

  it('accepts the code an app would be showing', () => {
    const secret = generateTotpSecret();

    expect(verifyTotp(secret, totpCode(secret))).toBe(true);
  });

  it('refuses a code from another secret', () => {
    expect(verifyTotp(generateTotpSecret(), totpCode(generateTotpSecret()))).toBe(false);
  });

  /** Thirty seconds of tolerance, for a clock that drifts and for somebody who starts typing at second twenty-nine. */
  it('accepts one step either side and nothing beyond', () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000_000;

    expect(verifyTotp(secret, totpCode(secret, now - 30_000), { at: now })).toBe(true);
    expect(verifyTotp(secret, totpCode(secret, now + 30_000), { at: now })).toBe(true);
    expect(verifyTotp(secret, totpCode(secret, now - 120_000), { at: now })).toBe(false);
  });

  it('refuses anything that is not six digits, without throwing', () => {
    const secret = generateTotpSecret();

    for (const bad of ['', '12345', '1234567', 'abcdef', '12 34 56', '<script>']) {
      expect(verifyTotp(secret, bad)).toBe(false);
    }
  });

  it('mints a secret authenticator apps can read', () => {
    expect(generateTotpSecret()).toMatch(/^[A-Z2-7]{32}$/);
  });

  it('builds an enrolment URI that names the issuer twice, as apps expect', () => {
    const uri = totpUri({ secret: RFC_SECRET, account: 'ada@example.test', issuer: 'Acme' });

    expect(uri).toMatch(/^otpauth:\/\/totp\/Acme%3Aada%40example\.test\?/);
    expect(uri).toContain(`secret=${RFC_SECRET}`);
    expect(uri).toContain('issuer=Acme');
    expect(uri).toContain('period=30');
  });
});

describe('recovery codes', () => {
  it('mints ten distinct readable codes', () => {
    const codes = generateRecoveryCodes();

    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z2-7]{5}-[A-Z2-7]{5}$/);
    }
  });

  /** Whether somebody types the hyphen, or types it in lower case, must not decide whether they get back in. */
  it('normalises away the shapes a person actually types', () => {
    expect(normalizeRecoveryCode(' abcde-fghij ')).toBe('ABCDEFGHIJ');
    expect(normalizeRecoveryCode('ABCDEFGHIJ')).toBe('ABCDEFGHIJ');
  });
});

describe('randomCode', () => {
  it('is the length asked for, over the alphabet given', () => {
    expect(randomCode(6)).toMatch(/^[A-Z2-7]{6}$/);
    expect(randomCode(4, '0123456789')).toMatch(/^\d{4}$/);
  });

  /**
   * The trap this exists to avoid: `byte % alphabet.length` over-represents the first `256 % length` characters,
   * and a token that gates an account must draw every character with equal probability. A crude uniformity check
   * over a large sample is enough to catch a modulo-biased implementation.
   */
  it('draws every character of a biasing alphabet at a comparable rate', () => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const counts = new Map<string, number>();

    for (const character of randomCode(36_000, alphabet)) {
      counts.set(character, (counts.get(character) ?? 0) + 1);
    }

    expect(counts.size).toBe(alphabet.length);
    for (const count of counts.values()) {
      // Expected 1000 each; a modulo-biased draw over 36 characters skews the first four by ~14%.
      expect(count).toBeGreaterThan(830);
      expect(count).toBeLessThan(1170);
    }
  });
});
