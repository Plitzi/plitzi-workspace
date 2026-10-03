import { describe, expect, it } from 'vitest';

import { isSnippet } from './snippet';

const snippet = () => ({
  definition: { name: 'Card', description: '', baseElementId: 'card' },
  schema: {
    flat: { card: { id: 'card', attributes: {}, definition: { label: 'Card', type: 'container', rootId: 'card' } } },
    variables: []
  },
  style: { platform: { desktop: {}, tablet: {}, mobile: {} } }
});

describe('isSnippet', () => {
  it('takes a snippet, whoever wrote it', () => {
    expect(isSnippet(snippet())).toBe(true);
  });

  it('refuses a JSON that is something else', () => {
    expect(isSnippet({ name: 'package', version: '1.0.0' })).toBe(false);
    expect(isSnippet([snippet()])).toBe(false);
    expect(isSnippet(null)).toBe(false);
  });

  it('refuses one whose base element is not among its elements', () => {
    expect(isSnippet({ ...snippet(), definition: { name: 'Card', description: '', baseElementId: 'gone' } })).toBe(
      false
    );
  });

  it('refuses one without the variables or the style it needs', () => {
    const { schema, ...rest } = snippet();

    expect(isSnippet({ ...rest, schema: { flat: schema.flat } })).toBe(false);
    expect(isSnippet({ ...snippet(), style: {} })).toBe(false);
  });
});
