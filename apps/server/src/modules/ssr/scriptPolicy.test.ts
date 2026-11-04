import { describe, expect, it } from 'vitest';

import { newScriptNonce, pagePolicies, scriptPolicyMode, scriptTemplateParams, sendScriptPolicy } from './scriptPolicy';

describe('a page’s policies', () => {
  it('report the script policy and Trusted Types, and enforce who may frame the page', () => {
    expect(
      pagePolicies({ nonce: 'abc', mode: 'report-only', trustedTypes: true, frameAncestors: "frame-ancestors 'none'" })
    ).toEqual({
      enforced: "frame-ancestors 'none'",
      reportOnly:
        "script-src 'nonce-abc' 'strict-dynamic' 'unsafe-inline' https:; object-src 'none'; base-uri 'none'; " +
        "require-trusted-types-for 'script'; trusted-types plitzi-html plitzi-author-html default dompurify 'allow-duplicates'; " +
        'report-uri /_plitzi/csp-report'
    });
  });

  // One header for both: a second `Content-Security-Policy` would only narrow the first, never stand beside it.
  it('enforce the script policy in the same header as the frame, and still only report Trusted Types', () => {
    const { enforced, reportOnly } = pagePolicies({
      nonce: 'abc',
      mode: 'enforce',
      trustedTypes: true,
      frameAncestors: "frame-ancestors 'self'"
    });

    expect(enforced).toBe(
      "frame-ancestors 'self'; script-src 'nonce-abc' 'strict-dynamic' 'unsafe-inline' https:; object-src 'none'; base-uri 'none'; report-uri /_plitzi/csp-report"
    );
    expect(reportOnly).toBe(
      "require-trusted-types-for 'script'; trusted-types plitzi-html plitzi-author-html default dompurify 'allow-duplicates'; report-uri /_plitzi/csp-report"
    );
  });

  it('follow the domain’s own choice over the server’s, and say nothing when it is off', () => {
    expect(scriptPolicyMode({}, undefined)).toBe('report-only');
    expect(scriptPolicyMode({ scriptPolicy: 'enforce' }, { security: { scriptPolicy: 'report-only' } })).toBe(
      'report-only'
    );
    expect(scriptPolicyMode({}, { security: { scriptPolicy: 'off' } })).toBeUndefined();
    expect(scriptPolicyMode({ scriptPolicy: false }, undefined)).toBeUndefined();
    expect(pagePolicies({ nonce: 'abc', mode: undefined, trustedTypes: true, frameAncestors: undefined })).toEqual({});
  });

  // Unguessable, and new on every render: a script written into a page cannot carry one it never saw.
  it('name a different nonce each render, of 128 bits', () => {
    const nonces = new Set(Array.from({ length: 50 }, newScriptNonce));

    expect(nonces.size).toBe(50);
    expect(Buffer.from([...nonces][0], 'base64')).toHaveLength(16);
  });

  it('are sent on the response, the enforced one replacing the frame-only header', () => {
    const headers: Record<string, string> = {};
    sendScriptPolicy(
      { setHeader: (name, value) => void (headers[name] = String(value)) },
      { scriptPolicy: 'enforce' },
      'abc',
      undefined
    );

    expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'none'; script-src 'nonce-abc'");
    expect(headers['Content-Security-Policy-Report-Only']).toContain('require-trusted-types-for');
  });

  it('give the template its nonce and the policy to say on the document, and nothing with no policy', () => {
    expect(scriptTemplateParams({}, undefined)).toMatchObject({
      scriptPolicy: 'report-only',
      nonce: expect.any(String) as string
    });
    expect(scriptTemplateParams({}, { security: { scriptPolicy: 'enforce' } })).toMatchObject({
      scriptPolicy: 'enforce'
    });
    expect(scriptTemplateParams({ scriptPolicy: false }, undefined)).toEqual({});
  });
});
