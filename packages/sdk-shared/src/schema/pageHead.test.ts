import { describe, expect, it } from 'vitest';

import { absoluteAddress, DEFAULT_FAVICON, pageHeadTags, spaceIdentityProblems } from './pageHead';

const tag = (tags: ReturnType<typeof pageHeadTags>, key: string) =>
  tags.meta.filter(each => each.key === key).map(each => each.content);

// A link to a space pasted in a chat showed no picture: the head carried a title and a description, nothing else.
describe('a page’s head', () => {
  it('says the page to a link preview whole: its picture made absolute, the card large, its address and the site', () => {
    const tags = pageHeadTags(
      { title: 'Late Night Jazz', description: 'Listening now', image: '/rooms/jazz.png', imageAlt: 'A saxophone' },
      { siteName: 'Encore', language: 'es-MX' },
      'https://encore.example.com/r/jazz'
    );

    expect(tag(tags, 'og:image')).toEqual(['https://encore.example.com/rooms/jazz.png']);
    expect(tag(tags, 'twitter:image')).toEqual(['https://encore.example.com/rooms/jazz.png']);
    expect(tag(tags, 'og:image:alt')).toEqual(['A saxophone']);
    expect(tag(tags, 'twitter:card')).toEqual(['summary_large_image']);
    expect(tag(tags, 'og:url')).toEqual(['https://encore.example.com/r/jazz']);
    expect(tag(tags, 'og:site_name')).toEqual(['Encore']);
    expect(tag(tags, 'og:locale')).toEqual(['es_MX']);
    expect(tag(tags, 'og:type')).toEqual(['website']);
    expect(tags.lang).toBe('es-MX');
    expect(tags.links).toContainEqual({ rel: 'canonical', href: 'https://encore.example.com/r/jazz' });
  });

  it('falls back to the space’s picture and Plitzi’s icon, and says a small card with no picture', () => {
    expect(
      tag(pageHeadTags({ title: 'Home' }, { shareImage: 'https://cdn.example.com/og.png' }, ''), 'og:image')
    ).toEqual(['https://cdn.example.com/og.png']);
    const bare = pageHeadTags({ title: 'Home' }, {}, '');
    expect(tag(bare, 'twitter:card')).toEqual(['summary']);
    expect(tag(bare, 'og:image:alt')).toEqual([]);
    expect(bare.links).toEqual([{ rel: 'icon', href: DEFAULT_FAVICON, type: 'image/svg+xml' }]);
    expect(pageHeadTags({}, { favicon: '/icon.png' }, '').links).toEqual([
      { rel: 'icon', href: '/icon.png', type: 'image/png' }
    ]);
  });

  it('paints the browser one colour, or one a scheme', () => {
    expect(pageHeadTags({}, { themeColor: { light: '#ffffff', dark: '#09090b' } }, '').meta).toContainEqual({
      attribute: 'name',
      key: 'theme-color',
      content: '#09090b',
      media: '(prefers-color-scheme: dark)'
    });
    expect(tag(pageHeadTags({}, { themeColor: '#ff6a3d' }, ''), 'theme-color')).toEqual(['#ff6a3d']);
  });

  it('makes only a file of the site absolute', () => {
    expect(absoluteAddress('/og.png', 'https://a.test')).toBe('https://a.test/og.png');
    expect(absoluteAddress('https://b.test/x.png', 'https://a.test')).toBe('https://b.test/x.png');
    expect(absoluteAddress('/og.png', '')).toBe('/og.png');
  });

  it('says what is wrong with the space’s identity, each with its fix', () => {
    expect(spaceIdentityProblems({ siteName: 'Encore', language: 'en', favicon: '/favicon.svg' })).toEqual([]);
    expect(
      spaceIdentityProblems({
        siteName: ' ',
        language: 'English',
        favicon: 'favicon.svg',
        shareImage: 'javascript:alert(1)',
        // A scheme the type does not have, as a hand-edited document may: what the check is for.
        themeColor: { light: 'nope', dusk: '#000' } as never
      })
    ).toEqual([
      'siteName is empty: leave it out, or name the site.',
      'language "English" is no language tag: `en`, `es`, `es-MX`.',
      'favicon "favicon.svg" is neither a file of the site nor an address: `/favicon.svg` (in public/), or `https://…`.',
      'shareImage "javascript:alert(1)" is neither a file of the site nor an address: `/og.png` (in public/), or `https://…`.',
      'themeColor is one colour, or one a scheme: `{ light: "#ffffff", dark: "#09090b" }`.',
      'themeColor.light "nope" is no colour a browser reads here: `#ff6a3d`, `oklch(…)`.'
    ]);
  });
});
