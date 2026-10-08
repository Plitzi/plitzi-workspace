import { canvasIconsAssets } from './canvasIcons';

describe('canvasIconsAssets', () => {
  it('links the sheet where the host serves it', () => {
    expect(canvasIconsAssets('/sdk-assets/plitzi-sdk-icons.css?v=1')).toEqual({
      'sdk-icons': {
        type: 'link',
        id: 'sdk-icons',
        params: { href: '/sdk-assets/plitzi-sdk-icons.css?v=1', type: 'text/css', rel: 'stylesheet' }
      }
    });
  });

  it('links nothing when the host serves no sheet', () => {
    expect(canvasIconsAssets('')).toEqual({});
  });
});
