import { describe, expect, it } from 'vitest';

import { specFromSpace } from './specFromSpace';
import { authorSpace } from '../index';
import { styles } from '../style';

import type { SpaceSpec } from '../index';

const avatar = styles('avatar', { css: { width: '22px' }, variants: { violet: { 'background-color': '#5B3DF5' } } });

/** A variant keyed by a class the element wears reads back as `variant`, and authors into the same key again. */
describe('specFromSpace / a class variant the element starts in', () => {
  const space: SpaceSpec = {
    name: 'Avatars',
    permanentUrl: 'avatars',
    classes: { avatar },
    pages: [
      {
        name: 'Home',
        slug: '',
        body: [{ type: 'text', id: 'mara', class: 'avatar', variant: 'violet', attributes: { content: 'MR' } }]
      }
    ]
  };

  it('reads it back without a correction, and round-trips to the same document', () => {
    const documents = authorSpace(space);
    const { spec, corrections } = specFromSpace(documents);

    expect(corrections.filter(correction => correction.code === 'dropped-initial-state')).toEqual([]);
    expect(authorSpace(spec).schema.flat.mara.definition.initialState).toEqual(
      documents.schema.flat.mara.definition.initialState
    );
  });
});
