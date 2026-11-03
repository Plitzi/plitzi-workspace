import { describe, expect, it } from 'vitest';

import { escapeJson } from './escapeJson';
import { hydrationPayload, spaceDocument, styleSheetOf } from './hydrationPayload';

import type { OfflineDataRaw } from '@plitzi/sdk-shared';

// Escaped by the payload because JavaScript once treated it as a line break inside a string literal.
const LINE_SEPARATOR = String.fromCharCode(0x2028);

// A payload is only JSON to these tests; the shape of a real space does not matter to how it is serialized.
const space = (title: string) =>
  ({ schema: { settings: { title } }, style: { cache: '</style><script>&' } }) as unknown as OfflineDataRaw;

const serializedWhole = (offlineData: OfflineDataRaw | undefined, rest: Record<string, unknown>): string =>
  escapeJson(JSON.stringify({ offlineData, ...rest }));

describe('hydrationPayload', () => {
  // Carrying its stylesheet, the space is serialized as it is: what these are about is the escaping.
  const carried = { linkStyle: false };

  it('is byte for byte what serializing the whole payload gives', () => {
    const rest = { offlineMode: true, environment: 'main', server: { note: `</script>${LINE_SEPARATOR}` } };

    expect(hydrationPayload(space('<b>home</b>'), rest, carried)).toBe(serializedWhole(space('<b>home</b>'), rest));
  });

  it('matches with nothing beside the space, and with no space at all', () => {
    expect(hydrationPayload(space('a'), {}, carried)).toBe(serializedWhole(space('a'), {}));
    expect(hydrationPayload(undefined, { offlineMode: true })).toBe(serializedWhole(undefined, { offlineMode: true }));
  });

  it('leaves the space out when it travels apart', () => {
    const styled = { schema: {}, style: { cache: '.a{color:red}' } } as unknown as OfflineDataRaw;

    expect(JSON.parse(hydrationPayload(styled, { offlineMode: true }, { apart: true }))).toEqual({ offlineMode: true });
  });

  it('serializes a space once, and a new space object anew', () => {
    const first = space('first');
    const payload = hydrationPayload(first, {});
    const replaced = space('second');

    expect(hydrationPayload(first, {})).toBe(payload);
    expect(hydrationPayload(replaced, {})).toContain('second');
  });

  describe('the stylesheet the page links', () => {
    const styled = (cache: string) =>
      ({ schema: { settings: {} }, style: { cache, variables: {} } }) as unknown as OfflineDataRaw;
    const parsed = (payload: string) =>
      JSON.parse(payload) as { offlineData: { style: { cache: string; cacheHref?: string } } };

    // The dashboard's was 429 KB of a 496 KB page, compressed again on every response and parsed again on every load.
    it('is named instead of carried', () => {
      const space = styled('.a{color:red}');
      const { style } = parsed(hydrationPayload(space, { offlineMode: true })).offlineData;

      expect(style.cache).toBe('');
      expect(style.cacheHref).toBe(styleSheetOf(space)?.href);
      expect(styleSheetOf(space)?.css).toContain('.a{color:red}');
    });

    it('is carried when a token in it is replaced per request, or there is none', () => {
      for (const cache of ['.a{color:{{ brand }}}', '']) {
        const { style } = parsed(hydrationPayload(styled(cache), {})).offlineData;

        expect(style.cache).toBe(cache);
        expect(style.cacheHref).toBeUndefined();
      }
    });

    it('is carried by a page no other request could answer its file for', () => {
      const { style } = parsed(hydrationPayload(styled('.a{color:red}'), {}, { linkStyle: false })).offlineData;

      expect(style.cache).toBe('.a{color:red}');
    });

    it('is named by its text: the same sheet for a copy of the space, another for another stylesheet', () => {
      const space = styled('.a{color:red}');
      const withheld = { ...space, schema: { settings: {} } } as unknown as OfflineDataRaw;

      expect(styleSheetOf(withheld)).toBe(styleSheetOf(space));
      expect(styleSheetOf(styled('.a{color:blue}'))?.hash).not.toBe(styleSheetOf(space)?.hash);
    });

    it('is serialized once per space, in each form', () => {
      const space = styled('.a{color:red}');

      expect(spaceDocument(space)).toBe(spaceDocument(space));
      expect(spaceDocument(space, { linkStyle: false })).not.toBe(spaceDocument(space));
    });
  });
});
