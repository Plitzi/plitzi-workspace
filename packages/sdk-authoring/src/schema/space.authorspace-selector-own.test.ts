import { describe, expect, it } from 'vitest';

import { authorSpace } from './index';

import type { ElementSpec, SpaceSpec } from './index';

describe('authorSpace / a selector of its own', () => {
  const withBody = (body: ElementSpec[]): SpaceSpec => ({
    name: 'Named',
    permanentUrl: 'named',
    classes: { card: { padding: '8px' } },
    pages: [{ name: 'Home', slug: '', selector: 'page-Qx7a', css: { display: 'flex' }, body }]
  });

  // The name the builder gave it is the one its style editor, a stylesheet outside the document and the next export
  // know it by — derived again from where the element sits, it would be a different selector with the same rules.
  it('keeps the name it was given, rules and all', () => {
    const { schema, style } = authorSpace(
      withBody([{ type: 'container', id: 'hero', selector: 'container-Ab3x', css: { gap: '4px' } }])
    );

    expect(schema.flat.hero.definition.styleSelectors.base).toBe('container-Ab3x');
    expect(schema.flat[schema.pages[0]].definition.styleSelectors.base).toBe('page-Qx7a');
    expect(style.platform.desktop['container-Ab3x'].attributes.base.default).toMatchObject({ 'row-gap': '4px' });
  });

  it('refuses a name another element or a class already answers to', () => {
    expect(() =>
      authorSpace(
        withBody([
          { type: 'container', selector: 'container-Ab3x', css: { gap: '4px' } },
          { type: 'container', selector: 'container-Ab3x', css: { gap: '8px' } }
        ])
      )
    ).toThrow(/another element already names/);
    expect(() => authorSpace(withBody([{ type: 'container', selector: 'card', css: { gap: '4px' } }]))).toThrow(
      /is a class this space declares/
    );
    expect(() => authorSpace(withBody([{ type: 'container', selector: 'card', class: 'card' }]))).toThrow(
      /A shared class IS its selector/
    );
  });
});
