import { describe, expect, it } from 'vitest';

import { largeSpace } from './largeSpace';
import { ANSWER_BUDGETS as budgets, HOST_ANSWERS } from '../answerBudgets';
import { defsUri, globalsUri, interactionsUri, pageUri, primerUri, styleVarsUri, typesUri } from '../helpers';
import { readResource } from '../resources';
import { search } from '../tools';
import { describeOperation } from '../tools/describeOperation';
import { renderTool } from '../tools/render';

import type { Operation } from '../tools/operations';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * What each answer costs an agent's context, on a space as large as a busy one (30 pages of 100 elements, 200 classes),
 * held to a ceiling: the `wasted` ratchet of renders, for words. Tokens are estimated at four characters
 * each — the measure is the same on every run, which is what a ratchet needs.
 *
 * A budget watches; it never decides what an agent may see. An answer that grows past its ceiling because it says
 * something the agent needs raises the ceiling in `answerBudgets.ts`, said in the change; what is cut is what is
 * said twice, never a field — an agent that does not see one cannot use it, and is confused when it meets it.
 * `plitzi_activity` answers from the history a host keeps: it is held where the host runs it (`HOST_ANSWERS`).
 * `plitzi_look` and `plitzi_test` answer from a renderer and a browser: measured on a stack that has them.
 */

const space = largeSpace(30, 100, 200);

const tokensOf = (answer: unknown): number => Math.ceil(JSON.stringify(answer).length / 4);

/**
 * A widget as an agent writes one — a heading, words, three cards from a template, a button, their classes. What the
 * MODEL reads of its answer is measured (the text content): the assembled widget rides to the host apart from it.
 */
const WIDGET: Operation[] = [
  {
    type: 'upsertDefinitions',
    definitions: {
      panel: { desktop: { display: 'flex', 'flex-direction': 'column', gap: '12px', padding: '16px' } },
      row: { desktop: { display: 'flex', 'flex-wrap': 'wrap', gap: '8px' } },
      card: { desktop: { padding: '12px', 'border-radius': '12px', 'flex-basis': '0%', 'flex-grow': '1' } }
    }
  },
  {
    type: 'upsertElement',
    pageRef: 'render',
    element: {
      ref: 'panel',
      type: 'container',
      style: { base: ['panel'] },
      children: [
        { ref: 'title', type: 'heading', subType: 'h2', props: { content: 'Plans' } },
        { ref: 'lead', type: 'paragraph', props: { content: 'Pick one: you can change it later.' } },
        { ref: 'go', type: 'button', props: { content: 'Start' } }
      ]
    }
  },
  {
    type: 'repeatElement',
    pageRef: 'render',
    parentRef: 'panel',
    ref: 'plans',
    style: { base: ['row'] },
    template: { ref: 'plan', type: 'text', style: { base: ['card'] }, props: { content: '{{item.name}}' } },
    items: [{ name: 'Free' }, { name: 'Site' }, { name: 'App' }]
  }
];

const rendered = (): unknown => {
  const result = renderTool.execute({ operations: WIDGET }, { space, env: 'main', persisters: {} }) as CallToolResult;

  return result.content;
};

const ANSWERS: Record<Exclude<keyof typeof budgets, (typeof HOST_ANSWERS)[number]>, () => unknown> = {
  'plitzi://primer': () => readResource(space, 'main', primerUri('main')),
  'plitzi://schema/…/pages/{ref}': () => readResource(space, 'main', pageUri('main', 'home-29')),
  'plitzi://schema/…/elements/{ref}': () => readResource(space, 'main', 'plitzi://schema/main/elements/el-29-100'),
  'plitzi://definitions': () => readResource(space, 'main', defsUri('main')),
  'plitzi://types': () => readResource(space, 'main', typesUri),
  'plitzi://global-styles': () => readResource(space, 'main', globalsUri('main')),
  'plitzi://interactions': () => readResource(space, 'main', interactionsUri('main')),
  'plitzi://style-variables': () => readResource(space, 'main', styleVarsUri('main')),
  plitzi_search: () => search({ query: 'box' }, space, 'main'),
  'plitzi_search include detail': () => search({ query: 'box', include: 'detail' }, space, 'main'),
  plitzi_describe_operation: () => describeOperation(undefined),
  'plitzi_describe_operation upsertElement': () => describeOperation('upsertElement'),
  plitzi_render: rendered
};

describe('what each answer costs, on a large space', () => {
  for (const [name, answer] of Object.entries(ANSWERS)) {
    // `Object.entries` widens a key to a string; these are ANSWERS', which has the table's keys by its type.
    const ceiling = budgets[name as keyof typeof ANSWERS];

    it(`${name} stays within its ${String(ceiling)} tokens`, () => {
      const value = answer();
      const tokens = tokensOf(value);

      expect(value, `${name} answered nothing`).not.toBeNull();
      expect(
        tokens,
        `${name} is ${String(tokens)} tokens, past its ${String(ceiling)}: if it says what an agent needs, raise its ceiling in answerBudgets.ts and say so; if it says something twice, cut that`
      ).toBeLessThanOrEqual(ceiling);
    });
  }

  it('measures every answer the table names, and the table names every answer measured', () => {
    expect([...Object.keys(ANSWERS), ...HOST_ANSWERS].sort()).toEqual(Object.keys(budgets).sort());
  });
});
