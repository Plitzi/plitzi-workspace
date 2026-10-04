/* eslint-disable quotes -- the assertions quote source code, which reads best in the other quotes */
import { describe, expect, it } from 'vitest';

import { CATALOG_TEMPLATE_IDENTITY, catalogTemplateFiles } from './index';
import { space } from '../../templates/catalog/src/space';
import { authorSpace, validateSpace } from '../schema';

/** The catalog template is a project's first files: it has to author clean, and be the site it says it is. */
describe('templates/catalog', () => {
  const { schema, style, warnings, suggestions } = authorSpace(space);

  // Nor anything to suggest: the first `npm run author` of a new project is what it learns the space's idiom from.
  it('authors a valid space with nothing to warn about or suggest', () => {
    expect(validateSpace({ schema, style }).valid).toBe(true);
    expect(warnings).toEqual([]);
    expect(suggestions.map(suggestion => `${suggestion.code}: ${suggestion.message}`)).toEqual([]);
  });

  it('is a home, a catalog and a page per product, in one layout', () => {
    expect(schema.pages).toEqual(['home', 'catalog', 'product']);
    expect(Object.keys(schema.components)).toEqual(['product-card']);
  });

  it('hands a project its files, the space under the project′s name', () => {
    const files = catalogTemplateFiles({ name: 'Paper Shop' });

    expect(space).toMatchObject(CATALOG_TEMPLATE_IDENTITY);
    expect(Object.keys(files)).toContain('public/data/products.json');
    expect(files['src/space.ts']).toContain("name: 'Paper Shop',");
    expect(files['src/space.ts']).toContain("permanentUrl: 'paper-shop',");
    expect(files['src/site/data.ts']).toContain("from '@plitzi/sdk-authoring'");
    expect(Object.values(files).filter(source => source.includes('eslint-disable'))).toEqual([]);
  });
});
