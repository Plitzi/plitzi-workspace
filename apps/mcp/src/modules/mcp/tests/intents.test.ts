import { describe, expect, it } from 'vitest';

import { buildSpace, capturing } from './helpers';
import { addPageTool, classTool, setTool } from '../tools/intents';

import type { ToolContext } from '../tools/shared/tool';

const context = () => {
  const space = buildSpace();
  const cap = capturing(space);
  const ctx: ToolContext = { space, env: 'main', persisters: cap.persisters, spaceId: 1 };

  return { ctx, saved: cap.saved };
};

// An intention is a few parameters, the page found for the agent, and an answer in a line.
describe('the intent tools', () => {
  it('sets an element’s attributes by its ref alone, and says what changed in a line', async () => {
    const { ctx, saved } = context();
    const answer = (await setTool.execute({ ref: 'c1', set: { subType: 'section' } }, ctx)) as {
      done: string;
      next: string;
    };

    expect(answer.done).toBe('subType of c1 written');
    expect(answer.next).toContain('plitzi_screenshot');
    expect(saved().schema.flat.c1.attributes.subType).toBe('section');
  });

  it('answers a ref that does not exist with the nearest one', async () => {
    const { ctx } = context();

    expect(await setTool.execute({ ref: 'c2', set: { subType: 'section' } }, ctx)).toMatchObject({
      done: false,
      errors: [{ message: 'There is no element "c2" — did you mean "c1"?' }]
    });
  });

  it('dresses an element with the classes it wears, and refuses what the batch would refuse', async () => {
    const { ctx, saved } = context();

    expect(await classTool.execute({ ref: 'c1', classes: ['box'] }, ctx)).toMatchObject({ done: 'c1 wears box' });
    expect(saved().schema.flat.c1.definition.styleSelectors.base).toContain('box');
    expect(await classTool.execute({ ref: 'c1', classes: ['no-such-class'] }, ctx)).toMatchObject({ done: false });
  });

  it('adds a page at its slug', async () => {
    const { ctx, saved } = context();

    expect(await addPageTool.execute({ ref: 'pricing', slug: 'pricing' }, ctx)).toMatchObject({
      done: 'page pricing added at /pricing'
    });
    expect(saved().schema.pages).toContain('pricing');
  });
});
