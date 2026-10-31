import { namedBy, ROW, targetOn } from './capture';

/** How many copies are counted before "past that" would say the same. */
const COPIES_LOOK = 20;

/** How many elements a selector finds, counted copy by copy as a page's locator reads one. */
const copiesOf = async (page: Parameters<typeof targetOn>[0], selector: string): Promise<number> => {
  for (let index = 0; index < COPIES_LOOK; index += 1) {
    if (
      (await page
        .locator(`${selector} >> nth=${String(index)}`)
        .first()
        .count()) === 0
    ) {
      return index;
    }
  }

  return COPIES_LOOK;
};

/** A page a name is looked for on: found by a selector, and read in it for the names it has. */
type NamedPage = Parameters<typeof targetOn>[0] & {
  evaluate: <R, A>(fn: (arg: A) => R, arg: A) => Promise<R>;
};

/** The element names on the page that start as `stem` does — runs in the page, self-contained. */
const namesFromInPage = (stem: string): string[] => [
  ...new Set(
    Array.from(document.querySelectorAll('[data-plitzi-el]'), node => node.getAttribute('data-plitzi-el') ?? '').filter(
      name => name.startsWith(stem)
    )
  )
];

/** How many of the names like it are said. */
const LIKE_SAID = 8;

/**
 * What to write instead of a name not on the page: the same name the other way — an element's id written as a class
 * (`.home-faq-answer-text`, a run's design-1), a class as an id — when that way finds it; how to name one else.
 */
export const notOnPageText = async (
  page: NamedPage,
  target: string,
  /** How this command reaches a part a visitor's press makes: `--click, --steps`, or a step before it. */
  reach: string
): Promise<string> => {
  // A row asked past the copies drawn: how many there are — a run's dev-1 read "not on the page" of `room-crate-add:2`
  // as no `:N` at all, where the page drew one copy at that width.
  const row = ROW.exec(target);
  const copies = row ? await copiesOf(page, namedBy(row[1])) : 0;
  if (row && copies > 0) {
    return `${row[1]} is drawn ${String(copies)} time${copies === 1 ? '' : 's'} here — :${row[2]} counts every copy on the page, hidden ones too, and a part drawn once a width is two copies: a row by its list is \`[data-plitzi-el=<list>] > li:nth-of-type(${row[2] === 'last' ? 'last' : row[2]}) …\``;
  }

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

  // A name of a family the page has, mistaken: a run's dev-1 clicked sheet-tab-board, where the tabs were log, summary
  // and legend.
  const stem = name === undefined ? '' : name.slice(0, name.lastIndexOf('-') + 1);
  const like = stem.length > 3 ? await page.evaluate(namesFromInPage, stem).catch(() => []) : [];
  if (like.length > 0) {
    return `the page has ${like.slice(0, LIKE_SAID).join(', ')}${like.length > LIKE_SAID ? `, … (${String(like.length)})` : ''} — no ${name ?? target}`;
  }

  // Not drawn here at all: a run's dev-1 measured a host's desk as a guest, on /r/ with no room — told only "No element".
  // A row of a list emptied by a press is the same: a run's tester was told to fix the name of a report it had dismissed.
  return `not drawn here: a page for signed-in visitors (--as <username>), a part a click opens or a visitor’s steps make (${reach}), a row of a list that is empty now (what a press, here or in an earlier call, removed on the server), a route with a parameter written as one of its addresses (/r/night-drive, not /r/:slug) — or name it by its element's id (pricing-card), #its-id, or any selector (.plan-card, [data-plitzi-el="…"] > span; a part of one component's instance: [data-plitzi-instance="<instance>"] [data-plitzi-el="<part>"])`;
};
