import { describe, expect, it } from 'vitest';

import { PREVIEW_SLUG, previewCopyId } from '@plitzi/sdk-shared/project';

import { authorSpace, container, heading } from './index';
import { parsePreview, withPreview } from './preview';

import type { SpaceSpec } from './index';

const space: SpaceSpec = {
  name: 'Preview',
  permanentUrl: 'preview',
  layouts: [{ id: 'site', body: [heading('Site', { id: 'site-title' }), container({ id: 'site-main' })] }],
  components: [
    {
      id: 'plan-card',
      props: { name: { type: 'text', description: 'The plan' } },
      root: container({ id: 'plan-card-root', children: [heading('{{ props.name }}', { id: 'plan-card-name' })] })
    }
  ],
  pages: [{ id: 'home', name: 'Home', slug: '', layout: { id: 'site', slot: 'site-main' }, body: [] }]
};

// A run's reviewers could not look at a component, or a plugin, no page placed yet: they wrote probe pages by hand.
describe('an element drawn alone', () => {
  it('is a component’s copies, each with its props, on a page of their own in no layout', () => {
    const { schema } = authorSpace(withPreview(space, { element: 'plan-card', copies: [{ name: 'Pro' }, {}] }));
    const page = Object.values(schema.flat).find(each => each.attributes.slug === PREVIEW_SLUG);

    expect(page?.attributes).not.toHaveProperty('layout');
    expect(schema.flat[previewCopyId(0)].attributes).toMatchObject({ referenceId: 'plan-card', name: 'Pro' });
    expect(schema.flat[previewCopyId(1)].attributes).toMatchObject({ referenceId: 'plan-card' });
  });

  it('is an element type’s copies, each with its attributes', () => {
    const { schema } = authorSpace(withPreview(space, { element: 'heading', copies: [{ content: 'Alone' }] }));

    expect(schema.flat[previewCopyId(0)]).toMatchObject({
      definition: { type: 'heading' },
      attributes: { content: 'Alone' }
    });
  });

  it('is refused where the space has a page at its address, and a file that is not one says what to write', () => {
    const taken: SpaceSpec = {
      ...space,
      pages: [...space.pages, { id: 'mine', name: 'Mine', slug: PREVIEW_SLUG, body: [] }]
    };

    expect(() => withPreview(taken, { element: 'plan-card', copies: [{}] })).toThrow(/has a page at \/plitzi-preview/);
    expect(() => withPreview(space, { element: 'planCardd', copies: [{}] }, ['vzButton'])).toThrow(
      /"planCardd" is no component of the space and no element type to draw alone: its components are plan-card; its plugins' elements vzButton/
    );
    expect(() => withPreview(space, { element: 'vzButton', copies: [{}] }, ['vzButton'])).not.toThrow();
    expect(parsePreview({ copies: [{}] })).toMatchObject({ problem: /it names no element/ });
    expect(parsePreview({ element: 'plan-card', copies: [] })).toMatchObject({
      problem: /\[\{\}\] draws one as it is declared/
    });
    expect(parsePreview({ element: 'plan-card', copies: [{ name: 'Pro' }] })).toEqual({
      element: 'plan-card',
      copies: [{ name: 'Pro' }]
    });
  });
});
