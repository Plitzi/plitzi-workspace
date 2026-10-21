import { describe, expect, it } from 'vitest';

import { comparedOf } from './review';

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
