import { PUBLIC_DIR, SOURCE_DIR } from '@plitzi/sdk-shared/project';

import { authoredHandles } from './expectations';
import { acceptanceText } from './model';
import { readOwnership } from './ownership';
import { shellCommands } from './shell';

import type { Acceptance } from './model';
import type { TaskView } from './taskStore';

/**
 * The pages a task's files are drawn at, for a look at it (`task look`, a designer's review): each file's page is the
 * one that owns it, read off the imports (`walkFilter.ts` is `walks.ts`'s) — a shared one's, the pages that reach it
 * (`dogFilter.ts` is drawn at /walks, /visits, /reminders) — and its address is the authored space's —
 * a page of that id, or the pages a family of that name makes (`pet.ts` → `/pets/luna`, `/pets/bruno`). A page with a
 * parameter in its address is said as its pattern (`/boxeadores/:slug`), for `examplePaths` to open by the site's own
 * links: left out, a run's fighter page had "no page" to look at, and a theme's change missed every detail page.
 * What matches nothing is left out rather than guessed.
 */

const PAGES = 'src/space/pages/';
/** How many pages a task's look pictures by itself: the rest are said, with the look that pictures them. */
export const MAX_PAGES = 8;

/** `walkFilter` → `walk-filter`: a file's name as a page's id is usually written. */
const kebab = (name: string): string => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** The pages' files a task's files are drawn by: each file's owner, or the pages a shared one is reached from. */
const pageUnits = async (root: string, files: readonly string[]): Promise<Set<string>> => {
  const ownership = await readOwnership(root);
  // A shared file — a component, the theme — is drawn at the pages that reach it, not at none of them.
  const unitsOf = (file: string): string[] => {
    const owner = ownership.ownerOf.get(file);
    if (owner) {
      return [owner];
    }

    return ownership.shared.get(file) ?? [file];
  };

  return new Set(
    files.flatMap(unitsOf).flatMap(unit =>
      unit.startsWith(PAGES)
        ? [
            unit
              .slice(PAGES.length)
              .split('/')[0]
              ?.replace(/\.[cm]?tsx?$/, '') ?? ''
          ]
        : []
    )
  );
};

/**
 * Whether any page draws one of these files — read off the imports alone, no space authored: a type, a setting with
 * no element (`settings.transientState` in the space's entry) or seed data is drawn by none.
 */
export const drawnByAPage = async (root: string, files: readonly string[]): Promise<boolean> =>
  (await pageUnits(root, files)).size > 0;

export const pagesOf = async (
  root: string,
  files: readonly string[],
  /** How many: a task's look the first few; a run's look every one (a run's missed four, cut at eight). */
  most: number = MAX_PAGES
): Promise<string[]> => {
  const units = await pageUnits(root, files);
  if (units.size === 0) {
    return [];
  }

  const handles = await authoredHandles(root);
  if (!handles) {
    return [];
  }

  const names = [...units].filter(Boolean).flatMap(name => [name, kebab(name)]);
  const paths = Object.entries(handles.pages)
    .filter(([, page]) => !page.path.includes('*'))
    .filter(([id]) => names.some(name => id === name || id.startsWith(`${name}-`) || id === `${name}-page`))
    .map(([, page]) => page.path);

  return [...new Set(paths)].slice(0, most);
};

/** A pattern's parameters, `:slug`, as what one segment of an address may be. */
const patternOf = (route: string): RegExp =>
  new RegExp(`^${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:[A-Za-z_]\w*/g, '[^/?#]+')}/?$`);

/**
 * Whether a page — a route, `/u/:username` — was looked at among `looked`: itself, or an address that fits it. A run's
 * look of `/u/mika` warned that `/u/:username` was not looked at.
 */
