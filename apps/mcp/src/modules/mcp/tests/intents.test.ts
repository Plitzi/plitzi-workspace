import { describe, expect, it } from 'vitest';

import { buildSpace, capturing } from './helpers';
import { apply, NOTHING_CHANGED } from '../tools/apply';
import { addPageTool, setAttributesTool, setClassesTool } from '../tools/intents';

import type { ToolContext } from '../tools/shared/tool';

const context = () => {
  const space = buildSpace();
  const cap = capturing(space);
  const ctx: ToolContext = { space, env: 'main', persisters: cap.persisters, spaceId: 1 };

  return { ctx, saved: cap.saved };
};

// An intention is a few parameters, the page found for the agent, and an answer of what it did — read off the space,
// never a restatement of what was asked.
describe('the intent tools', () => {
  it('sets an element’s attributes by its ref alone, and answers what changed', async () => {
    const { ctx, saved } = context();

    expect(await setAttributesTool.execute({ ref: 'c1', set: { subType: 'article' } }, ctx)).toEqual({
      done: true,
      saved: true,
      effects: ['c1.subType: "section" → "article"'],
      next: 'plitzi_look { pageRef: "home" } to see it'
    });
    expect(saved().schema.flat.c1.attributes.subType).toBe('article');
  });

  // The agent believed something that was already so: said, so its picture of the element is put right.
  it('says what was already so, and that nothing changed', async () => {
    const { ctx } = context();

    expect(
      await setAttributesTool.execute({ ref: 'c1', set: { subType: 'section' }, unset: ['tag'] }, ctx)
    ).toMatchObject({
      done: true,
      effects: [],
      warnings: ['subType was already "section"', 'tag was not set', NOTHING_CHANGED]
    });
  });

  // A page is not an element of one: said so, never "no element home — did you mean home?".
  it('says a page is a page, and suggests only elements', async () => {
    const { ctx } = context();

    expect(await setClassesTool.execute({ ref: 'home', add: ['box'] }, ctx)).toEqual({
      done: false,
      errors: [
        {
          code: 'bad-value',
          path: 'ref',
          message: '"home" is a page, not an element on one: this tool edits the elements inside it',
          hint: 'plitzi://schema/{env}/pages/home lists them by ref; plitzi_apply upsertPage { ref: "home", style: { base: [...] } } gives the page its own classes'
        }
      ]
    });
    expect(await setClassesTool.execute({ ref: 'c2', add: ['box'] }, ctx)).toMatchObject({
      errors: [{ message: 'There is no element "c2" — did you mean "c1"?' }]
    });
  });

  it('refuses a value for an attribute a binding computes', async () => {
    const { ctx } = context();
    ctx.space.schema.flat.c1.definition.bindings = { attributes: [{ id: 'b1', to: 'subType', source: 'state.tag' }] };

    expect(await setAttributesTool.execute({ ref: 'c1', set: { subType: 'article' } }, ctx)).toMatchObject({
      done: false,
      errors: [
        {
          path: 'subType',
          message:
            'subType of c1 is bound to state.tag: the page shows what the binding computes, not a value written here'
        }
      ]
    });
  });

  it('says a change it could not save, by what was not saved', async () => {
    const { ctx } = context();
    ctx.persisters = {};

    expect(await setAttributesTool.execute({ ref: 'c1', set: { subType: 'article' } }, ctx)).toMatchObject({
      done: true,
      saved: false,
      warnings: ['NOT saved: the schema — this server has no store to save it in']
    });
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
      done: true,
      effects: ['c1 classes: +card']
    });
    expect(saved().schema.flat.c1.definition.styleSelectors.base.split(' ')).toEqual(['box', 'card']);
    // The server reads the space again for the next call; here, the one just saved.
    ctx.space = { ...ctx.space, ...saved() };
    expect(await setClassesTool.execute({ ref: 'c1', remove: ['box'], add: ['card'] }, ctx)).toMatchObject({
      done: true,
      effects: ['c1 classes: −box'],
      warnings: ['c1 already wore card']
    });
    expect(await setClassesTool.execute({ ref: 'c1', add: ['no-such-class'] }, ctx)).toMatchObject({ done: false });
  });

  // Taking off a class it does not wear would change nothing, and the agent would go on as if it had.
  it('refuses to take off a class the element does not wear', async () => {
    const { ctx } = context();

    expect(await setClassesTool.execute({ ref: 'c1', remove: ['bxo'] }, ctx)).toMatchObject({
      done: false,
      errors: [{ message: 'c1 does not wear "bxo" — did you mean "box"?; it wears box' }]
    });
  });

  it('adds a page at its slug', async () => {
    const { ctx, saved } = context();

    expect(await addPageTool.execute({ ref: 'pricing', slug: 'pricing' }, ctx)).toMatchObject({
      done: true,
      effects: ['pricing (page) added']
    });
    expect(saved().schema.pages).toContain('pricing');
  });
});

// A page's own classes — its background, its padding — are the page's to wear, given by upsertPage.
describe('a page root’s classes', () => {
  it('are given when the page is made, replaced when it is written again, and refused for a class the space lacks', async () => {
    const cap = capturing(buildSpace());
    const made = await apply(
      {
        operations: [
          { type: 'upsertDefinition', ref: 'page-dark', desktop: { 'background-color': '#111111' } },
          { type: 'upsertPage', ref: 'pricing', slug: 'pricing', style: { base: ['page-dark'] } }
        ]
      },
      buildSpace(),
      cap.persisters
    );

    expect(made.applied).toBe(true);
    expect(cap.saved().schema.flat.pricing.definition.styleSelectors).toEqual({ base: 'page-dark' });

    const restyled = await apply(
      { operations: [{ type: 'upsertPage', ref: 'home', style: { base: ['box'] } }] },
      cap.saved(),
      cap.persisters
    );

    expect(restyled.applied).toBe(true);
    expect(cap.saved().schema.flat.home.definition.styleSelectors).toEqual({ base: 'box' });

    const refused = await apply(
      { operations: [{ type: 'upsertPage', ref: 'home', style: { base: ['nope'] } }] },
      cap.saved(),
      cap.persisters
    );

    expect(refused).toMatchObject({ applied: false, errors: [{ code: 'missing', path: 'operations[0].style.base' }] });
  });
});
