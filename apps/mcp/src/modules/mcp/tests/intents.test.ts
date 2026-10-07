import { describe, expect, it } from 'vitest';

import { buildSpace, capturing } from './helpers';
import { addPageTool, setAttributesTool, setClassesTool } from '../tools/intents';

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
    const answer = (await setAttributesTool.execute({ ref: 'c1', set: { subType: 'section' } }, ctx)) as {
      done: string;
      next: string;
    };

    expect(answer.done).toBe('subType of c1 written');
    expect(answer.next).toBe('plitzi_look { pageRef: "home" } to see it');
    expect(saved().schema.flat.c1.attributes.subType).toBe('section');
  });

  it('answers a ref that does not exist with the nearest one', async () => {
    const { ctx } = context();

    expect(await setAttributesTool.execute({ ref: 'c2', set: { subType: 'section' } }, ctx)).toMatchObject({
      done: false,
      errors: [{ message: 'There is no element "c2" — did you mean "c1"?' }]
    });
  });

  // "Give it the class" adds it: the classes it already wears stay unless they are named to go.
  it('adds and removes classes, keeping the ones it does not name, and refuses one the space does not have', async () => {
    const { ctx, saved } = context();
    ctx.space.style.platform.desktop.card = { ...ctx.space.style.platform.desktop.box, name: 'card' };

    expect(await setClassesTool.execute({ ref: 'c1', add: ['card'] }, ctx)).toMatchObject({
      done: 'c1 wears box, card'
    });
    expect(saved().schema.flat.c1.definition.styleSelectors.base.split(' ')).toEqual(['box', 'card']);
    expect(await setClassesTool.execute({ ref: 'c1', remove: ['box'] }, ctx)).toMatchObject({
      done: 'c1 wears no class'
    });
    expect(await setClassesTool.execute({ ref: 'c1', add: ['no-such-class'] }, ctx)).toMatchObject({ done: false });
  });

  it('adds a page at its slug', async () => {
    const { ctx, saved } = context();

    expect(await addPageTool.execute({ ref: 'pricing', slug: 'pricing' }, ctx)).toMatchObject({
      done: 'page pricing added at /pricing'
    });
    expect(saved().schema.pages).toContain('pricing');
  });
});
