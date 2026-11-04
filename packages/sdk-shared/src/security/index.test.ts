import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TrustedTypesRules } from '.';

/** A browser's `trustedTypes`, recording what each policy was made with, and how many times each name was asked for. */
const browserWithTrustedTypes = () => {
  const made = new Map<string, TrustedTypesRules>();
  const asked = new Map<string, number>();
  vi.stubGlobal('trustedTypes', {
    createPolicy: (name: string, rules: TrustedTypesRules) => {
      asked.set(name, (asked.get(name) ?? 0) + 1);
      if (name === 'default' && made.has('default')) {
        throw new TypeError('Policy with name "default" already exists');
      }

      made.set(name, rules);

      return { createHTML: (input: string) => ({ html: rules.createHTML?.(input) }) };
    },
    get defaultPolicy() {
      return made.has('default') ? {} : null;
    }
  });

  return Object.assign(made, { asked });
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock('@plitzi/nexus');
  vi.resetModules();
});

describe('the SDK’s markup policies', () => {
  it('hand the markup back as it is where there is no Trusted Types — the server', async () => {
    const { ownHtml, startMarkupPolicies } = await import('.');
    startMarkupPolicies('enforce');

    expect(ownHtml('<p>Hi</p>')).toBe('<p>Hi</p>');
  });

  // React writes `innerHTML` again whenever the value is another object: the same markup is the same value.
  it('make the page’s own markup a trusted value, the same one for the same markup', async () => {
    const made = browserWithTrustedTypes();
    const { ownHtml, startMarkupPolicies } = await import('.');
    startMarkupPolicies('report-only');

    expect([...made.keys()]).toEqual(['plitzi-html', 'default']);
    expect(ownHtml('<p>Hi</p>')).toEqual({ html: '<p>Hi</p>' });
    expect(ownHtml('<p>Hi</p>')).toBe(ownHtml('<p>Hi</p>'));
  });

  // What a library writes without naming a policy passes only when it cannot run: the rest is refused, and reported.
  it('let through without a policy only text, JSON as a script, React’s empty script and a worker the page made', async () => {
    const made = browserWithTrustedTypes();
    const { startMarkupPolicies } = await import('.');
    startMarkupPolicies('report-only');
    const fallback = made.get('default');

    expect(fallback?.createScript?.('{"@type":"WebSite"}')).toBe('{"@type":"WebSite"}');
    expect(fallback?.createScript?.('alert(1)')).toBeNull();
    expect(fallback?.createHTML?.('<script></script>')).toBe('<script></script>');
    // The head's JSON-LD as Helmet writes it: `jsonForScript` leaves no `<` in it.
    expect(fallback?.createHTML?.('{"@context":"https://schema.org","name":"\\u003cb>"}')).not.toBeNull();
    expect(fallback?.createHTML?.('<img src=x onerror=alert(1)>')).toBeNull();
    expect(fallback?.createHTML?.('"<img src=x onerror=alert(1)>"')).toBeNull();
    expect(fallback?.createScriptURL?.(`blob:${location.origin}/1c9a`)).toBe(`blob:${location.origin}/1c9a`);
    expect(fallback?.createScriptURL?.('blob:https://elsewhere.example/1c9a')).toBeNull();
    expect(fallback?.createScriptURL?.('https://cdn.example/worker.js')).toBeNull();
    // A file the page's own origin serves — the builder's worker — is the origin's own too.
    expect(fallback?.createScriptURL?.('/builder-assets/functions-worker.js')).toBe(
      '/builder-assets/functions-worker.js'
    );
    expect(fallback?.createScriptURL?.(`${location.origin}/w.js`)).toBe(`${location.origin}/w.js`);
  });

  // A page held to a policy never asks for `eval`: nexus's compiled writers would be refused, or reported on every visit.
  it('write the store without compiled code on a page held to a policy, and with it on one that is not', async () => {
    const setCodegenEnabled = vi.fn();
    vi.doMock('@plitzi/nexus', () => ({ setCodegenEnabled }));
    const { startMarkupPolicies } = await import('.');

    startMarkupPolicies('report-only');
    startMarkupPolicies('enforce');
    startMarkupPolicies(undefined);

    expect(setCodegenEnabled.mock.calls).toEqual([[false], [false], [undefined]]);
  });

  // A copy of this module the SDK does not start (the builder's) reads the page's policy off the document.
  it('read the page’s policy off the document when none is handed, and hold zod to it', async () => {
    const setCodegenEnabled = vi.fn();
    vi.doMock('@plitzi/nexus', () => ({ setCodegenEnabled }));
    document.documentElement.dataset.plitziScriptPolicy = 'enforce';
    const { pageScriptPolicy, scriptPolicyEnforced, startMarkupPolicies } = await import('.');
    const { z } = await import('zod');

    expect(pageScriptPolicy()).toBe('enforce');
    startMarkupPolicies();
    expect(scriptPolicyEnforced()).toBe(true);
    expect(setCodegenEnabled).toHaveBeenCalledWith(false);
    expect(z.config().jitless).toBe(true);

    delete document.documentElement.dataset.plitziScriptPolicy;
    z.config({ jitless: false });
    expect(pageScriptPolicy()).toBeUndefined();
  });

  // Making `default` a second time is itself a violation a page reports: a second copy (the builder's) leaves it.
  it('make the page’s default policy once, whatever copies of this module the page loads', async () => {
    const made = browserWithTrustedTypes();
    (await import('.')).startMarkupPolicies('report-only');
    vi.resetModules();
    (await import('.')).startMarkupPolicies('report-only');

    expect(made.asked.get('default')).toBe(1);
    expect(made.asked.get('plitzi-html')).toBe(2);
  });
});
