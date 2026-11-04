import { describe, expect, it } from 'vitest';

import { newScriptNonce, scriptPolicyOf, sendScriptPolicy } from './scriptPolicy';

describe('a page’s script policy', () => {
  it('names the render’s nonce, what its scripts load, and no plugin object nor base to move them', () => {
    expect(scriptPolicyOf('abc')).toBe(
      "script-src 'nonce-abc' 'strict-dynamic' 'unsafe-inline' https:; object-src 'none'; base-uri 'none'; report-uri /_plitzi/csp-report"
    );
  });

  // Unguessable, and new on every render: a script written into a page cannot carry one it never saw.
  it('is a different nonce each render, of 128 bits', () => {
    const nonces = new Set(Array.from({ length: 50 }, newScriptNonce));

    expect(nonces.size).toBe(50);
    expect(Buffer.from([...nonces][0], 'base64')).toHaveLength(16);
  });

  it('is sent as reports only, by default, and not at all when the server says so or the page has no nonce', () => {
    const sent = (config: Parameters<typeof sendScriptPolicy>[1], nonce: string) => {
      const headers: Record<string, string> = {};
      sendScriptPolicy({ setHeader: (name, value) => void (headers[name] = String(value)) }, config, nonce);

      return headers;
    };

    expect(Object.keys(sent({}, 'abc'))).toEqual(['Content-Security-Policy-Report-Only']);
    expect(sent({ scriptPolicy: false }, 'abc')).toEqual({});
    expect(sent({}, '')).toEqual({});
  });
});
