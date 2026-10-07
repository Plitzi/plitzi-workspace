import { describe, expect, it } from 'vitest';

import { button, element, fontAwesome, link, onClick, planFixes, setState, text } from '../index';

import type { ElementSpec, SpaceSpec } from './types';

const page = (body: ElementSpec[]): SpaceSpec => ({
  name: 'Fixes',
  permanentUrl: 'fixes',
  pages: [{ id: 'home', name: 'Home', slug: '', body }]
});

describe('planFixes', () => {
  it('names each fix with the edit that makes it in the call that wrote the element', () => {
    const { fixes, problems } = planFixes(
      page([
        element('image', { id: 'photo', src: '/a.png', alt: 'A', decorative: 'true' }),
        element('text', { id: 'note', content: 'Hi', contnet: 'typo' }),
        button({
          id: 'add',
          content: 'Add',
          flows: [[onClick(), setState({ key: 'state.count', type: 'number', value: '1' })]]
        })
      ])
    );

    expect(problems.map(problem => problem.code)).toEqual(
      expect.arrayContaining(['attribute-kind', 'unknown-attribute', 'state-key-has-runtime-prefix'])
    );
    // `at` is the author's own code, and this test is inside the package: a project's fixes carry it (see the CLI's).
    expect(fixes.map(({ code, elementId, edit }) => ({ code, elementId, edit }))).toEqual([
      {
        code: 'attribute-kind',
        elementId: 'photo',
        edit: { on: 'attribute', op: 'set', key: 'decorative', value: true }
      },
      { code: 'unknown-attribute', elementId: 'note', edit: { on: 'attribute', op: 'remove', key: 'contnet' } },
      {
        code: 'state-key-has-runtime-prefix',
        elementId: 'add',
        edit: { on: 'step', op: 'set', key: 'key', value: 'count', step: { flow: 0, index: 1 } }
      }
    ]);
  });

  /** The `content-attribute` suggestion, where it has one way to be written: `plitzi space fix` makes it. */
  it('plans words and an icon held as children as the element’s own, and leaves what cannot move as is', () => {
    const { fixes } = planFixes(
      page([
        link({ id: 'pricing', href: '/pricing', children: [text('Pricing')] }),
        link({
          id: 'docs',
          href: '/docs',
          children: [text('Docs'), fontAwesome({ icon: 'fa-solid fa-arrow-right' })]
        }),
        // A child with an id of its own is something a test or a flow may point at: it stays.
        link({ id: 'named', href: '/', children: [text('Home', { id: 'home-words' })] })
      ])
    );

    expect(fixes.map(({ code, elementId, edit }) => ({ code, elementId, edit }))).toEqual([
      {
        code: 'content-attribute',
        elementId: 'pricing',
        edit: { on: 'children', op: 'set', key: 'content', value: 'Pricing' }
      },
      {
        code: 'content-attribute',
        elementId: 'docs',
        edit: {
          on: 'children',
          op: 'set',
          key: 'content',
          value: 'Docs',
          icon: 'fa-solid fa-arrow-right',
          iconPlacement: 'after'
        }
      }
    ]);
  });
});
