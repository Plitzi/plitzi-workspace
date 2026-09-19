import { describe, expect, it } from 'vitest';

import { EMPTY_STYLE_SCHEMA } from '@plitzi/sdk-shared/style/styleConstants';

import { elementDetailToAI, pageStylesToAI } from './translator';

import type { Schema, Style, StyleItem } from '@plitzi/sdk-shared';

const item = (name: string): StyleItem => ({
  name,
  type: 'class',
  cache: '',
  attributes: { base: { default: { color: 'red' } } }
});

const schema: Schema = {
  flat: {
    home: {
      id: 'home',
      attributes: { slug: '', name: 'Home', default: true },
      definition: { rootId: 'home', label: 'Page', type: 'page', items: ['field'], styleSelectors: { base: '' } }
    },
    field: {
      id: 'field',
      attributes: {},
      definition: {
        rootId: 'home',
        parentId: 'home',
        label: 'Field',
        type: 'formControl',
        items: [],
        styleSelectors: { base: 'panel wide', input: 'control compact' }
      }
    }
  },
  definition: { name: 'Stacked', permanentUrl: 'stacked' },
  variables: [],
  settings: { customCss: '' },
  pages: ['home'],
  pageFolders: []
};

const style: Style = {
  ...EMPTY_STYLE_SCHEMA,
  platform: {
    desktop: Object.fromEntries(['panel', 'wide', 'control', 'compact', 'unused'].map(name => [name, item(name)])),
    tablet: {},
    mobile: {}
  }
};

describe('several classes on one selector', () => {
  it('lists each class of the base and of a slot on the element', () => {
    const detail = elementDetailToAI(schema, schema.flat.field, style);

    expect(detail.style).toEqual({ base: ['panel', 'wide'], slots: { input: ['control', 'compact'] } });
  });

  it('reads the rules of every class the page names, one by one, and none it does not', () => {
    const { definitions } = pageStylesToAI(schema, style, schema.flat.home);

    expect(definitions.map(definition => definition.ref).sort()).toEqual(['compact', 'control', 'panel', 'wide']);
  });
});
