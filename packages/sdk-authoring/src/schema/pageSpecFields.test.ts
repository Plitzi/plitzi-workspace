import { describe, expect, it } from 'vitest';

import { authorSpace, PAGE_SPEC_FIELDS } from '../index';

import type { PageSpec } from '../index';

// The table an edit of a page writes by is the one authoring reads by: every field lands on its attribute.
describe('PAGE_SPEC_FIELDS', () => {
  it('names, for each attribute, the field of the page that writes it', () => {
    const page: PageSpec = {
      id: 'about',
      name: 'About',
      slug: 'about',
      isDefault: true,
      folder: 'company',
      accessLevel: 'authenticated',
      seoTitle: 'About — Example',
      seoDescription: 'Who we are.',
      body: []
    };
    const { schema } = authorSpace({
      name: 'Fields',
      permanentUrl: 'fields',
      pageFolders: [{ id: 'company', name: 'Company', slug: 'company' }],
      pages: [page]
    });
    const attributes = schema.flat.about.attributes;

    for (const [attribute, field] of Object.entries(PAGE_SPEC_FIELDS)) {
      expect([attribute, attributes[attribute]]).toEqual([attribute, page[field]]);
    }
  });
});
