import { describe, expect, it } from 'vitest';

import { checkWithInteraction, comparedOf, viewsAsked } from './review';

// velada-dress: /artistas's new light read "0.1% differs" beside the run before it — a soft light is under the
// pictures' tolerance; its dress is not.
describe('task look --before, as it reads a comparison', () => {
  it('says the dress the task added and took away, section by section, beside the pixels', () => {
    const answer = {
      compare: {
        changed: 0.1,
        regions: [{ name: 'section#artist-page', changed: 0.1 }],
        decorations: [
          {
            section: 'section#artist-page',
            extra: ['radial-gradient rgba(199, 168, 107, 0.16)'],
            missing: [],
            absent: []
          },
          { section: 'footer#site-footer', extra: [], missing: [], absent: ['background image (backdrop x.webp)'] }
        ],
        sideBySide: 'side.png'
      }
    };

    expect(comparedOf(`checks…\n${JSON.stringify(answer)}`)).toEqual({
      changed: 0.1,
      sections: ['section#artist-page 0.1%'],
      dress: [
        'section#artist-page + radial-gradient rgba(199, 168, 107, 0.16)',
        'footer#site-footer − background image (backdrop x.webp)'
      ],
      sideBySide: 'side.png'
    });
  });
});

// velada-dress: `task look --hover` on a task of three pages was refused whole — a hover is one element of one page.
describe('task look, a hover or a click on several pages', () => {
  it('checks the pages together, then each with the interaction apart', async () => {
    const asked: string[] = [];
    const checked = await checkWithInteraction(['/', '/menu'], ['--hover', 'menu-link'], (pages, also) => {
      asked.push([...pages, ...also].join(' '));

      return Promise.resolve({ code: 0, output: `checked ${pages.join(' ')}` });
    });

    expect(asked).toEqual(['/ /menu', '/ --hover menu-link', '/menu --hover menu-link']);
    expect(checked.output).toContain('With --hover menu-link on /menu:\nchecked /menu');
  });
});

// velada-polish's design-2: `page shot` had --width and --scheme, `task look` neither — a look at 768, or light at 390,
// was a page shot by hand.
describe('task look --width and --scheme', () => {
  it('pictures each width in each scheme asked, and none asked is the team’s', () => {
    expect(viewsAsked({})).toBeUndefined();
    expect(viewsAsked({ width: '768' })).toEqual([
      ['768', 'light'],
      ['768', 'dark']
    ]);
    expect(viewsAsked({ scheme: 'light' })).toEqual([
      ['1440', 'light'],
      ['390', 'light']
    ]);
  });

  it('refuses what is no width or no scheme', () => {
    expect(() => viewsAsked({ width: 'wide' })).toThrow('widths in px');
    expect(() => viewsAsked({ scheme: 'sepia' })).toThrow('light, dark, or both');
  });
});
