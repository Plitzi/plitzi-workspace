// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import { loadImages } from './images';

afterEach(() => {
  document.body.innerHTML = '';
});

// velada-dress: the overlay's own preview, a lazy embed loaded before anything listened, "had not loaded" — and the
// picture waited its whole budget for a load that had come and gone.
describe('loadImages, of embeds', () => {
  it('counts an embed of this site loaded already as loaded, and waits for none of it', async () => {
    const embed = document.createElement('iframe');
    embed.setAttribute('loading', 'lazy');
    embed.setAttribute('src', '/overlay/obs');
    document.body.append(embed);
    // Loaded before anything listened — jsdom loads no frame: its document is said to be, as a browser's would be.
    Object.defineProperty(embed, 'contentDocument', {
      get: () => ({ readyState: 'complete', URL: 'http://localhost/overlay/obs' })
    });

    const started = Date.now();
    const loaded = await loadImages(2000);

    expect(loaded.embedsMissing).toBe(0);
    expect(Date.now() - started).toBeLessThan(1500);
  });
});
