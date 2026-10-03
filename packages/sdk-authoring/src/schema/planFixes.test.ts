import { describe, expect, it } from 'vitest';

import { button, element, onClick, planFixes, setState } from '../index';

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
});
