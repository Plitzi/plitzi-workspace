import { describe, expect, it } from 'vitest';

import manifestAssetToAsset from './manifestAssetToAsset';

describe('manifestAssetToAsset', () => {
  it('links a stylesheet, its id the URL base64', () => {
    expect(manifestAssetToAsset('https://cdn.example.com/p', { src: 'style.css', type: 'style' })).toEqual({
      type: 'link',
      id: btoa('https://cdn.example.com/p/style.css'),
      params: { href: 'https://cdn.example.com/p/style.css', rel: 'stylesheet', type: 'text/css' },
      isMain: undefined
    });
  });

  it('loads anything else as a script, saying whether it is the main one', () => {
    expect(manifestAssetToAsset('https://cdn.example.com/p', { src: 'main.js', type: 'script', isMain: true })).toEqual(
      {
        type: 'script',
        id: btoa('https://cdn.example.com/p/main.js'),
        params: { src: 'https://cdn.example.com/p/main.js', type: 'text/javascript' },
        isMain: true
      }
    );
    // A "style" that is not a stylesheet is loaded as what it is.
    expect(manifestAssetToAsset('https://cdn.example.com/p', { src: 'theme.js', type: 'style' })).toMatchObject({
      type: 'script'
    });
  });

  it("leaves isMain out of a settings' asset", () => {
    expect(
      manifestAssetToAsset('https://cdn.example.com/p', { src: 'settings.mjs', type: 'script', isMain: true }, true)
    ).not.toHaveProperty('isMain');
  });
});
