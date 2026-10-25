// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import { applyConditions, clockHeld, conditionsText } from './conditions';
import { actStep } from '../commands/shot/steps';

import type { BrowserPage, PageRoute } from './index';

/** A page that keeps what it was asked to do before it loads: its clock, its init scripts, its routes. */
const pageAsked = () => {
  const scripts: (() => void)[] = [];
  const routes: { matcher: (url: URL) => boolean; handler: (route: PageRoute) => Promise<void> }[] = [];
  const install = vi.fn(() => Promise.resolve());
  const fake = {
    clock: { install, runFor: vi.fn(() => Promise.resolve()), setSystemTime: vi.fn(() => Promise.resolve()) },
    addInitScript: (script: () => void) => {
      scripts.push(script);

      return Promise.resolve();
    },
    route: (matcher: (url: URL) => boolean, handler: (route: PageRoute) => Promise<void>) => {
      routes.push({ matcher, handler });

      return Promise.resolve();
    }
  };

  // Only what applyConditions and a clock step touch: the rest of a page is never reached here.
  return { page: fake as unknown as BrowserPage, scripts, routes, install, clock: fake.clock };
};

// A remembered Listen, a player that does not load and a countdown were each a throwaway Playwright file.
describe('the browser a page is read in', () => {
  it('holds the clock, fails the requests asked, and says so', async () => {
    const { page, routes, install } = pageAsked();
    const time = Date.parse('2026-10-25T20:00:00Z');

    await applyConditions(page, { clock: time, block: ['youtube.com/iframe_api'] });

    expect(install).toHaveBeenCalledWith({ time });
    expect(clockHeld(page)).toBe(true);
    expect(routes[0]?.matcher(new URL('https://www.youtube.com/iframe_api?v=1'))).toBe(true);
    expect(routes[0]?.matcher(new URL('https://acme.test/app.js'))).toBe(false);
    expect(conditionsText({ clock: time, block: ['youtube.com/iframe_api'], storage: 'refused' })).toBe(
      'clock held at 2026-10-25T20:00:00.000Z · blocked: youtube.com/iframe_api · storage refused'
    );
  });

  it('refuses the storages when read, as a browser blocking the site’s data', async () => {
    const { page, scripts } = pageAsked();
    await applyConditions(page, { storage: 'refused' });
    const own = Object.getOwnPropertyDescriptor(window, 'localStorage');
    try {
      scripts.forEach(script => {
        script();
      });

      expect(() => window.localStorage).toThrow('The operation is insecure.');
      expect(() => window.sessionStorage).toThrow('The operation is insecure.');
    } finally {
      if (own) {
        Object.defineProperty(window, 'localStorage', own);
      }
    }
  });

  it('refuses a play with sound before a press, and lets a muted one play', async () => {
    const { page, scripts } = pageAsked();
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
    Object.defineProperty(navigator, 'userActivation', { configurable: true, value: { hasBeenActive: false } });
    await applyConditions(page, { autoplay: 'refused' });
    scripts.forEach(script => {
      script();
    });
    const video = document.createElement('video');

    await expect(video.play()).rejects.toThrow("didn't interact");
    video.muted = true;
    await expect(video.play()).resolves.toBeUndefined();
    play.mockRestore();
  });

  it('refuses a clock step on a page no --clock holds, saying the flag', async () => {
    const { page } = pageAsked();

    expect((await actStep(page, { kind: 'tick', ms: 60_000 }, 0))?.problem).toContain(
      'give the command --clock <instant>'
    );
  });
});
