import { describe, expect, it } from 'vitest';

import isSnippetFile from './isSnippetFile';

const json = (value: unknown) => new File([JSON.stringify(value)], 'card.json', { type: 'application/json' });

describe('isSnippetFile', () => {
  it('knows a snippet by what it holds, not by its name', async () => {
    const snippet = {
      definition: { name: 'Card', description: '', baseElementId: 'card' },
      schema: { flat: { card: { id: 'card' } }, variables: [] },
      style: { platform: {} }
    };

    expect(await isSnippetFile(json(snippet))).toBe(true);
  });

  it('leaves any other JSON a file, and text that is no JSON too', async () => {
    expect(await isSnippetFile(json({ name: 'package' }))).toBe(false);
    expect(await isSnippetFile(new File(['{ nope'], 'broken.json', { type: 'application/json' }))).toBe(false);
  });
});
