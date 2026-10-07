/* eslint-disable quotes -- the assertions quote source code, which reads best in the other quotes */
import { describe, expect, it } from 'vitest';

import { CATALOG_TEMPLATE_IDENTITY, catalogTemplateFiles } from './index';
import { space } from '../../templates/catalog/src/space/index';
import { authorSpace } from '../index';
import { validateSpace } from '../schema';

/** The catalog template is a project's first files: it has to author clean, and be the site it says it is. */
describe('templates/catalog', () => {
  const { schema, style, warnings, suggestions } = authorSpace(space);

  // Nor anything to suggest: the first `npm run author` of a new project is what it learns the space's idiom from.
  it('authors a valid space with nothing to warn about or suggest', () => {
    expect(validateSpace({ schema, style }).valid).toBe(true);
    expect(warnings).toEqual([]);
    expect(suggestions.map(suggestion => `${suggestion.code}: ${suggestion.message}`)).toEqual([]);
  });

  it('is a home, a catalog, a page per product and one for an unknown address, in one layout', () => {
    expect(schema.pages).toEqual(['home', 'catalog', 'product', 'not-found']);
    expect(Object.keys(schema.components)).toEqual(['product-card']);
  });

  it('hands a project its files, the space under the project′s name', () => {
    const files = catalogTemplateFiles({ name: 'Paper Shop' });

    expect(space).toMatchObject(CATALOG_TEMPLATE_IDENTITY);
    expect(Object.keys(files)).toContain('src/data/products.json');
    expect(files['src/space/index.ts']).toContain("name: 'Paper Shop',");
    expect(files['src/space/index.ts']).toContain("permanentUrl: 'paper-shop',");
    expect(files['src/space/data.ts']).toContain("from '@plitzi/sdk-authoring'");
    expect(Object.values(files).filter(source => source.includes('eslint-disable'))).toEqual([]);
  });

  it('reads its data on the server, from the project’s own `src/data/` — which nothing serves', () => {
    expect(schema.flat['home-products'].definition.runtime).toBe('server');
    expect(catalogTemplateFiles()['src/space/data.ts']).toContain("from '../data/products.json'");
  });

  it('has a project with no server fetch it from `public/`, in the browser', () => {
    const files = catalogTemplateFiles({ mode: 'client' });

    expect(Object.keys(files)).toContain('public/data/products.json');
    expect(Object.keys(files)).not.toContain('src/data/products.json');
    expect(files['src/space/data.ts']).toContain("from '../../public/data/products.json'");
    expect(files['src/space/data.ts']).toContain("export const PRODUCTS = { query: '/data/products.json' } as const;");
    expect(files['src/space/data.ts']).not.toContain('src/data');
    expect(files['src/space/index.ts']).toContain('`public/data/products.json`, served by this project');
  });
});
