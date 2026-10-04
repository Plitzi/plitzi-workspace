import { afterEach, describe, expect, it } from 'vitest';

import { MOTION_SEEN_ATTRIBUTE } from '@plitzi/sdk-shared/schema/motion';

import { liveCanvas } from './liveCanvas';

describe('liveCanvas', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('marks the root live, and takes the mark off when stopped', () => {
    const root = document.createElement('div');
    const stop = liveCanvas(root, { reveal: true });

    expect(root.getAttribute('data-hydrated')).toBe('');

    stop();

    expect(root.hasAttribute('data-hydrated')).toBe(false);
  });

  it('plays the arrivals that wait to be seen', () => {
    const root = document.createElement('div');
    root.innerHTML = '<div data-motion-on="view" data-motion-enter="fade"></div>';
    document.body.append(root);
    const stop = liveCanvas(root, { reveal: true });

    // jsdom has no IntersectionObserver: an arrival is shown at once, as on a browser that cannot know what is in view.
    expect(root.firstElementChild?.hasAttribute(MOTION_SEEN_ATTRIBUTE)).toBe(true);

    stop();
  });

  it('leaves the arrivals alone without `reveal`: Play plays them all at once', () => {
    const root = document.createElement('div');
    root.innerHTML = '<div data-motion-on="view" data-motion-enter="fade"></div>';
    document.body.append(root);
    const stop = liveCanvas(root, { reveal: false });

    expect(root.getAttribute('data-hydrated')).toBe('');
    expect(root.firstElementChild?.hasAttribute(MOTION_SEEN_ATTRIBUTE)).toBe(false);

    stop();
  });
});
