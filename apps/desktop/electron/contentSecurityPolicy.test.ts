/* eslint-disable quotes */
import { describe, expect, it } from 'vitest';

import { contentSecurityPolicy } from './contentSecurityPolicy';

const directives = (policy: string): Record<string, string> =>
  Object.fromEntries(
    policy.split('; ').map(entry => {
      const [name, ...sources] = entry.split(' ');

      return [name, sources.join(' ')];
    })
  );

describe('the desktop content security policy', () => {
  /**
   * The whole reason this is a function of `dev` and not a constant: the relaxations the Vite dev server needs
   * are the ones that must never be in a window handed to somebody. A policy assembled in one place and shipped
   * from another is exactly how `unsafe-inline` reaches production without anyone deciding it should.
   */
  it('gives a packaged window none of the dev-server relaxations', () => {
    const policy = directives(contentSecurityPolicy(false));

    expect(policy['script-src']).toBe("'self' blob: https:");
    expect(policy['connect-src']).not.toContain('localhost');
  });

  it('lets the dev server reach its own page for HMR', () => {
    const policy = directives(contentSecurityPolicy(true));

    expect(policy['connect-src']).toContain('ws://localhost:*');
    expect(policy['script-src']).toContain("'unsafe-inline'");
  });

  /**
   * A remote plugin is fetched and then imported as a blob, so `blob:` is the difference between a space's
   * plugins running and every one of them drawing as "not found" — and the failure is caught and logged, so
   * nothing about it looks like a policy.
   */
  it('lets a remote plugin run', () => {
    expect(directives(contentSecurityPolicy(false))['script-src']).toContain('blob:');
  });

  /**
   * The line the packaged window holds: a script an author POINTED AT is allowed, a script an author WROTE INTO
   * the page is not. Inline is where a space's own content turns into code, so it stays out even though it costs
   * `BlockHtml`'s inline scripts and the importmap `generateFacade` writes.
   */
  it('allows an author’s remote script but never an inline one', () => {
    const policy = directives(contentSecurityPolicy(false));

    expect(policy['script-src']).toContain('https:');
    expect(policy['script-src']).not.toContain("'unsafe-inline'");
  });

  it('never allows eval, in either build', () => {
    expect(contentSecurityPolicy(true)).not.toContain('unsafe-eval');
    expect(contentSecurityPolicy(false)).not.toContain('unsafe-eval');
  });

  /**
   * A space is somebody else's document: its pictures, faces and embeds come from wherever its author put them,
   * so the policy has to be open where the content is and closed where the code is.
   */
  it('lets a space load its own pictures, faces and frames', () => {
    const policy = directives(contentSecurityPolicy(false));

    expect(policy['img-src']).toContain('https:');
    expect(policy['font-src']).toContain('https:');
    expect(policy['frame-src']).toContain('https:');
  });

  it('refuses plugins and a rewritten base URL outright', () => {
    const policy = directives(contentSecurityPolicy(false));

    expect(policy['object-src']).toBe("'none'");
    expect(policy['base-uri']).toBe("'self'");
  });
});
