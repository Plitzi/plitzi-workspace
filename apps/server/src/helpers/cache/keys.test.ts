import { describe, expect, it } from 'vitest';

import { buildHtmlCacheKey, buildRscCacheKey, keepsVersion, offlineDataCacheKeyOf } from './keys';

const req = (path: string, search = '', hostname = 'site.example.com', cookie?: string, host = hostname) => ({
  hostname,
  path,
  search,
  headers: { cookie, host }
});

/**
 * The rendered document wears the visitor's theme — on `<html>` and in the props the SDK hydrates with — so two
 * visitors with different choices must never be handed the same cached copy.
 */
describe('buildHtmlCacheKey', () => {
  const html = (cookie?: string) =>
    buildHtmlCacheKey(undefined, 1, 'production', 3, req('/', '', 'site.example.com', cookie), []);

  it('separates a visitor who chose dark from one who chose light', () => {
    expect(html('theme=dark')).not.toBe(html('theme=light'));
  });

  it('separates a visitor with a choice from one with none', () => {
    expect(html('theme=dark')).not.toBe(html());
  });

  it('is not split by cookies that do not change the document', () => {
    expect(html('theme=dark; _ga=GA1.2.3; consent=yes')).toBe(html('_ga=other; theme=dark'));
    expect(html('_ga=GA1.2.3')).toBe(html());
  });

  it('ignores a theme cookie holding something that is not a theme', () => {
    expect(html('theme=purple')).toBe(html());
  });

  // A `system` page is drawn as the machine asks (`theme.resolved`); a chosen theme is drawn the same whatever it says.
  it('separates the machine’s schemes only where the theme defers to the machine', () => {
    expect(html('theme-scheme=dark')).not.toBe(html('theme-scheme=light'));
    expect(html('theme=system; theme-scheme=dark')).not.toBe(html('theme=system'));
    expect(html('theme=dark; theme-scheme=dark')).toBe(html('theme=dark; theme-scheme=light'));
  });

  /** On a page that authorizes dev tools, the visitor who hid them is rendered without the panel. */
  it('separates a visitor who hid the dev tools from one who did not', () => {
    expect(html('plitzi_debug=false')).not.toBe(html());
  });

  it('reads the dev tools cookie named for the port the page is served on', () => {
    const onPort = (cookie: string) =>
      buildHtmlCacheKey(undefined, 1, 'production', 3, req('/', '', 'site.test', cookie, 'site.test:4013'), []);

    expect(onPort('plitzi_debug_4013=false')).not.toBe(onPort('plitzi_debug=false'));
  });

  // HTTP/2 sends no Host header: the port is in `:authority`, and the cookie named for it must still be read.
  it('reads the dev tools cookie named for the port of a request made over HTTP/2', () => {
    const overHttp2 = (cookie: string) =>
      buildHtmlCacheKey(
        undefined,
        1,
        'production',
        3,
        {
          hostname: 'site.test',
          path: '/',
          search: '',
          headers: { cookie, ':authority': 'site.test:4013' }
        },
        []
      );

    expect(overHttp2('plitzi_debug_4013=false')).not.toBe(overHttp2('plitzi_debug_4013=true'));
  });

  it('is not split by a dev tools cookie that does not hide anything', () => {
    expect(html('plitzi_debug=true')).toBe(html());
  });

  /** A page drawn with one visitor's kept state (`settings.paintedState`) must not be served to the next. */
  it('separates visitors whose painted state differs', () => {
    const painted = (values: Record<string, unknown>) =>
      `plitzi_0_painted=${encodeURIComponent(JSON.stringify({ owner: '', values }))}`;

    expect(html(painted({ toolPick: 'star' }))).not.toBe(html(painted({ toolPick: 'hexagon' })));
    expect(html(painted({ toolPick: 'star' }))).not.toBe(html());
  });

  /** A flag turned in production changes the page while the revision stays — the deployment says what they are at. */
  it('separates two versions of the flags at one revision', () => {
    const at = (flagsVersion?: string) =>
      buildHtmlCacheKey(
        undefined,
        1,
        'production',
        3,
        {
          ...req('/'),
          ...(flagsVersion ? { ctx: { spaceDeployment: { flagsVersion } } } : {})
        },
        []
      );

    expect(at('aaa')).not.toBe(at('bbb'));
    expect(at('aaa')).toBe(at('aaa'));
  });

  /** A tester's forced flags change what is drawn, and a tester must never be handed a page drawn without them. */
  it('separates a visitor who forced flags from one who did not', () => {
    expect(html('plitzi_flags=newCheckout%3A1')).not.toBe(html());
    expect(html('plitzi_flags=newCheckout%3A1')).not.toBe(html('plitzi_flags=newCheckout%3A0'));
  });

  it('reads the painted state cookie named for the port the page is served on', () => {
    const onPort = (cookie: string) =>
      buildHtmlCacheKey(undefined, 1, 'production', 3, req('/', '', 'site.test', cookie, 'site.test:4016'), []);

    expect(onPort('plitzi_0_painted_4016=x')).not.toBe(onPort('plitzi_0_painted=x'));
  });
});

