import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';

import { createTokens } from './tokens';

/**
 * Every credential is a JWT of registered claims (RFC 7519) plus `scope` (RFC 6749). They share one secret and one
 * algorithm, so `scope` is the only thing keeping a session token from being read as a space token. These tests hold
 * that line, and keep a pre-RFC-0010 token — bespoke `data`/`version`, no scope at all, so a public render credential
 * was indistinguishable from a write one — refused rather than reinterpreted.
 */

const SECRET = 'token-secret';
const ISSUER = 'https://this.test';

const {
  expiresInSeconds,
  generateRefreshToken,
  generateSpaceToken,
  generateUserToken,
  generateWidgetToken,
  needsRotation,
  verifyRefreshToken,
  verifySpaceToken,
  verifyUserToken,
  verifyWidgetToken
} = createTokens({ secret: SECRET, issuer: ISSUER, audience: ['https://api.this.test'] });

const signRaw = (payload: Record<string, unknown>): string =>
  jwt.sign({ iss: ISSUER, ...payload }, SECRET, { algorithm: 'HS256' });

describe('credentials', () => {
  it('round-trips a user token', () => {
    const result = verifyUserToken(generateUserToken(7));

    expect(result.ok && result.payload.sub).toBe('7');
    expect(result.ok && result.payload.scope).toBe('user');
  });

  it('round-trips a space token with its scope and origins', () => {
    const result = verifySpaceToken(generateSpaceToken(42, ['https://site.example.com'], 'agent'));

    expect(result.ok && result.payload.spaceId).toBe(42);
    expect(result.ok && result.payload.spaceScope).toBe('agent');
    expect(result.ok && result.payload.origins).toEqual(['https://site.example.com']);
  });

  // Both are legitimate for the public token, which is the point: a site deployed once wants no deadline, a
  // campaign page or an agency engagement wants one. Only this scope gets the choice.
  it('lets a render token be given a deadline, or none', () => {
    const forever = verifySpaceToken(generateSpaceToken(42, ['*']));
    const until = Math.floor(Date.now() / 1000) + 3600;
    const dated = verifySpaceToken(generateSpaceToken(42, ['*'], 'render', { expiresAt: until }));

    expect(forever.ok && forever.payload.exp).toBeUndefined();
    expect(dated.ok && dated.payload.exp).toBe(until);
  });

  it('treats a render token past its date as expired, not as broken', () => {
    const past = Math.floor(Date.now() / 1000) - 60;
    const token = generateSpaceToken(42, ['*'], 'render', { expiresAt: past });

    expect(verifySpaceToken(token)).toEqual({ ok: false, reason: 'expired' });
    // Expired is re-mintable, so the space can be given a working token again without losing its settings.
    expect(needsRotation(token)).toBe(true);
  });

  /**
   * The rule, held as an invariant rather than stated in prose: the public render token is the ONE credential allowed
   * to live forever, because it is the one whose expiry would take a site down. Everything else carries a deadline, and
   * a new kind added without one fails here.
   */
  it('gives every credential but the public one a deadline', () => {
    const expiring = [
      generateUserToken(7),
      generateRefreshToken(7),
      generateWidgetToken(),
      generateSpaceToken(42, ['*'], 'agent')
    ];

    for (const token of expiring) {
      expect(expiresInSeconds(token)).toBeGreaterThan(0);
    }

    expect(expiresInSeconds(generateSpaceToken(42, ['*'], 'render'))).toBeUndefined();
  });

  /**
   * A render token is embedded in a published site — often a SPA deployed once and left alone — so an expiry would be a
   * scheduled outage: the site goes dark weeks later with nobody having touched it. It is public by construction, so
   * the deadline was buying nothing; what limits it is scope, domains and the row behind it.
   */
  it('never expires, so a published site cannot go dark on its own', () => {
    const result = verifySpaceToken(generateSpaceToken(42, ['*']));

    expect(result.ok && result.payload.exp).toBeUndefined();
    expect(expiresInSeconds(generateSpaceToken(42, ['*']))).toBeUndefined();
  });

  // The opposite case: a write credential held by a third-party host, which renews on expires_in.
  it('still gives an agent grant a lifetime', () => {
    const result = verifySpaceToken(generateSpaceToken(42, ['*'], 'agent'));

    expect(result.ok && result.payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(expiresInSeconds(generateSpaceToken(42, ['*'], 'agent'))).toBeGreaterThan(0);
  });

  // Nothing to rotate: without an expiry the only thing that retires a render token is somebody deciding to.
  it('does not put a live render token on the rotation path', () => {
    expect(needsRotation(generateSpaceToken(42, ['*']))).toBe(false);
  });

  it('defaults a space token to the read-only render scope', () => {
    const result = verifySpaceToken(generateSpaceToken(42, []));

    expect(result.ok && result.payload.spaceScope).toBe('render');
  });

  // The point of `scope`: both are HS256 with the same secret, so without it a session token presented where a
  // space token belongs would verify and fall through on whatever the payload happened to contain.
  it('refuses a user token where a space token is expected, and the reverse', () => {
    const spaceResult = verifySpaceToken(generateUserToken(7));
    const userResult = verifyUserToken(generateSpaceToken(42, []));

    expect(spaceResult).toEqual({ ok: false, reason: 'wrong-type' });
    expect(userResult).toEqual({ ok: false, reason: 'wrong-type' });
  });

  // The pre-RFC-0010 claim set: a bespoke `data`/`version` payload with no scope, so a public render token was
  // indistinguishable from a write credential. Recognised by its shape and refused, never reinterpreted.
  it('refuses a legacy token, which carried no scope at all', () => {
    const now = Math.floor(Date.now() / 1000);
    const legacy = signRaw({
      data: { spaceId: 42 },
      version: 1,
      exp: now + 60
    });

    expect(verifySpaceToken(legacy)).toEqual({ ok: false, reason: 'outdated' });
  });

  // A scope this code does not know must not be trusted to be one it does: the claim comes off the wire.
  it('refuses a token carrying an unknown scope', () => {
    const now = Math.floor(Date.now() / 1000);
    const forged = signRaw({
      sub: '42',
      scope: 'space:superuser',
      origins: [],
      exp: now + 60
    });

    expect(verifySpaceToken(forged)).toEqual({ ok: false, reason: 'wrong-type' });
  });

  it('reports expiry apart from tampering, so only one of them is worth re-minting', () => {
    const now = Math.floor(Date.now() / 1000);
    const expired = signRaw({
      sub: '42',
      scope: 'space:render',
      origins: [],
      exp: now - 60,
      iat: now - 120
    });

    expect(verifySpaceToken(expired)).toEqual({ ok: false, reason: 'expired' });
    expect(verifySpaceToken('not-a-jwt')).toEqual({ ok: false, reason: 'malformed' });
  });

  // What the token endpoint keys off: a live token is handed back, an expired or outdated one is re-minted. A
  // garbled string is neither — re-minting on it would let any junk string rotate a space's credential.
  it('rotates expired and outdated tokens, but not live or garbled ones', () => {
    const now = Math.floor(Date.now() / 1000);
    const legacy = signRaw({
      data: { spaceId: 42 },
      version: 1,
      exp: now + 60
    });

    expect(needsRotation(generateSpaceToken(42, []))).toBe(false);
    expect(needsRotation(legacy)).toBe(true);
    expect(needsRotation('not-a-jwt')).toBe(false);
  });

  // iat/exp have second resolution, so a login immediately followed by a refresh would otherwise mint the same
  // bytes — and rotating the session would not invalidate the token it replaced.
  it('gives every user token a distinct jti within the same second', () => {
    expect(generateUserToken(7)).not.toBe(generateUserToken(7));
  });

  // Every credential is a JWT so one verifier, and one debugging story, covers them all.
  it('round-trips the refresh and widget credentials, which used to be opaque strings', () => {
    const refresh = verifyRefreshToken(generateRefreshToken(7));
    const widget = verifyWidgetToken(generateWidgetToken());

    expect(refresh.ok && refresh.payload.sub).toBe('7');
    expect(widget.ok && widget.payload.scope).toBe('widget');
    // The widgets-only grant reaches no space, and carries no subject that could be read as one.
    expect(widget.ok && 'sub' in widget.payload).toBe(false);
  });

  it('keeps the four kinds apart, so none can stand in for another', () => {
    expect(verifyUserToken(generateRefreshToken(7)).ok).toBe(false);
    expect(verifyRefreshToken(generateUserToken(7)).ok).toBe(false);
    expect(verifySpaceToken(generateWidgetToken()).ok).toBe(false);
    expect(verifyWidgetToken(generateSpaceToken(42, [])).ok).toBe(false);
  });

  // Environment isolation rides on the standard `iss` claim rather than a bespoke one: each deployment issues
  // under its own hosts, so a dev credential presented to staging is refused even if the secret were shared.
  it('refuses a token issued under another deployment’s issuer', () => {
    const now = Math.floor(Date.now() / 1000);
    const foreign = signRaw({
      sub: '42',
      scope: 'space:render',
      origins: [],
      iss: 'https://someone-elses.test',
      exp: now + 60
    });

    expect(verifySpaceToken(foreign)).toEqual({ ok: false, reason: 'issuer-not-allowed' });
  });

  it('applies the issuer check to every kind, not only space tokens', () => {
    const now = Math.floor(Date.now() / 1000);
    const foreignUser = signRaw({
      sub: '7',
      scope: 'user',
      jti: 'abc',
      iss: 'https://someone-elses.test',
      exp: now + 60
    });

    expect(verifyUserToken(foreignUser)).toEqual({ ok: false, reason: 'issuer-not-allowed' });
  });

  // A token from another environment is re-mintable here, which is what the token endpoint keys off.
  it('rotates a token from another environment', () => {
    const now = Math.floor(Date.now() / 1000);
    const foreign = signRaw({
      sub: '42',
      scope: 'space:render',
      origins: [],
      iss: 'https://someone-elses.test',
      exp: now + 60
    });

    expect(needsRotation(foreign)).toBe(true);
  });
});
