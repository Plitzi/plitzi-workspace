/* eslint-disable quotes -- the cases quote code, which reads best in the other quotes */
import { describe, expect, it } from 'vitest';

import { container, formControl, markdown } from '../../elements';
import { authorSpace } from '../space';

import type { SpaceSpec } from '../types';

const space = (customCss: string): SpaceSpec => ({
  name: 'Slots',
  permanentUrl: 'slots',
  classes: { prose: {}, box: {} },
  pages: [
    {
      id: 'home',
      name: 'Home',
      slug: '',
      body: [markdown('# Hi', { class: 'prose' }), formControl({ name: 'q' }), container({ class: 'box' })]
    }
  ],
  customCss
});

const slotAdvice = (customCss: string): string | undefined =>
  authorSpace(space(customCss)).suggestions.find(suggestion => suggestion.code === 'custom-css-slot')?.message;

describe('custom-css-slot', () => {
  it('names the slot of each part the SDK’s markup is dressed by', () => {
    const message = slotAdvice(
      [
        '.box .input-container__input::placeholder { color: gray; }',
        '.form-input__icon:hover { color: black; }',
        '.pager button, .plitzi-component__pagination-page--current { color: red !important; }',
        '/* .markdown-code-copy { color: red; } */'
      ].join('\n')
    );

    expect(message).toContain("`.box .input-container__input::placeholder` (a formControl's `field`)");
    expect(message).toContain("`.form-input__icon:hover` (a formControl's `icon`)");
    expect(message).toContain("`.plitzi-component__pagination-page--current` (a pagination's `page`)");
    expect(message).not.toContain('markdown-code-copy');
    expect(message).not.toContain('.pager button');
  });

  it('reads a tag under the class a markdown wears as the part it is, the level of a heading included', () => {
    const message = slotAdvice(
      '.prose h2 { font-size: 30px; }\n.prose a:hover { color: red; }\n@media (max-width: 40rem) { .prose li::marker { color: gray; } }'
    );

    expect(message).toContain("`.prose h2` (a markdown's `heading2`)");
    expect(message).toContain("`.prose a:hover` (a markdown's `link`)");
    expect(message).toContain("`.prose li::marker` (a markdown's `listItem`)");
  });

  it('says nothing of a part followed by what no class on its slot can say', () => {
    expect(
      slotAdvice(
        '.prose > p:first-of-type { color: red; }\n.prose pre code { padding: 0; }\n' +
          '.form-input__icon:hover:not(:disabled) { color: black; }'
      )
    ).toBe(undefined);
  });

  it('says nothing of a rule on a class of the space’s own, or on what no slot reaches', () => {
    expect(slotAdvice('.box h2 { color: red; }\n.prose > * { max-width: 100%; }\n::selection { color: red; }')).toBe(
      undefined
    );
  });
});
