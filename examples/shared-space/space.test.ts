import { describe, expect, it } from 'vitest';

import { readOfflineData } from './index.js';
import { offlineData, sampleSpace } from './space';

describe('the sample space', () => {
  it('authors the page every example renders', () => {
    const { schema, style, warnings } = offlineData();

    expect(schema.pages).toHaveLength(1);
    expect(Object.keys(schema.flat)).toHaveLength(31);
    expect(style.platform.desktop.page).toBeDefined();
    expect(warnings).toEqual([]);
  });

  it('is what the checked-in JSON holds — the file two examples read without a build', () => {
    // Ids are derived from the declaration, so this is a byte comparison and not an approximation. Run
    // `yarn author` when it fails on purpose.
    expect(readOfflineData()).toEqual(JSON.parse(JSON.stringify(offlineData())));
  });

  it('carries the palette an example inherits by spreading it', () => {
    expect(sampleSpace.variables?.color?.foreground).toMatchObject({ dark: '#fafafa' });
  });
});
