import { targetOn } from './capture';

/**
 * What to write instead of a name not on the page: the same name the other way — an element's id written as a class
 * (`.home-faq-answer-text`, a run's design-1), a class as an id — when that way finds it; how to name one else.
 */
export const notOnPageText = async (
  page: Parameters<typeof targetOn>[0],
  target: string,
  /** How this command reaches a part a visitor's press makes: `--click, --steps`, or a step before it. */
  reach: string
): Promise<string> => {
  const name = /^[.#]?([A-Za-z_][\w-]*)$/.exec(target)?.[1];
  const ways = name === undefined ? [] : [name, `.${name}`].filter(way => way !== target);
  for (const way of ways) {
    const other = await targetOn(page, way);
    if (!('problem' in other) && other.found) {
      return way === name
        ? `${name} is an element's id here: write it without the dot`
        : `${name} is a class here, no element's id: write it .${name}`;
    }
  }

  // A component's instance is marked by its own name, never as an element: a run's scout wrote
  // [data-plitzi-el="room-card-quiet-demo"] for one, and found data-plitzi-instance only by reading the page's HTML.
  // Each name in turn: the rest of the selector may name the instance's parts, which are elements.
  for (const written of target.matchAll(/\[data-plitzi-el="([^"]+)"\]/g)) {
    const asInstance = `${target.slice(0, written.index)}[data-plitzi-instance="${written[1]}"]${target.slice(written.index + written[0].length)}`;
    const other = await targetOn(page, asInstance);
    if (!('problem' in other) && other.found) {
      return `${written[1]} is a component’s instance, marked data-plitzi-instance, not data-plitzi-el: write ${asInstance}`;
    }
  }

  // Not drawn here at all: a run's dev-1 measured a host's desk as a guest, on /r/ with no room — told only "No element".
  // A row of a list emptied by a press is the same: a run's tester was told to fix the name of a report it had dismissed.
  return `not drawn here: a page for signed-in visitors (--as <username>), a part a click opens or a visitor’s steps make (${reach}), a row of a list that is empty now (what a press, here or in an earlier call, removed on the server), a route with a parameter written as one of its addresses (/r/night-drive, not /r/:slug) — or name it by its element's id (pricing-card), #its-id, or any selector (.plan-card, [data-plitzi-el="…"] > span; a part of one component's instance: [data-plitzi-instance="<instance>"] [data-plitzi-el="<part>"])`;
};
