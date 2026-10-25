import { describe, expect, it } from 'vitest';

import { authorSpace } from './index';
import { text } from './tests/space';

import type { PageSpec } from './index';

const page = (name: string, slug: string, extra: Partial<PageSpec> = {}): PageSpec => ({
  name,
  slug,
  body: [text(name)],
  ...extra
});

const homeOf = (pages: PageSpec[]): unknown[] => {
  const { schema } = authorSpace({ name: 'Home', permanentUrl: 'home', pages });

  return Object.values(schema.flat)
    .filter(element => element.attributes.default === true)
    .map(element => element.attributes.slug);
};

// Its 404 page, listed first, became the home — every unknown address answered a bare "Not Found".
describe('the space’s home page', () => {
  it('is the page at an empty slug when none says isDefault — never the page of every other address', () => {
    expect(homeOf([page('Not found', '*'), page('Rooms', 'rooms'), page('Home', '')])).toEqual(['']);
    expect(homeOf([page('Not found', '*'), page('Rooms', 'rooms')])).toEqual(['rooms']);
    expect(
      homeOf([
        page('Rooms', 'rooms'),
        page('Home', '', { isDefault: false }),
        page('Stats', 'stats', { isDefault: true })
      ])
    ).toEqual(['stats']);
  });

  it('refuses the page of every other address marked the home', () => {
    expect(() => homeOf([page('Not found', '*', { isDefault: true }), page('Home', '')])).toThrow(
      /answers every address no other page does \(slug '\*'\), and cannot be the home too/
    );
  });
});
