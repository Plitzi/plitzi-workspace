import { describe, expect, it } from 'vitest';

import { apiContainer, authorSpace, plitziSdk, singlePageSpace } from '../index';

/** A space drawn inside another: authored like any element, its documents bound from what a source answers. */

const author = (sdk: ReturnType<typeof plitziSdk>) =>
  authorSpace(
    singlePageSpace([apiContainer({ id: 'view', query: '/fn/view', children: [sdk] })], {
      name: 'host',
      permanentUrl: 'host'
    })
  );

describe('plitziSdk', () => {
  it('is a built-in element, authored with no warning', () => {
    const space = author(plitziSdk({ id: 'card', spaceKey: 'abc' }));

    expect(space.warnings).toEqual([]);
    expect(space.schema.flat.card.definition.type).toBe('plitziSdk');
    expect(space.schema.flat.card.attributes).toMatchObject({ spaceKey: 'abc' });
  });

  it('takes its documents whole from what a source answers', () => {
    const space = author(plitziSdk({ id: 'card', bind: { offlineData: 'view.data' } }));

    expect(space.warnings).toEqual([]);
    expect(space.schema.flat.card.definition.bindings?.attributes).toEqual([
      expect.objectContaining({ to: 'offlineData', source: 'apiContainer_view.data' })
    ]);
  });

  it('takes its schema and its style from two sources', () => {
    const space = author(
      plitziSdk({
        id: 'card',
        bind: { 'offlineData.schema': 'view.data.schema', 'offlineData.style': 'view.data.style' }
      })
    );

    expect(space.warnings).toEqual([]);
    expect(space.schema.flat.card.definition.bindings?.attributes?.map(binding => binding.to)).toEqual([
      'offlineData.schema',
      'offlineData.style'
    ]);
  });
});
