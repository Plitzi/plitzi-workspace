import { describe, expect, it } from 'vitest';

import { authorSpace, bindTemplate, button, container, text } from '../../index';

import type { ElementSpec, SpaceSpec } from '../../index';

/** The `repeated-expression` suggestions of a space. */
const offered = (spec: SpaceSpec) =>
  authorSpace(spec).suggestions.filter(suggestion => suggestion.code === 'repeated-expression');

/** What is chosen, worked out again in every pill — the sum the copies share. */
const CHOSEN = '(state.chosen.views is defined ? state.chosen.views : (state.held.views|default(0)))';

/** A pill of a step: what choosing it changes, worked out in full in its own binding. */
const pill = (step: number): ElementSpec =>
  button({
    id: `pill-${String(step)}`,
    content: '',
    children: [
      text('', {
        id: `pill-${String(step)}-delta`,
        bind: [
          bindTemplate(
            'content',
            'state.chosen',
            `{% set d = (${String(step)} - ${CHOSEN}) * 2900 %}{{ d > 0 ? '+ ' ~ (d / 100)|currency('EUR') : (d < 0 ? '− ' ~ ((0 - d) / 100)|currency('EUR') : '') }}`
          )
        ]
      })
    ]
  });

const space = (steps: number): SpaceSpec => ({
  name: 'Capacity',
  permanentUrl: 'capacity',
  pages: [
    {
      id: 'home',
      name: 'Home',
      slug: '',
      isDefault: true,
      body: [container({ id: 'pills', children: Array.from({ length: steps }, (_, step) => pill(step)) })]
    }
  ]
});

describe('repeated-expression, a suggestion', () => {
  it('names the expression copies share, its numbers and words aside, with what it weighs and where it starts', () => {
    const [suggestion] = offered(space(40));

    expect(suggestion.message).toMatch(/written 40 times \(\d+ KB\) — first in "pill-0-delta"/);
    expect(suggestion.message).toContain('computed value');
    expect(suggestion.elementIds).toHaveLength(40);
  });

  it('is not offered for a few copies, nor for one short reading written often', () => {
    expect(offered(space(4))).toEqual([]);
  });
});
