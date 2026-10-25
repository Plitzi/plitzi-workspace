import type { BrowserPage } from './index';

/**
 * The browser a page is read in, where it is not a visitor's ordinary one: what a check of a refusal, a failure or a
 * time needs, set before the page is asked for. encore-3: a remembered Listen, a player that does not load and a
 * countdown were each a throwaway Playwright file, because no command could read the page that way.
 */
export interface BrowserConditions {
  /** `--clock <time>`: the page's clock, held at this instant (epoch ms) — `Date` and its timers — moved by `tick`. */
  clock?: number;
  /** `--block <text>`: each request whose address holds it fails, as one the network could not make. */
  block?: readonly string[];
  /** `--autoplay refused`: media playing with sound refused until a press, as a browser's autoplay rule does. */
  autoplay?: 'refused';
  /** `--storage refused`: `localStorage` and `sessionStorage` throw when read, as with the site's data blocked. */
  storage?: 'refused';
}

export const AUTOPLAY_CONDITIONS = ['refused'] as const;
export const STORAGE_CONDITIONS = ['refused'] as const;

/** Run in each document before its own scripts: a `play()` with sound before any press, refused as a browser does. */
const refuseAutoplay = (): void => {
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
    if (!this.muted && !navigator.userActivation.hasBeenActive) {
      return Promise.reject(
        new DOMException("play() failed because the user didn't interact with the document first.", 'NotAllowedError')
      );
    }

    return play.call(this);
  };
};

/** Run in each document before its own scripts: the storages throw when read, as a browser blocking the site's data. */
const refuseStorage = (): void => {
  for (const name of ['localStorage', 'sessionStorage']) {
    Object.defineProperty(window, name, {
      configurable: true,
      get: () => {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      }
    });
  }
};

/** The pages whose clock `--clock` holds: a `clock` or `tick` step on another has no clock of its own to move. */
const heldClocks = new WeakSet<BrowserPage>();

export const clockHeld = (page: BrowserPage): boolean => heldClocks.has(page);

/** The conditions set on a page before it is asked for — in each of its documents, and on every request it makes. */
export const applyConditions = async (page: BrowserPage, conditions: BrowserConditions): Promise<void> => {
  if (conditions.clock !== undefined) {
    await page.clock.install({ time: conditions.clock });
    heldClocks.add(page);
  }

  if (conditions.autoplay === 'refused') {
    await page.addInitScript(refuseAutoplay, undefined);
  }

  if (conditions.storage === 'refused') {
    await page.addInitScript(refuseStorage, undefined);
  }

  const blocked = conditions.block ?? [];
  if (blocked.length > 0) {
    await page.route(
      url => blocked.some(part => url.href.includes(part)),
      route => route.abort()
    );
  }
};

/** The conditions said back, as a report's heading says what the page was read under. */
export const conditionsText = (conditions: BrowserConditions): string | undefined => {
  const said = [
    ...(conditions.clock === undefined ? [] : [`clock held at ${new Date(conditions.clock).toISOString()}`]),
    ...(conditions.block?.length ? [`blocked: ${conditions.block.join(', ')}`] : []),
    ...(conditions.autoplay ? ['autoplay with sound refused until a press'] : []),
    ...(conditions.storage ? ['storage refused'] : [])
  ];

  return said.length === 0 ? undefined : said.join(' · ');
};
