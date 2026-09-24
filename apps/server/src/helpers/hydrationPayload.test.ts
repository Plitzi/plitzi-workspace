import { describe, expect, it } from 'vitest';

import { escapeJson } from './escapeJson';
import { hydrationPayload } from './hydrationPayload';

import type { OfflineDataRaw } from '@plitzi/sdk-shared';

// Escaped by the payload because JavaScript once treated it as a line break inside a string literal.
const LINE_SEPARATOR = String.fromCharCode(0x2028);

// A payload is only JSON to these tests; the shape of a real space does not matter to how it is serialized.
const space = (title: string) =>
  ({ schema: { settings: { title } }, style: { cache: '</style><script>&' } }) as unknown as OfflineDataRaw;

const serializedWhole = (offlineData: OfflineDataRaw | undefined, rest: Record<string, unknown>): string =>
  escapeJson(JSON.stringify({ offlineData, ...rest }));

describe('hydrationPayload', () => {
  it('is byte for byte what serializing the whole payload gives', () => {
    const rest = { offlineMode: true, environment: 'main', server: { note: `</script>${LINE_SEPARATOR}` } };

    expect(hydrationPayload(space('<b>home</b>'), rest)).toBe(serializedWhole(space('<b>home</b>'), rest));
  });

  it('matches with nothing beside the space, and with no space at all', () => {
    expect(hydrationPayload(space('a'), {})).toBe(serializedWhole(space('a'), {}));
    expect(hydrationPayload(undefined, { offlineMode: true })).toBe(serializedWhole(undefined, { offlineMode: true }));
  });

  it('serializes a space once, and a new space object anew', () => {
    const first = space('first');
    const payload = hydrationPayload(first, {});
    const replaced = space('second');

    expect(hydrationPayload(first, {})).toBe(payload);
    expect(hydrationPayload(replaced, {})).toContain('second');
  });

  describe('the stylesheet the page already carries', () => {
    const styled = (cache: string) =>
      ({ schema: { settings: {} }, style: { cache, variables: {} } }) as unknown as OfflineDataRaw;
    const parsed = (payload: string) =>
      JSON.parse(payload) as { offlineData: { style: { cache: string } }; styleCacheInDocument?: boolean };

    it('is left out, and the bootstrap told to read it from the page', () => {
      const payload = parsed(hydrationPayload(styled('.a{color:red}'), { offlineMode: true }));

      expect(payload.offlineData.style.cache).toBe('');
      expect(payload.styleCacheInDocument).toBe(true);
    });

    it('is sent when the page would not give it back as it is', () => {
      for (const cache of ['.a{color:{{ brand }}}', '.a{content:"<"}', '.a{}\r\n', '']) {
        const payload = parsed(hydrationPayload(styled(cache), {}));

        expect(payload.offlineData.style.cache).toBe(cache);
        expect(payload.styleCacheInDocument).toBeUndefined();
      }
    });

    it('is serialized once per space, like the whole one', () => {
      const space = styled('.a{color:red}');

      expect(hydrationPayload(space, {})).toBe(hydrationPayload(space, {}));
    });
  });
});
