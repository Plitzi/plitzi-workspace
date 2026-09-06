import { describe, expect, it } from 'vitest';

import { fontLinkAssets } from './fontAssets';

import type { FontHead } from '../types/StyleTypes';

const head = (overrides: Partial<FontHead> = {}): FontHead => ({
  preconnect: [],
  links: [],
  faces: '',
  origins: [],
  ...overrides
});

describe('fontLinkAssets', () => {
  it('hands the rail the stylesheets a frame has to load', () => {
    const assets = fontLinkAssets(
      head({ links: [{ href: 'https://fonts.googleapis.com/css2?family=Lato:wght@400', rel: 'stylesheet' }] })
    );

    expect(Object.values(assets)).toEqual([
      {
        type: 'link',
        id: 'font-0',
        params: { href: 'https://fonts.googleapis.com/css2?family=Lato:wght@400', type: 'text/css', rel: 'stylesheet' }
      }
    ]);
  });

  it('leaves out the hints a design surface has no use for', () => {
    const assets = fontLinkAssets(
      head({
        preconnect: [{ href: 'https://fonts.gstatic.com', crossorigin: true }],
        links: [{ href: '/fonts/a.woff2', rel: 'preload', as: 'font', crossorigin: true }]
      })
    );

    expect(assets).toEqual({});
  });
});
