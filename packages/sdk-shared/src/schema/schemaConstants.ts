import { EMPTY_STYLE_SCHEMA } from '../style';

import type { Schema, Style } from '../types';

export const VARIABLE_REGEX = /var\(\s*--([a-zA-Z0-9_-]+)\s*\)|\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/;

export const EMPTY_SCHEMA: { schema: Schema; style: Style; definition: { rootId: string } } = {
  schema: {
    definition: { name: '', permanentUrl: '' },
    flat: {},
    variables: [],
    settings: { customCss: '' },
    pages: [],
    pageFolders: []
  },
  style: EMPTY_STYLE_SCHEMA,
  definition: { rootId: '' } // for segments and templates
};
