import { describe, expect, it } from 'vitest';

import { offlineDocuments } from './offlineDocuments';

const documents = {
  schema: { flat: {}, pages: [], definition: { name: 'Widget', permanentUrl: '' }, variables: [], settings: {} },
  style: {
    platform: { desktop: {}, tablet: {}, mobile: {} },
    theme: { default: 'system', schemes: [] },
    variables: {},
    cache: ''
  }
};

describe('offlineDocuments', () => {
  it('hands back documents with a schema and a compiled style', () => {
    expect(offlineDocuments(documents)).toEqual({ documents });
  });

  it.each([
    ['a schema without pages', { ...documents, schema: { flat: {} } }, '`schema` has no `flat` and `pages`'],
    [
      'a style never compiled',
      { ...documents, style: { platform: {} } },
      '`style` has no `platform` and compiled `cache`'
    ]
  ])('says why %s cannot be drawn', (_label, value, reason) => {
    expect(offlineDocuments(value)).toEqual({ problem: `The documents cannot be drawn: ${reason}.` });
  });

  it('says what is not an object at all', () => {
    expect(offlineDocuments('not documents')).toEqual({
      problem: 'The documents cannot be drawn: they are not an object with `schema` and `style`.'
    });
  });

  it('waits for the half that has not been bound yet', () => {
    expect(offlineDocuments({ schema: documents.schema })).toEqual({ waiting: ['style'] });
    expect(offlineDocuments({})).toEqual({ waiting: ['schema', 'style'] });
  });
});
