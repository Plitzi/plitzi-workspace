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
          body: [
            fromServer.container({ class: 'card', children: [fromServer.heading('Hello', { subType: 'h2' })] })
          ]
        }
      ]
    });

    expect(Object.keys(schema.flat)).toHaveLength(3);
    expect(style.platform.desktop.card.attributes.base.default).toMatchObject({ 'padding-top': '24px' });
    expect(warnings).toEqual([]);
  });
});
