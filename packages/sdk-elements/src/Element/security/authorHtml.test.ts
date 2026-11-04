import { afterEach, describe, expect, it, vi } from 'vitest';

/** A browser's `trustedTypes`: a policy's value is what its rule made, so the test reads what was cleaned. */
const withTrustedTypes = () => {
  vi.stubGlobal('trustedTypes', {
    createPolicy: (_name: string, rules: { createHTML?: (input: string) => string | null }) => ({
      createHTML: (input: string) => {
        const html = rules.createHTML?.(input) ?? '';

        // As a browser's: a trusted value reads as its markup wherever it is taken as text (the cleaner parses it).
        return { html, toString: () => html };
      }
    })
  });
};

const imported = async (mode: 'report-only' | 'enforce') => {
  const security = await import('@plitzi/sdk-shared/security');
  security.startMarkupPolicies(mode);

  return import('./authorHtml');
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

const written =
  '<p onclick="steal()">Hi <img src="x" onerror="steal()"><script>steal()</script><a href="javascript:steal()">me</a></p>';

describe('markup an author or the data wrote', () => {
  // Enforced, nothing in it runs anyway: what DOMPurify takes away is only what would have.
  it('is cleaned of what runs where the page’s policy is enforced, its markup kept', async () => {
    withTrustedTypes();
    const { authorHtml } = await imported('enforce');
    const { html } = authorHtml(written) as unknown as { html: string };

    expect(html).toContain('<p>Hi <img src="x"><a>me</a></p>');
    expect(html).not.toMatch(/onclick|onerror|<script|javascript:/);
  });

  // Reported only, a handler the page still runs is left as it was.
  it('passes as it was while the policy only reports', async () => {
    withTrustedTypes();
    const { authorHtml } = await imported('report-only');

    expect(authorHtml(written)).toMatchObject({ html: written });
  });

  it('is the same value for the same markup, and the markup itself where there is no Trusted Types', async () => {
    withTrustedTypes();
    const { authorHtml } = await imported('enforce');

    expect(authorHtml('<b>x</b>')).toBe(authorHtml('<b>x</b>'));

    vi.unstubAllGlobals();
    vi.resetModules();
    const bare = await imported('enforce');
    expect(bare.authorHtml('<b>x</b>')).toBe('<b>x</b>');
  });
});