describe('buildRscCacheKey', () => {
  it('separates two routes of the same space, environment and revision', () => {
    const a = buildRscCacheKey(1, 'production', 3, undefined, undefined, req('/blog/a'));
    const b = buildRscCacheKey(1, 'production', 3, undefined, undefined, req('/blog/b'));

    expect(a).not.toBe(b);
  });

  it('separates two query strings of the same path', () => {
    const a = buildRscCacheKey(1, 'production', 3, undefined, undefined, req('/search', '?q=shoes'));
    const b = buildRscCacheKey(1, 'production', 3, undefined, undefined, req('/search', '?q=hats'));

    expect(a).not.toBe(b);
  });

  it('separates the same path served on two domains', () => {
    const a = buildRscCacheKey(1, 'production', 3, undefined, undefined, req('/', '', 'one.example.com'));
    const b = buildRscCacheKey(1, 'production', 3, undefined, undefined, req('/', '', 'two.example.com'));

    expect(a).not.toBe(b);
  });

  it('separates an authenticated slice from an anonymous one', () => {
    const anon = buildRscCacheKey(1, 'production', 3, undefined, undefined, req('/account'));
    const user = buildRscCacheKey(1, 'production', 3, 42, undefined, req('/account'));

    expect(anon).not.toBe(user);
  });

  it('separates a partial refresh from a full one', () => {
    const full = buildRscCacheKey(1, 'production', 3, undefined, undefined, req('/'));
    const partial = buildRscCacheKey(1, 'production', 3, undefined, 'el1,el2', req('/'));

    expect(full).not.toBe(partial);
  });

  it('is stable for the same request', () => {
    const a = buildRscCacheKey(1, 'production', 3, 42, 'el1', req('/blog/a', '?page=2'));
    const b = buildRscCacheKey(1, 'production', 3, 42, 'el1', req('/blog/a', '?page=2'));

    expect(a).toBe(b);
  });

  it('does not let a field boundary be forged from adjacent values', () => {
    const a = buildRscCacheKey(1, 'production', 3, undefined, undefined, req('/a', '', 'x'));
    const b = buildRscCacheKey(1, 'production', 3, undefined, undefined, req('/a', '', 'x'));
    const shifted = buildRscCacheKey(1, 'production', 3, undefined, 'x', req('/a', '', ''));

    expect(a).toBe(b);
    expect(a).not.toBe(shifted);
  });
});

/**
 * A published revision never changes under its name and is always kept; the draft (`main`) is being edited right then,
 * and is kept only under the version every edit changes — a new version is a new key, so an edit is never answered
 * with the space read before it.
 */
describe('what a space is kept under', () => {
  it('keeps a revision, and the draft only with its version', () => {
    expect(keepsVersion({ environment: 'production', revision: 3 })).toBe(true);
    expect(keepsVersion({ environment: 'main', revision: 0 })).toBe(false);
    expect(keepsVersion(undefined)).toBe(false);
    expect(keepsVersion({ environment: 'main', revision: 0, draftVersion: 'v1' })).toBe(true);
    expect(offlineDataCacheKeyOf({ spaceId: 4, environment: 'main', revision: 0 })).toBeUndefined();
  });

  it('keys the draft by its version, and the page too', () => {
    const v1 = offlineDataCacheKeyOf({ spaceId: 4, environment: 'main', revision: 0, draftVersion: 'v1' });
    const v2 = offlineDataCacheKeyOf({ spaceId: 4, environment: 'main', revision: 0, draftVersion: 'v2' });
    const page = (draftVersion: string) =>
      buildHtmlCacheKey(undefined, 4, 'main', 0, { ...req('/'), ctx: { spaceDeployment: { draftVersion } } }, []);

    expect(v1).not.toBe(v2);
    expect(page('v1')).not.toBe(page('v2'));
  });
});