export const lookedAmong = (page: string, looked: readonly string[]): boolean =>
  looked.some(each => each === page || patternOf(page).test(each.split(/[?#]/)[0] ?? each));

/**
 * Routes to open, each pattern among them (`/boxeadores/:slug`) made an address the site itself links to: the first
 * link of its list page (`/boxeadores`), or else of the home page, that fits it — a visitor's way there, with no data
 * of the project's read. A pattern no link fits is said, never opened as it is.
 */
/** Whether an address is one of a route's pages: `/r/night-drive/stats` of `/r/:slug/stats`. */
export const pageFits = (route: string, address: string): boolean => patternOf(route).test(address.split(/[?#]/)[0]);

/** A route's parameters as an address fills them: `/r/:slug` at `/r/night-drive` is `{ slug: 'night-drive' }`. */
const paramsOf = (route: string, address: string): Record<string, string> => {
  const parts = address.split(/[?#]/)[0].split('/');

  return Object.fromEntries(
    route
      .split('/')
      .flatMap((segment, index) =>
        segment.startsWith(':') && parts[index] ? [[segment.slice(1), parts[index]] as const] : []
      )
  );
};

/** How many links that fit a route are asked before its example is said unreached. */
const EXAMPLES_TRIED = 5;

const answers = (address: URL, headers: Record<string, string>): Promise<boolean> =>
  fetch(address, { headers })
    .then(answer => answer.ok)
    .catch(() => false);

export const examplePaths = async (
  origin: string,
  routes: readonly string[],
  /**
   * Addresses the task names itself — its acceptance's pages: one that fits a route is that route's example before any
   * link is followed (t-product's look pictured the home and the blog, its product page unreached — no link
   * to it on a copy without the cards).
   */
  named: readonly string[] = [],
  /**
   * The session a signed-in look reads the site with (`cookie`): a link only a signed-in visitor has — `/u/:username`,
   * the account's own — is followed as one. A run's look said "No link of the site reaches /u/:username".
   */
  cookie?: string
): Promise<{ paths: string[]; unreached: string[] }> => {
  const headers: Record<string, string> = cookie === undefined ? {} : { cookie };
  const linksOf = new Map<string, Promise<string[]>>();
  const links = (page: string): Promise<string[]> => {
    const known = linksOf.get(page);
    if (known) {
      return known;
    }

    const read = fetch(new URL(page, origin), { headers })
      .then(answer => (answer.ok ? answer.text() : ''))
      .then(html =>
        [...html.matchAll(/href="([^"]+)"/g)].flatMap(match => {
          const address = new URL(match[1], origin);

          return address.origin === new URL(origin).origin ? [address.pathname] : [];
        })
      )
      .catch(() => []);
    linksOf.set(page, read);

    return read;
  };
  const paths: string[] = [];
  const unreached: string[] = [];
  const params: Record<string, string> = {};
  for (const route of routes) {
    if (!route.includes(':')) {
      paths.push(route);
      continue;
    }

    const fits = patternOf(route);
    const list = route.slice(0, route.indexOf('/:')) || '/';
    // Of the links that fit, the first that answers: a run's look pictured the nav's first collection, a 404 there,
    // and read the page's not-found as the task's failures.
    const candidates = [...new Set([...(await links(list)), ...(await links('/'))].filter(link => fits.test(link)))];
    let answering: string | undefined;
    for (const link of candidates.slice(0, EXAMPLES_TRIED)) {
      if (await answers(new URL(link, origin), headers)) {
        answering = link;
        break;
      }
    }

    // Every address the tasks name for it, each its own page: a run's look pictured /r/:slug as the first room named,
    // and never the other one whose change it showed.
    const fitting = named.filter(address => fits.test(address));
    const found = fitting.length > 0 ? fitting : answering === undefined ? [] : [answering];
    if (found.length > 0) {
      paths.push(...found);
      Object.assign(params, paramsOf(route, found[0]));
    } else {
      unreached.push(route);
    }
  }

  // A page no link reaches, filled with what another one's address said its parameters are — `/r/:slug/stats` at the
  // `night-drive` of `/r/:slug` (a run's look left the room's stats unseen) — when that address answers.
  const filled = await Promise.all(
    unreached.map(async route => {
      const names = route.split('/').flatMap(segment => (segment.startsWith(':') ? [segment.slice(1)] : []));
      if (!names.every(name => Object.hasOwn(params, name))) {
        return undefined;
      }

      const address = route.replace(/:([A-Za-z_]\w*)/g, (_match, name: string) => params[name]);

      return (await answers(new URL(address, origin), headers)) ? address : undefined;
    })
  );

  return {
    paths: [...new Set([...paths, ...filled.flatMap(address => (address ? [address] : []))])],
    unreached: unreached.filter((_route, index) => filled[index] === undefined)
  };
};

/** The `plitzi page` commands an acceptance line runs on a page: where its checks look. */
const PAGE_COMMANDS = new Set(['check', 'measure', 'shot', 'same']);

/**
 * The pages a task's acceptance runs its checks on — `page check /combates /boxeadores`, `page measure /`: where its
 * look starts when no page owns its files (a shared component's), rather than the reviewer told to name them
 * ("no page of the space owns its files", its acceptance naming two).
 */
export const acceptancePages = (acceptance: readonly Acceptance[]): string[] =>
  [
    ...new Set(
      acceptance.flatMap(line =>
        typeof line === 'string'
          ? []
          : shellCommands(line.check).flatMap(words => {
              const at = words.findIndex((word, index) => word === 'page' && PAGE_COMMANDS.has(words[index + 1] ?? ''));
              if (at === -1) {
                return [];
              }

              const rest = words.slice(at + 2);
              const firstOption = rest.findIndex(word => word.startsWith('--'));

              return (firstOption === -1 ? rest : rest.slice(0, firstOption)).filter(word => word.startsWith('/'));
            })
      )
    )
  ].slice(0, MAX_PAGES);

/**
 * The addresses its acceptance names, said or checked — `/messages/nobodyhere as dax shows …`: what a route with a
 * parameter (`/messages/:username`) is opened at. A run's look was handed the pattern, found no link to it, and
 * looked at nothing the task changed.
 */
export const acceptanceAddresses = (acceptance: readonly Acceptance[]): string[] => [
  ...new Set([
    ...acceptancePages(acceptance),
    ...acceptance.flatMap(line =>
      [...acceptanceText(line).matchAll(/(?<![\w./:])\/[a-z0-9][\w-]*(?:\/[\w-]+)*/gi)].map(match => match[0])
    )
  ])
];

/**
 * A route's pattern made an address the acceptance names, when one fits it: `/messages/:username` → `/messages/nova` —
 * or filled from one that names its first parts: `/r/:slug/stats` from `/r/sunday-lofi`, a run's offer having handed
 * the pattern itself, which the look could not reach.
 */
export const filledPattern = (route: string, named: readonly string[]): string => {
  if (!route.includes('/:')) {
    return route;
  }

  const fits = named.find(address => pageFits(route, address));
  if (fits !== undefined) {
    return fits;
  }

  const parts = route.split('/');
  for (const address of named) {
    const got = address.split(/[?#]/)[0].split('/');
    // Shorter than the route, every part of it the route says by name the same: its values fill the route's own.
    const agrees =
      got.length < parts.length &&
      parts.every((part, index) => index >= got.length || part.startsWith(':') || part === got[index]);
    const filled = parts.map((part, index) => (part.startsWith(':') ? (got.at(index) ?? '') : part));
    if (agrees && filled.every((part, index) => index === 0 || part !== '')) {
      return filled.join('/');
    }
  }

  return route;
};

/**
 * The account its acceptance checks the pages signed in as (`page check … --as mika`), when one: a look at them signs
 * in as it. A run's looks at /settings and /rooms/new pictured the sign-in panel, and said "nothing changed" of a
 * change they never drew. Two accounts named: the first.
 */
export const acceptanceAccount = (acceptance: readonly Acceptance[]): string | undefined =>
  acceptance
    .flatMap(line => (typeof line === 'string' ? [] : shellCommands(line.check)))
    .flatMap(words => {
      const page = words.findIndex((word, index) => word === 'page' && PAGE_COMMANDS.has(words[index + 1] ?? ''));
      const account = words.at(words.indexOf('--as') + 1);

      return page !== -1 && words.includes('--as') && account !== undefined ? [account] : [];
    })
    .at(0);

/**
 * The pages a look opens: those asked — else those its files are drawn at and those its acceptance checks, together —
 * else the home page. A run's look at a plugin's file, drawn at no page, pictured the home page, where none of its
 * reactions is; a run's left out the 404 its acceptance checked, its files drawn at other pages.
 */
export const pagesToLook = (
  asked: readonly string[],
  drawn: readonly string[],
  acceptance: readonly string[]
): string[] => {
  const found = asked.length > 0 ? [...asked] : [...new Set([...drawn, ...acceptance])];

  return found.length > 0 ? found : ['/'];
};

/**
 * The pages its acceptance checks with a status of their own (`page check /no-such-page --status 404`): looked at
 * with it, apart — a look sends one status for all its pages.
 */
export const acceptanceStatuses = (acceptance: readonly Acceptance[]): { page: string; status: number }[] => {
  const found = new Map<string, number>();
  for (const words of acceptance.flatMap(line => (typeof line === 'string' ? [] : shellCommands(line.check)))) {
    const at = words.findIndex((word, index) => word === 'page' && PAGE_COMMANDS.has(words[index + 1] ?? ''));
    const status = Number(words.at(words.indexOf('--status') + 1));
    if (at !== -1 && words.includes('--status') && Number.isInteger(status) && status !== 200) {
      const rest = words.slice(at + 2);
      const firstOption = rest.findIndex(word => word.startsWith('--'));
      (firstOption === -1 ? rest : rest.slice(0, firstOption))
        .filter(word => word.startsWith('/'))
        .forEach(page => found.set(page, status));
    }
  }

  return [...found].map(([page, status]) => ({ page, status }));
};

/**
 * Whether a task changes no page: each of its files outside what the project draws from — its source and its public
 * files, `src/` and `public/` — and reached by none of the space's pages, and its acceptance checks no page. A test's
 * fix, a script, a config: a run's look of a spec-only task pictured the home page, 19 pictures the change could
 * not touch. A file under `src/` no page imports (data, server code) is not said so: what draws it is not read here.
 */
export const changesNoPage = async (
  root: string,
  files: readonly string[],
  acceptance: readonly Acceptance[]
): Promise<boolean> => {
  if (files.length === 0 || acceptancePages(acceptance).length > 0) {
    return false;
  }

  const drawnFrom = [`${SOURCE_DIR}/`, `${PUBLIC_DIR}/`];
  const ownership = await readOwnership(root);

  return files.every(
    file => !drawnFrom.some(dir => file.startsWith(dir)) && !ownership.ownerOf.has(file) && !ownership.shared.has(file)
  );
};

/**
 * The pages a review looks at: those its files are drawn at and those its acceptance checks — a page with a status of
 * its own left to its own look (`acceptanceStatuses`). A run's look of t-retro-pass left out its 404 page: its
 * files were drawn at other pages, and only those were offered.
 */
export const reviewPages = async (review: Pick<TaskView, 'paths' | 'state' | 'task'>): Promise<string[]> => {
  const owned = await pagesOf(review.paths.work, review.state.changed ?? []);
  const apart = new Set(acceptanceStatuses(review.task.acceptance).map(each => each.page));

  return [...new Set([...owned, ...acceptancePages(review.task.acceptance)])].filter(page => !apart.has(page));
};
