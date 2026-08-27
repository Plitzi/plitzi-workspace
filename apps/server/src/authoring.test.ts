import { describe, expect, it } from 'vitest';

import * as fromServer from './authoring';

/**
 * The two doors onto the authoring surface have to be the same door.
 *
 * `@plitzi/sdk-server/authoring` exists so a server does not install a browser SDK to write a page, and the moment
 * it exports anything different from `@plitzi/plitzi-sdk/authoring` it becomes a second surface to keep up to
 * date — which is the thing this whole arrangement exists to avoid.
 */
describe('the authoring entry', () => {
  it('re-exports the SDK surface, whole', async () => {
    const fromSdk = (await import('@plitzi/plitzi-sdk/authoring')) as Record<string, unknown>;

    expect(Object.keys(fromServer).sort()).toEqual(Object.keys(fromSdk).sort());
  });

  it('brings every fragment: elements, style, interactions and the schema that writes them', () => {
    expect(typeof fromServer.heading).toBe('function');
    expect(typeof fromServer.css).toBe('function');
    expect(typeof fromServer.onClick).toBe('function');
    expect(typeof fromServer.setState).toBe('function');
    expect(typeof fromServer.authorSpace).toBe('function');
    expect(typeof fromServer.validateSpace).toBe('function');
  });

  it('authors a space end to end, in Node, with no browser anywhere', () => {
    const { schema, style, warnings } = fromServer.authorSpace({
      name: 'Smoke',
      permanentUrl: 'smoke',
      classes: { card: { padding: '24px 16px', 'border-radius': '8px' } },
      pages: [
        {
          name: 'Home',
          slug: '',
          body: [fromServer.container({ class: 'card', children: [fromServer.heading('Hello', { subType: 'h2' })] })]
        }
      ]
    });

    expect(Object.keys(schema.flat)).toHaveLength(3);
    expect(style.platform.desktop.card.attributes.base.default).toMatchObject({ 'padding-top': '24px' });
    expect(warnings).toEqual([]);
  });
});

/**
 * The half of a flow no document can check about itself.
 *
 * A step names an action and the module it runs on, and the runtime resolves the pair as
 * `callbacksAvailables[<on>][<action>]`. When it names nothing the control does nothing — silently. This entry is
 * where the vocabulary and the writer of documents finally meet, so it is where the pair gets held to something.
 */
describe('the step vocabulary', () => {
  const spaceWith = (flow: fromServer.StepSpec[]) => ({
    name: 'Flows',
    permanentUrl: 'flows',
    pages: [
      {
        name: 'Home',
        slug: '',
        body: [fromServer.button({ idRef: 'go', content: 'Go', flows: [flow] })]
      }
    ]
  });

  it('accepts what the step builders write', () => {
    const authored = fromServer.authorSpace(
      spaceWith([fromServer.onClick(), fromServer.authLogin({ mode: 'normal', username: 'ada', password: 'pw' })])
    );

    expect(authored.warnings).toEqual([]);
  });

  /** The exact shape that shipped: a real action, named on a module that never registered it. */
  it('refuses a global callback on the wrong module', () => {
    expect(() =>
      fromServer.authorSpace(spaceWith([fromServer.onClick(), { type: 'globalCallback', action: 'login', on: 'go' }]))
    ).toThrow(/registered on "auth"/);
  });

  /** No module at all is written into the document as `elementId: null`, which resolves to nothing. */
  it('refuses a global callback with no module', () => {
    expect(() =>
      fromServer.authorSpace(spaceWith([fromServer.onClick(), { type: 'globalCallback', action: 'login' }]))
    ).toThrow(/on no module/);
  });

  it('refuses a utility given a module, which is resolved by action alone', () => {
    expect(() =>
      fromServer.authorSpace(spaceWith([fromServer.onClick(), { type: 'utility', action: 'delayTime', on: 'go' }]))
    ).toThrow(/takes no module/);
  });

  /**
   * Warned rather than refused, and the difference matters: a plugin may register a module of its own, and a
   * process authoring a space cannot see what a browser will later load.
   */
  it('warns about an action no built-in source declares, and still authors', () => {
    const authored = fromServer.authorSpace(
      spaceWith([fromServer.onClick(), { type: 'globalCallback', action: 'acmeCheckout', on: 'acme' }])
    );

    expect(authored.warnings).toMatchObject([{ code: 'unknown-global-callback' }]);
    expect(Object.keys(authored.schema.flat)).toHaveLength(2);
  });

  /** A trigger, an element callback and a task belong to an element type or to a server; none is knowable here. */
  it('leaves triggers and element callbacks alone', () => {
    const authored = fromServer.authorSpace(
      spaceWith([fromServer.onClick(), fromServer.updateElement({ category: 'attribute', key: 'content', value: 'x' })])
    );

    expect(authored.warnings).toEqual([]);
  });
});
