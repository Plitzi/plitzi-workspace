import { describe, expect, it } from 'vitest';

import * as authoring from './index';

import type { StepSpec } from './index';

/**
 * The surface, in the environment it exists for.
 *
 * Every fragment is tested by the package that owns it. What only this package can answer is whether the five of
 * them compose into one import that works in Node, with no browser and nothing React anywhere near it — which is
 * the whole reason it is a package rather than a folder.
 */
describe('the authoring surface', () => {
  it('brings every fragment: elements, style, interactions and the schema that writes them', () => {
    expect(typeof authoring.heading).toBe('function');
    expect(typeof authoring.css).toBe('function');
    expect(typeof authoring.onClick).toBe('function');
    expect(typeof authoring.setState).toBe('function');
    expect(typeof authoring.authorSpace).toBe('function');
    expect(typeof authoring.validateSpace).toBe('function');
    expect(typeof authoring.authorTemplate).toBe('function');
    expect(typeof authoring.validateTemplate).toBe('function');
  });

  it('authors a space end to end, in Node, with no browser anywhere', () => {
    const { schema, style, warnings } = authoring.authorSpace({
      name: 'Smoke',
      permanentUrl: 'smoke',
      classes: { card: { padding: '24px 16px', 'border-radius': '8px' } },
      pages: [
        {
          name: 'Home',
          slug: '',
          body: [authoring.container({ class: 'card', children: [authoring.heading('Hello', { subType: 'h2' })] })]
        }
      ]
    });

    expect(Object.keys(schema.flat)).toHaveLength(3);
    expect(style.platform.desktop.card.attributes.base.default).toMatchObject({ 'padding-top': '24px' });
    expect(warnings).toEqual([]);
  });

  it('authors a template, and it is a manifest a builder can fetch', () => {
    const { template, warnings } = authoring.authorTemplate({
      name: 'Pricing card',
      description: 'A price and a call to action.',
      classes: { card: { padding: '24px', 'border-radius': '8px' } },
      root: authoring.container({
        class: 'card',
        children: [authoring.heading('$19', { subType: 'h3' }), authoring.button({ content: 'Start' })]
      })
    });

    expect(warnings).toEqual([]);
    expect(template.schema.pages).toEqual([]);
    expect(template.schema.flat[template.definition.baseElementId].definition.parentId).toBeUndefined();
    expect(JSON.parse(JSON.stringify(template))).toEqual(template);
  });
});

/**
 * The half of a flow no document can check about itself.
 *
 * A step names an action and the module it runs on, and the runtime resolves the pair as
 * `callbacksAvailables[<on>][<action>]`. When it names nothing the control does nothing — silently. This package is
 * where the vocabulary and the writer of documents finally meet, so it is where the pair gets held to something.
 */
describe('the step vocabulary', () => {
  const spaceWith = (flow: StepSpec[]) => ({
    name: 'Flows',
    permanentUrl: 'flows',
    pages: [
      {
        name: 'Home',
        slug: '',
        body: [authoring.button({ idRef: 'go', content: 'Go', flows: [flow] })]
      }
    ]
  });

  it('accepts what the step builders write', () => {
    const authored = authoring.authorSpace(
      spaceWith([authoring.onClick(), authoring.authLogin({ mode: 'normal', username: 'ada', password: 'pw' })])
    );

    expect(authored.warnings).toEqual([]);
  });

  /** The exact shape that shipped: a real action, named on a module that never registered it. */
  it('refuses a global callback on the wrong module', () => {
    expect(() =>
      authoring.authorSpace(spaceWith([authoring.onClick(), { type: 'globalCallback', action: 'login', on: 'go' }]))
    ).toThrow(/registered on "auth"/);
  });

  /** No module at all is written into the document as `elementId: null`, which resolves to nothing. */
  it('refuses a global callback with no module', () => {
    expect(() =>
      authoring.authorSpace(spaceWith([authoring.onClick(), { type: 'globalCallback', action: 'login' }]))
    ).toThrow(/on no module/);
  });

  it('refuses a utility given a module, which is resolved by action alone', () => {
    expect(() =>
      authoring.authorSpace(spaceWith([authoring.onClick(), { type: 'utility', action: 'delayTime', on: 'go' }]))
    ).toThrow(/takes no module/);
  });

  /**
   * Warned rather than refused, and the difference matters: a plugin may register a module of its own, and a
   * process authoring a space cannot see what a browser will later load.
   */
  it('warns about an action no built-in source declares, and still authors', () => {
    const authored = authoring.authorSpace(
      spaceWith([authoring.onClick(), { type: 'globalCallback', action: 'acmeCheckout', on: 'acme' }])
    );

    expect(authored.warnings).toMatchObject([{ code: 'unknown-global-callback' }]);
    expect(Object.keys(authored.schema.flat)).toHaveLength(2);
  });

  /** A trigger, an element callback and a task belong to an element type or to a server; none is knowable here. */
  it('leaves triggers and element callbacks alone', () => {
    const authored = authoring.authorSpace(
      spaceWith([authoring.onClick(), authoring.updateElement({ category: 'attribute', key: 'content', value: 'x' })])
    );

    expect(authored.warnings).toEqual([]);
  });
});
