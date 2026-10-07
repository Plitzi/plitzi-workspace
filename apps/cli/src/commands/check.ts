import chalk from 'chalk';

import {
  authorSpace,
  dataIssues,
  failedFlowText,
  inspectDocument,
  inspectPage,
  openPage,
  readDevTools
} from '@plitzi/sdk-authoring';
import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { projectHere } from './existingProject';
import { projectSettings } from './projectSettings';
import { loadProjectSpace } from './projectSpace';
import { fail } from './terminal';
import { launchBrowser, openProjectPage, projectOrigin, withoutDevTools } from '../browser';

import type { ExistingProject } from './existingProject';
import type { Browser, BrowserPage, Scheme } from '../browser';
import type { FieldFill } from '../options';
import type { DataIssueCode, DevToolsInput, PageIssue, SpaceHandles } from '@plitzi/sdk-authoring';
import type { Element as SchemaElement, Schema } from '@plitzi/sdk-shared';

/**
 * `plitzi page check`: whether a page of the running project is whole, said in text — every element it owes on screen, no
 * image broken, nothing scrolling sideways, no text in the colour behind it, no error in the console, no request
 * refused — at each width asked. What an agent needs to know about a page in a few hundred tokens, where a screenshot
 * costs thousands and still has to be looked at; a picture is for when this says something is wrong.
 *
 * With the page's dev tools on (any development server) it also says every flow that failed while the page loaded,
 * every binding that reads a path its provider's answer does not have — none inside an element the page is not
 * showing, which is not mounted — and each list's rows, drawn and in its source, and, asked, what the page holds:
 * `--state` (the state, and every source by name) and `--element <id>`. `--ssr` holds the HTML the server sent against
 * the page once hydrated: what a server provider holds and the server's HTML lacked arrived late.
 *
 *   plitzi page check / --width 1440,390 --json
 *   plitzi page check /products --state --element catalog-count
 *   plitzi page check /pricing --ssr
 */

export interface CheckOptions {
  /** Validated where the flag is declared (`widths` in options.ts). */
  width?: number[];
  scheme?: Scheme;
  json?: boolean;
  /** The page's state and every source by name, as its dev tools hold them. */
  state?: boolean;
  /** One element by its id: what it reads, its own state, whether it is on screen. */
  element?: string;
  /** The HTML the server sent, held against the page once hydrated. */
  ssr?: boolean;
  /** One element clicked, by its id, once the page has settled: what changed because of it, or that nothing did. */
  click?: string;
  /** Fields filled before the click, as a visitor types in them: what a form's flow is sent. */
  fill?: FieldFill[];
  /**
   * An account of the project to sign in as first, through its server's `/auth` routes (`createServer({ auth })`), with
   * the password in `PLITZI_CHECK_PASSWORD` — what a page for signed-in visitors is checked as.
   */
  as?: string;
}

/** The account `verify` signs in as for the pages that send a visitor to sign in: the project's, in `.env`. */
export const CHECK_USER_ENV = 'PLITZI_CHECK_USER';

/** Where the account's password is read: `.env` or the environment, never the command line, which a shell keeps. */
export const CHECK_PASSWORD_ENV = 'PLITZI_CHECK_PASSWORD';

/** The project's sign-in route: where `createServer({ auth })` mounts its flows unless told otherwise. */
const SIGN_IN_PATH = '/auth/login';

export interface Account {
  username: string;
  password: string;
}

/**
 * The account a check signs in as: the one named, or the project's own (`PLITZI_CHECK_USER`) — `undefined` when
 * neither is — with its password from `PLITZI_CHECK_PASSWORD`, each read from the environment over `.env`, as the
 * project's scripts read them.
 */
export const checkAccount = async (
  root: string,
  username?: string
): Promise<Account | { problem: string } | undefined> => {
  const settings = await projectSettings(root);
  const named = username ?? settings.value(CHECK_USER_ENV);
  if (!named) {
    return undefined;
  }

  const password = settings.value(CHECK_PASSWORD_ENV);
  if (!password) {
    return {
      problem: `${named} signs in with the password in ${CHECK_PASSWORD_ENV}: set it in .env — never on the command line, which a shell keeps`
    };
  }

  return { username: named, password };
};

/** One problem of a page, as data: what an agent branches on and points at, beside the sentence a person reads. */
export interface CheckIssue {
  code:
    | PageIssue['code']
    | DataIssueCode
    | 'no-answer'
    | 'no-page'
    | 'flow-failed'
    | 'not-server-rendered'
    | 'not-signed-in'
    | 'redirected'
    | 'page-status';
  message: string;
  /** The space's element it is about, by id — absent for one about the page as a whole. */
  elementId?: string;
  /** The width it was found at, so a list of every width's issues still says where each one is. */
  width: number;
}

export interface CheckReport {
  path: string;
  width: number;
  ok: boolean;
  /** The elements the space owes this page that were looked for — 0 for a space that is not in the project. */
  checked: number;
  /** The problems as sentences — each `issues` entry's `message`. */
  problems: string[];
  issues: CheckIssue[];
  /** Owed, and hidden at this width by a breakpoint on purpose: looked at, and not a problem. */
  hiddenAtWidth: string[];
  consoleErrors: string[];
  failedRequests: string[];
  /** Whether the page had its dev tools on, which is what flows, state and elements are read from. */
  devTools: boolean;
  /** Every list whose rows come from a provider, by id: how many rows it draws and how many its source holds. */
  lists: Record<string, ListRows>;
  /** With `--ssr`: the elements the page has once hydrated that the server's HTML did not — none of them in a server provider. */
  browserOnly?: string[];
  state?: unknown;
  sources?: Record<string, unknown>;
  element?: unknown;
  /** With `--element`: how its classes meet on it, at rest at this width. `null`: it is not on the page. */
  styles?: ElementStyles | null;
  /** With `--click`: what clicking the element changed. */
  clicked?: ClickReport;
  /**
   * The page was sent with status 404, as it should be: the space's page for an address nothing answers, or one whose
   * server provider said its answer is nothing (`notFound`).
   */
  notFound?: true;
}

/** What a page is, as far as a click can change it: where it is, how far each part is scrolled, what shows. */
export interface PageMoment {
  url: string;
  /** How far down the page and each scrolled element is, by element id (`page` for the document itself). */
  scrolls: Record<string, number>;
  /** The elements the browser draws — shown, wherever the page is scrolled — by id. */
  shown: string[];
  /**
   * What the page says to the visitor outside its elements — a notification, an alert (`role="alert"`, `"status"`) —
   * by its words: a toast is drawn by the SDK, not by an element of the space, and is a change all the same.
   */
  said: string[];
}

/** What a click changed — each kind of change, said; none at all is said too. */
export interface ClickReport {
  element: string;
  /** The fields filled before it, each with what was put in it. */
  filled?: string[];
  /** The element could not be clicked: not on the page, hidden, covered. */
  problem?: string;
  changes: string[];
  /** The flows the click ran that failed, as the dev tools tell them. */
  failed: string[];
}

/** How an element's classes meet on it: the properties more than one sets, and the classes that change nothing. */
export interface ElementStyles {
  contested: ContestedStyle[];
  /**
   * The classes it wears that change nothing on it here: every property each sets stays as it is without it. A class
   * that changes even one property is never here — what it shares with another is said of that property alone.
   */
  inert: { className: string; properties: number }[];
  /**
   * The other elements of the space each of its classes is on: what changing the class itself — its rules, not this
   * element's `class` — changes too.
   */
  wornBy: Record<string, string[]>;
}

/** A property more than one of an element's classes sets, at rest: what each says, and which one the page shows. */
export interface ContestedStyle {
  property: string;
  declared: { className: string; value: string }[];
  /** The value the page shows. */
  shown: string;
  /** The class it is shown from — the one whose removal changes it; absent when they all say the same. */
  winner?: string;
}

/**
 * A list's rows: `rendered` is how many the page draws — `null` when the list is not on the page — and `source` how many
 * its source holds, before the binding's transformers, so a list that filters or slices them draws fewer; `null` when
 * it reads nothing.
 */
export interface ListRows {
  rendered: number | null;
  source: number | null;
}

/** The space the project declares, authored: what each page owes (the handles) and what it reads (the schema). */
type Authored = { handles: SpaceHandles; schema: Schema };

/** The space the project declares, authored. Only for one written here. */
const projectSpace = async (root: string): Promise<Authored | { problem: string }> => {
  const project = await loadProjectSpace(root);
  if ('problem' in project) {
    return { problem: `${project.problem} There is nothing to check the page against.` };
  }

  try {
    const { handles, schema } = authorSpace(project.space, project.authoring);

    return { handles, schema };
  } catch (error) {
    return {
      problem: `The space does not author — npm run author says why: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`
    };
  }
};

/** The page a path is, `:slug` and `{{slug}}` matching any segment. */
/**
 * That no page answers a path, with every path the space's pages answer — a parameter written as it is matched
 * (`/p/:slug`), so the one meant is read off the list rather than guessed from letters.
 */
const noPageMessage = (handles: SpaceHandles, pathname: string): string =>
  `no page of the space answers at ${pathname}: its pages are ${Object.values(handles.pages)
    .map(page => page.path)
    .join(', ')}`;

/**
 * The space's "not found" page: a page whose slug is `*`, the page of every address under its folder that no other
 * page answers. Not every path ending in `*` — `update/*` is a page of its own that answers a whole subtree.
 */
const isNotFoundPage = (page: { slug: string }): boolean => page.slug === '*';

/** A path whose last segment is `*`: it answers every address under it. */
const isSplat = (path: string): boolean => path.endsWith('/*');

/** Where `verify` looks at a page for an address nothing answers: an address under its folder no page has. */
const NOT_FOUND_PROBE = 'plitzi-check-not-found';

/** The page an address is answered by — as the router picks: every page with a path of its own first, then the "not found" pages, the deepest folder's before the space's. */
export const pageFor = (handles: SpaceHandles, pathname: string): string | undefined => {
  const wanted = pathname.replace(/\/$/, '').split('/');
  const answers = (path: string): boolean => {
    const splat = isSplat(path);
    const segments = (splat ? path.slice(0, -2) : path.replace(/\/$/, '')).split('/');

    return (
      (splat ? wanted.length > segments.length : segments.length === wanted.length) &&
      segments.every(
        (segment, index) => segment.startsWith(':') || /^\{\{.*\}\}$/.test(segment) || segment === wanted[index]
      )
    );
  };
  const pages = Object.values(handles.pages);
  const ordered = [
    ...pages.filter(page => !isNotFoundPage(page)),
    ...pages.filter(isNotFoundPage).sort((a, b) => b.path.length - a.path.length)
  ];

  return ordered.find(page => answers(page.path))?.id;
};

/** The elements a piece of HTML carries, by the id each is marked with. */
const markedIn = (html: string): Set<string> =>
  new Set([...html.matchAll(/data-plitzi-el="([^"]+)"/g)].map(([, id]) => id));

/** The `runtime: 'server'` provider an element is inside — or is — if any: what the server's HTML owes. */
const serverProviderOf = (schema: Schema, id: string): string | undefined => {
  const seen = new Set<string>();
  let current = schema.flat[id] as SchemaElement | undefined;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    if (current.definition.type === 'apiContainer' && current.definition.runtime === 'server') {
      return current.id;
    }

    const parent = current.definition.parentId;
    current = parent ? schema.flat[parent] : undefined;
  }

  return undefined;
};

/** Whether an element shows, or would start hidden, under a condition of its own: `visible` written on it. */
const hasOwnCondition = (element: SchemaElement): boolean =>
  element.definition.initialState?.visibility === false ||
  Object.values(element.definition.bindings ?? {}).some(list => list.some(binding => binding.to === 'visibility'));

/**
 * The elements with a condition of their own that the page is not showing — no node, or none the browser draws — by
 * the selectors their handles carry. Nothing inside one is mounted (an element's `loadStrategy`), so its bindings are
 * not the page's to judge. Runs in the page, self-contained.
 */
export const notShownInPage = (elements: { id: string; selector: string }[]): string[] => {
  const shows = (node: Element): boolean =>
    getComputedStyle(node).display === 'contents' ? [...node.children].some(shows) : node.checkVisibility();

  return elements
    .filter(({ selector }) => !Array.from(document.querySelectorAll(selector)).some(shows))
    .map(({ id }) => id);
};

const notShown = async (page: BrowserPage, authored: Authored): Promise<Set<string>> => {
  const conditioned = Object.values(authored.schema.flat).flatMap(element => {
    const handle = Object.hasOwn(authored.handles.elements, element.id)
      ? authored.handles.elements[element.id]
      : undefined;

    // A provider with no tag has no node to look for, shown or not.
    return handle && !handle.boxless && hasOwnCondition(element) ? [{ id: element.id, selector: handle.selector }] : [];
  });

  return new Set(conditioned.length > 0 ? await page.evaluate(notShownInPage, conditioned) : []);
};

/**
 * Each property more than one of an element's classes sets, as the page has them at rest, and which one wins. Which
 * wins is asked of the page rather than worked out from the cascade: each class is taken off for a moment, and the one
 * whose absence changes the value is the one it comes from — specificity, order, layers and media all answered at once.
 * Runs in the page, self-contained.
 */
export const contestedStylesInPage = ({
  selector,
  classes
}: {
  selector: string;
  classes: string[];
}): Omit<ElementStyles, 'wornBy'> | null => {
  const node = document.querySelector(selector);
  if (!(node instanceof HTMLElement)) {
    return null;
  }

  const worn = classes.filter(name => node.classList.contains(name));
  const declared = new Map<string, { className: string; value: string }[]>();
  const visit = (rules: CSSRuleList): void => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSMediaRule) {
        if (matchMedia(rule.media.mediaText).matches) {
          visit(rule.cssRules);
        }

        continue;
      }

      if (rule instanceof CSSSupportsRule) {
        if (CSS.supports(rule.conditionText)) {
          visit(rule.cssRules);
        }

        continue;
      }

      if (!(rule instanceof CSSStyleRule)) {
        if (rule instanceof CSSGroupingRule) {
          visit(rule.cssRules);
        }

        continue;
      }

      let applies = false;
      try {
        applies = node.matches(rule.selectorText);
      } catch {
        // A selector `matches` cannot take — a pseudo-element — is never this node at rest.
      }

      const className = applies
        ? worn.find(name => new RegExp(`\\.${CSS.escape(name)}(?![\\w-])`).test(rule.selectorText))
        : undefined;
      if (!className) {
        continue;
      }

      for (const property of Array.from(rule.style)) {
        const others = (declared.get(property) ?? []).filter(entry => entry.className !== className);
        declared.set(property, [...others, { className, value: rule.style.getPropertyValue(property) }]);
      }
    }
  };
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      visit(sheet.cssRules);
    } catch {
      // A stylesheet from another origin cannot be read, and holds none of the space's classes.
    }
  }

  const { transition, animation } = node.style;
  // Off while the classes come and go: a transition would answer the value it starts from, not the one it ends at.
  node.style.transition = 'none';
  node.style.animation = 'none';
  const shownOf = (property: string): string => getComputedStyle(node).getPropertyValue(property);
  // Which of the properties each class sets stays as it is without that class: all of them, and it changes nothing.
  const unchangedWithout = (className: string, properties: readonly string[]): boolean[] => {
    const shown = properties.map(shownOf);
    node.classList.remove(className);
    const without = properties.map(shownOf);
    node.classList.add(className);

    return properties.map((_, index) => without[index] === shown[index]);
  };
  const contested = [...declared]
    .filter(([, list]) => list.length > 1)
    .map(([property, list]): ContestedStyle => {
      const winner = list.find(({ className }) => !unchangedWithout(className, [property])[0])?.className;

      return { property, declared: list, shown: shownOf(property), ...(winner ? { winner } : {}) };
    });
  const inert = worn.flatMap(className => {
    const properties = [...declared].filter(([, list]) => list.some(entry => entry.className === className));
    const names = properties.map(([property]) => property);

    return names.length > 0 && unchangedWithout(className, names).every(Boolean)
      ? [{ className, properties: names.length }]
      : [];
  });
  node.style.transition = transition;
  node.style.animation = animation;

  return { contested, inert };
};

/** Contested properties as lines, those that say the same of the same classes said once: a shorthand's longhands. */
export const contestedText = (contested: readonly ContestedStyle[], wornBy: ElementStyles['wornBy']): string[] => {
  const groups = new Map<string, { properties: string[]; style: ContestedStyle }>();
  for (const style of contested) {
    const key = JSON.stringify([style.shown, style.winner, style.declared]);
    const group = groups.get(key);
    if (group) {
      group.properties.push(style.property);
    } else {
      groups.set(key, { properties: [style.property], style });
    }
  }

  return [...groups.values()].map(({ properties, style }) => {
    const named =
      properties.length > 2
        ? `${properties[0]} and ${String(properties.length - 1)} more like it`
        : properties.join(', ');
    const losers = style.declared.filter(({ className }) => className !== style.winner);
    const over = losers.map(({ className, value }) => `${className} says ${value}`).join(', ');

    // Said of the property alone: a class that shares it may set others nobody else does, and be on other elements.
    const shared = style.declared
      .filter(({ className }) => (wornBy[className] ?? []).length > 0)
      .map(({ className }) => othersWearing(className, wornBy));
    const reach = shared.length > 0 ? ` — ${shared.join('; ')}` : '';

    return style.winner
      ? `${named}: ${style.shown}, from ${style.winner} (${over})${reach}`
      : `${named}: ${style.shown} — ${style.declared.map(({ className }) => className).join(' and ')} all set it so; it stays ${style.shown} without any one of them${reach}`;
  });
};

/** Who else a class is on, said where changing the class itself would reach them. */
const othersWearing = (className: string, wornBy: ElementStyles['wornBy']): string => {
  const others = wornBy[className] ?? [];
  if (others.length === 0) {
    return `${className} is on this element alone`;
  }

  const named =
    others.length > 3 ? `${others.slice(0, 3).join(', ')} and ${String(others.length - 3)} more` : others.join(', ');

  return `${className} is also on ${named}: changing the class itself changes ${others.length === 1 ? 'it' : 'them'} too`;
};

/**
 * The classes that change nothing on the element, said with how far that was measured — and what taking one away
 * means: off this element's `class`, which touches no other; never its rules, which every element wearing it reads.
 */
export const inertText = (inert: ElementStyles['inert'], width: number, wornBy: ElementStyles['wornBy']): string[] =>
  inert.map(
    ({ className, properties }) =>
      `${className} changes nothing on it at rest at ${String(width)} px: each of the ${String(properties)} ${properties === 1 ? 'property' : 'properties'} it sets stays as it is without it (a hover or another width may still need it). To drop it here, take it off this element’s \`class\`; ${othersWearing(className, wornBy)}.`
  );

/** Where the page is, how far each part is scrolled and what shows. Runs in the page, self-contained. */
export const pageMomentInPage = (): PageMoment => {
  const marked = Array.from(document.querySelectorAll('[data-plitzi-el]'));
  const scrolls: Record<string, number> = { page: Math.round(document.scrollingElement?.scrollTop ?? 0) };
  for (const node of marked) {
    if (node.scrollTop > 0) {
      scrolls[node.getAttribute('data-plitzi-el') ?? ''] = Math.round(node.scrollTop);
    }
  }

  const said = Array.from(document.querySelectorAll('[role="alert"], [role="status"]'))
    .filter(node => node.checkVisibility())
    .map(node => node.textContent.trim())
    .filter(Boolean);

  return {
    url: `${location.pathname}${location.search}${location.hash}`,
    said: [...new Set(said)],
    scrolls,
    shown: [
      ...new Set(marked.filter(node => node.checkVisibility()).map(node => node.getAttribute('data-plitzi-el') ?? ''))
    ]
  };
};

/** Starts noting each field the browser refuses — `invalid`, fired as a form is submitted. Runs in the page. */
export const listenForRefusedFieldsInPage = (): void => {
  const noted: string[] = [];
  Reflect.set(window, '__plitziRefusedFields', noted);
  document.addEventListener(
    'invalid',
    event => {
      const field = event.target;
      if (
        field instanceof HTMLInputElement ||
        field instanceof HTMLTextAreaElement ||
        field instanceof HTMLSelectElement
      ) {
        const named = field.closest('[data-plitzi-el]')?.getAttribute('data-plitzi-el') ?? field.name;
        noted.push(`${named} — ${field.validationMessage}`);
      }
    },
    true
  );
};

/** The fields the browser refused since the listener started, each with what it said. Runs in the page. */
export const refusedFieldsInPage = (): string[] => {
  const noted: unknown = Reflect.get(window, '__plitziRefusedFields');

  return Array.isArray(noted) ? [...new Set(noted.filter((entry): entry is string => typeof entry === 'string'))] : [];
};

/** Every way two moments of the page differ, in words: where it went, what scrolled, what came and went, the state. */
export const momentChanges = (
  before: PageMoment,
  after: PageMoment,
  state: { before: unknown; after: unknown }
): string[] => {
  const scrolled = [...new Set([...Object.keys(before.scrolls), ...Object.keys(after.scrolls)])].flatMap(id => {
    const from = before.scrolls[id] ?? 0;
    const to = after.scrolls[id] ?? 0;

    return from === to ? [] : [`${id === 'page' ? 'the page' : id} scrolled ${String(from)} → ${String(to)} px`];
  });
  const appeared = after.shown.filter(id => !before.shown.includes(id));
  const gone = before.shown.filter(id => !after.shown.includes(id));
  const listed = (ids: string[]): string =>
    ids.length > 6 ? `${ids.slice(0, 6).join(', ')} and ${String(ids.length - 6)} more` : ids.join(', ');
  const stateBefore = isRecord(state.before) ? state.before : {};
  const stateAfter = isRecord(state.after) ? state.after : {};
  const said = (value: unknown): string => (value === undefined ? 'unset' : JSON.stringify(value));
  const stateChanges = [...new Set([...Object.keys(stateBefore), ...Object.keys(stateAfter)])].flatMap(key =>
    said(stateBefore[key]) === said(stateAfter[key])
      ? []
      : [`state.${key}: ${said(stateBefore[key])} → ${said(stateAfter[key])}`]
  );

  return [
    ...(before.url === after.url ? [] : [`went to ${after.url} (from ${before.url})`]),
    ...scrolled,
    ...(appeared.length > 0 ? [`now shown: ${listed(appeared)}`] : []),
    ...(gone.length > 0 ? [`no longer shown: ${listed(gone)}`] : []),
    ...after.said.filter(words => !before.said.includes(words)).map(words => `said: "${words}"`),
    ...stateChanges
  ];
};

/** What `--click` is asked: the element, and the fields filled before it. */
export interface ClickAsk {
  element: string;
  fill: readonly FieldFill[];
}

const selectorOf = (authored: Authored | undefined, id: string): string =>
  authored && Object.hasOwn(authored.handles.elements, id)
    ? authored.handles.elements[id].selector
    : `[data-plitzi-el="${id}"]`;

const FIELDS = 'input, textarea, select';

/** The elements of the space the fields inside a node belong to: the nearest element around each. */
const fieldOwnersInPage = (node: Element, selector: string): string[] =>
  Array.from(node.querySelectorAll(selector), field =>
    field.closest('[data-plitzi-el]')?.getAttribute('data-plitzi-el')
  ).map(owner => owner ?? '?');

/**
 * One field filled as a visitor fills it — typed in, an option chosen, a box ticked with `true` or `false` — in the
 * element named, or the one field inside it (a `formControl` wraps its input). Which element's field was filled, when
 * it is another's; or what could not be filled, and why.
 */
const fillField = async (
  page: BrowserPage,
  authored: Authored | undefined,
  { element, value }: FieldFill
): Promise<{ filled: string } | { problem: string }> => {
  const node = page.locator(selectorOf(authored, element)).first();
  if ((await node.count()) === 0) {
    return { problem: `no element ${element} is on this page to fill` };
  }

  const own = await node.evaluate((each, selector) => each.matches(selector), FIELDS);
  const owners = own ? [element] : await node.evaluate(fieldOwnersInPage, FIELDS);
  if (owners.length === 0) {
    return { problem: `${element} holds no field to fill — an input, a textarea or a select` };
  }

  // A container of several is not one field: filling the first would put the value where it was not asked.
  if (owners.length > 1) {
    return {
      problem: `${element} holds ${String(owners.length)} fields — fill each by its own id: ${owners.join(', ')}`
    };
  }

  const field = own ? node : node.locator(FIELDS).first();

  const kind = await field.evaluate(
    each =>
      each instanceof HTMLSelectElement
        ? 'select'
        : each instanceof HTMLInputElement && (each.type === 'checkbox' || each.type === 'radio')
          ? 'check'
          : 'text',
    undefined
  );
  if (kind === 'check' && value !== 'true' && value !== 'false') {
    return { problem: `${element} is a box to tick: --fill ${element}=true or ${element}=false` };
  }

  try {
    if (kind === 'check') {
      await field.setChecked(value === 'true', { timeout: 3000 });
    } else if (kind === 'select') {
      await field.selectOption(value, { timeout: 3000 });
    } else {
      await field.fill(value, { timeout: 3000 });
    }
  } catch (error) {
    return {
      problem: `${element} could not be filled: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`
    };
  }

  const shown = `${element} = ${JSON.stringify(value)}`;

  return { filled: owners[0] === element ? shown : `${shown} (the field of ${owners[0]}, inside it)` };
};

/**
 * The element clicked as a visitor clicks it — brought into view first, which is not the click's doing — and what
 * changed: the flows it ran, where the page went, what scrolled, appeared or went, the state. A click that changed
 * nothing is said as such: a button whose flow does nothing looks the same as one that works until somebody clicks.
 */
const clickEffects = async (
  page: BrowserPage,
  authored: Authored | undefined,
  { element: id, fill }: ClickAsk
): Promise<ClickReport> => {
  const target = page.locator(selectorOf(authored, id)).first();
  if ((await target.count()) === 0) {
    return { element: id, problem: `no element ${id} is on this page`, changes: [], failed: [] };
  }

  const filled: string[] = [];
  for (const field of fill) {
    const result = await fillField(page, authored, field);
    if ('problem' in result) {
      return { element: id, problem: result.problem, changes: [], failed: [] };
    }

    filled.push(result.filled);
  }

  try {
    await target.scrollIntoViewIfNeeded({ timeout: 3000 });
  } catch {
    return { element: id, problem: `${id} could not be brought into view`, changes: [], failed: [] };
  }

  const tools = await readDevTools(page, { state: true });
  const before = await page.evaluate(pageMomentInPage, undefined);
  await page.evaluate(listenForRefusedFieldsInPage, undefined);
  const ran = new Set(tools.flows.map(flow => `${flow.at}|${flow.trigger}|${String(flow.on)}`));
  try {
    await target.click({ timeout: 3000 });
  } catch (error) {
    const reason = error instanceof Error ? error.message.split('\n')[0] : String(error);

    return { element: id, problem: `${id} could not be clicked: ${reason}`, changes: [], failed: [] };
  }

  // Time for what it set off to land: a flow's steps, a smooth scroll, a page it went to.
  await page.waitForTimeout(1200);
  const toolsAfter = await readDevTools(page, { state: true });
  const after = await page.evaluate(pageMomentInPage, undefined);
  const refused = await page.evaluate(refusedFieldsInPage, undefined);
  const flows = toolsAfter.flows.filter(flow => !ran.has(`${flow.at}|${flow.trigger}|${String(flow.on)}`));

  return {
    element: id,
    ...(filled.length > 0 ? { filled } : {}),
    changes: [
      ...flows.map(
        flow =>
          `ran ${flow.trigger}${flow.on ? ` of ${flow.on}` : ''}: ${flow.steps.map(step => `${step.action} ${step.status}`).join(', ') || 'no steps'}`
      ),
      // The browser's own refusal — a required field left empty — draws a bubble no element of the page holds, and
      // stops the submit before any flow runs: without this line it reads as a button that does nothing.
      ...refused.map(field => `the browser held the form back: ${field}`),
      ...momentChanges(before, after, { before: tools.state, after: toolsAfter.state })
    ],
    failed: flows.filter(flow => flow.status === 'failed').map(failedFlowText)
  };
};

/**
 * How many rows each list draws: the copies of its row — the most of any of its children, one per row whatever a row
 * hides — inside the list's first node. Runs in the page, self-contained.
 */
export const renderedRowsInPage = (
  lists: { id: string; selector: string; row: string[] }[]
): [string, number | null][] =>
  lists.map(({ id, selector, row }) => {
    const node = document.querySelector(selector);

    return [id, node ? Math.max(0, ...row.map(child => node.querySelectorAll(child).length)) : null];
  });

/** The contested styles of the element asked for, by its handle's selector and the classes the space gives it. */
const elementStyles = async (
  page: BrowserPage,
  authored: Authored | undefined,
  id: string
): Promise<ElementStyles | null> => {
  if (!authored) {
    return null;
  }

  const handle = Object.hasOwn(authored.handles.elements, id) ? authored.handles.elements[id] : undefined;
  const element = Object.hasOwn(authored.schema.flat, id) ? authored.schema.flat[id] : undefined;
  if (!handle || !element) {
    return null;
  }

  const classesOf = (one: SchemaElement): string[] =>
    Object.values(one.definition.styleSelectors).flatMap(names => names.split(/\s+/).filter(Boolean));
  const classes = classesOf(element);
  const read = await page.evaluate(contestedStylesInPage, { selector: handle.selector, classes });
  if (!read) {
    return null;
  }

  const others = Object.values(authored.schema.flat).filter(one => one.id !== id);
  const wornBy = Object.fromEntries(
    classes.map(className => [className, others.filter(one => classesOf(one).includes(className)).map(one => one.id)])
  );

  return { ...read, wornBy };
};

const listRows = async (
  page: BrowserPage,
  authored: Authored,
  sources: Record<string, number | null>
): Promise<Record<string, ListRows>> => {
  const selectorOf = (id: string): string | undefined =>
    Object.hasOwn(authored.handles.elements, id) ? authored.handles.elements[id].selector : undefined;
  const lists = Object.keys(sources).flatMap(id => {
    const selector = selectorOf(id);
    const row = (authored.schema.flat[id].definition.items ?? []).flatMap(child => selectorOf(child) ?? []);

    return selector ? [{ id, selector, row }] : [];
  });
  const rendered = new Map(lists.length > 0 ? await page.evaluate(renderedRowsInPage, lists) : []);

  return Object.fromEntries(
    Object.entries(sources).map(([id, source]) => [id, { rendered: rendered.get(id) ?? null, source }])
  );
};

/**
 * What the page has once hydrated and the server's HTML did not: inside a server provider, an issue per provider — its
 * answer was meant to be in the page as it arrived; anywhere else, what the browser renders on its own, said apart.
 */
const lateElements = (
  schema: Schema | undefined,
  served: Set<string>,
  hydrated: string[],
  width: number
): { issues: CheckIssue[]; browserOnly: string[] } => {
  const late = [...new Set(hydrated)].filter(id => !served.has(id));
  const byProvider = new Map<string, string[]>();
  const browserOnly: string[] = [];
  for (const id of late) {
    const provider = schema ? serverProviderOf(schema, id) : undefined;
    if (provider) {
      byProvider.set(provider, [...(byProvider.get(provider) ?? []), id]);
    } else {
      browserOnly.push(id);
    }
  }

  const issues = [...byProvider].map(([provider, ids]): CheckIssue => ({
    code: 'not-server-rendered',
    message: `apiContainer "${provider}" is resolved on the server, and ${String(ids.length)} of what it holds was not in the HTML the server sent (${ids.slice(0, 6).join(', ')}${ids.length > 6 ? ', …' : ''}) — it arrived after the page, so the first paint and a crawler miss it`,
    elementId: provider,
    width
  }));

  return { issues, browserOnly };
};

const checkAt = async (
  browser: Browser,
  origin: string,
  pathname: string,
  width: number,
  scheme: Scheme | undefined,
  authored: Authored | undefined,
  asked: DevToolsInput,
  ssr: boolean,
  account: Account | undefined,
  click?: ClickAsk
): Promise<CheckReport> => {
  const handles = authored?.handles;
  const page = await openProjectPage(browser, origin, { width, height: 900, ...(scheme ? { scheme } : {}) });
  /** A report of a page that could not be looked at — nothing answered, no sign-in, sent elsewhere. */
  const unchecked = (issue: CheckIssue): CheckReport => ({
    path: pathname,
    width,
    ok: false,
    checked: 0,
    problems: [issue.message],
    issues: [issue],
    hiddenAtWidth: [],
    consoleErrors: [],
    failedRequests: [],
    devTools: false,
    lists: {}
  });
  if (account) {
    const signedIn = await page.request.post(`${origin}${SIGN_IN_PATH}`, {
      data: { username: account.username, password: account.password }
    });
    if (!signedIn.ok()) {
      return unchecked({
        code: 'not-signed-in',
        message:
          signedIn.status() === 404
            ? `nothing answers at ${SIGN_IN_PATH}: --as signs in through the routes createServer({ auth }) mounts there`
            : `${account.username} was not signed in (${String(signedIn.status())}): ${(await signedIn.text()).slice(0, 200)} — check ${CHECK_PASSWORD_ENV} in .env`,
        width
      });
    }
  }

  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on('pageerror', error => consoleErrors.push(error.message));
  const address = `${origin}${pathname}`;
  page.on('console', message => {
    // The browser's own line for the page's status — a 404 the page is sent with on purpose — is said apart, below.
    if (message.type() === 'error' && message.location().url !== address) {
      consoleErrors.push(message.text());
    }
  });
  let sentWith: number | undefined;
  page.on('response', response => {
    // The page itself, answered with the status it is sent with: said apart from what it asked for once it loaded.
    if (sentWith === undefined && response.url() === address) {
      sentWith = response.status();

      return;
    }

    if (response.status() >= 400 && response.url().startsWith(origin)) {
      failedRequests.push(`${String(response.status())} ${response.url().slice(origin.length)}`);
    }
  });

  // A path no page of the space answers is said as that, before the browser opens it: whatever the server does with
  // it — a redirect home, a not-found — would otherwise be read as something the page did.
  if (handles && !pageFor(handles, pathname)) {
    return {
      ...unchecked({ code: 'no-page', message: noPageMessage(handles, pathname), width }),
      consoleErrors,
      failedRequests
    };
  }

  // Settled, not `networkidle`: a page with a live channel keeps its stream open, and never idles.
  const answered = await openPage(page, `${origin}${pathname}`);
  if (!answered) {
    return {
      ...unchecked({ code: 'no-answer', message: `nothing answers at ${origin}${pathname}`, width }),
      consoleErrors,
      failedRequests
    };
  }

  // A page that sent the browser elsewhere — a page for signed-in visitors, to the sign-in — is not the page asked for:
  // every element of it would read as missing.
  const landed = new URL(page.url()).pathname;
  if (withoutTrailingSlash(landed) !== withoutTrailingSlash(new URL(`${origin}${pathname}`).pathname)) {
    return {
      ...unchecked({
        code: 'redirected',
        message: account
          ? `${pathname} sent the browser to ${landed}, signed in as ${account.username}: that account may not see it`
          : `${pathname} sent the browser to ${landed} — what a page for signed-in visitors does: \`plitzi page check ${pathname} --as <username>\` signs in first, the password in ${CHECK_PASSWORD_ENV} in .env`,
        width
      }),
      consoleErrors,
      failedRequests
    };
  }

  // What is checked is the page: the dev tools' badge sits over it and is no part of it.
  await withoutDevTools(page);
  const pageId = handles ? pageFor(handles, pathname) : undefined;
  const report = handles && pageId ? await inspectPage(page, handles, { page: pageId }) : await inspectDocument(page);
  // The sources always: what the bindings read is held against them. Printed only when asked.
  const devTools = await readDevTools(page, { ...asked, state: true });
  const styled = asked.element === undefined ? undefined : await elementStyles(page, authored, asked.element);
  const clicked = click === undefined ? undefined : await clickEffects(page, authored, click);
  const data =
    authored && pageId && devTools.sources
      ? dataIssues(authored.schema, pageId, devTools.sources, { hidden: await notShown(page, authored) })
      : undefined;
  const lists = authored && data ? await listRows(page, authored, data.lists) : {};
  const served = ssr ? markedIn(await (await fetch(`${origin}${pathname}`)).text()) : undefined;
  const late = served
    ? lateElements(
        authored?.schema,
        served,
        await page.evaluate(
          (selector: string) =>
            Array.from(document.querySelectorAll(selector), element => element.getAttribute('data-plitzi-el') ?? ''),
          '[data-plitzi-el]'
        ),
        width
      )
    : undefined;
  const noPage: CheckIssue[] =
    handles && !pageId ? [{ code: 'no-page', message: `no page of the space answers at ${pathname}`, width }] : [];
  const failedFlows = devTools.flows
    .filter(flow => flow.status === 'failed')
    .map((flow): CheckIssue => ({
      code: 'flow-failed',
      message: failedFlowText(flow),
      ...(flow.on === undefined ? {} : { elementId: flow.on }),
      width
    }));
  const notFoundPage = handles && pageId ? isNotFoundPage(handles.pages[pageId]) : false;
  const statusIssues: CheckIssue[] =
    notFoundPage && sentWith !== 404
      ? [
          {
            code: 'page-status',
            message: `${pathname} shows the page for an address nothing answers, sent with status ${String(sentWith)}: a crawler reads it as a page that exists — the server should send it with 404`,
            width
          }
        ]
      : sentWith !== undefined && sentWith >= 400 && sentWith !== 404
        ? [{ code: 'page-status', message: `${pathname} was sent with status ${String(sentWith)}`, width }]
        : [];
  const issues: CheckIssue[] = [
    ...noPage,
    ...statusIssues,
    ...report.issues.map((issue): CheckIssue => ({ ...issue, width })),
    ...(data?.issues ?? []).map((issue): CheckIssue => ({ ...issue, width })),
    ...(late?.issues ?? []),
    ...failedFlows
  ];

  return {
    path: pathname,
    width,
    // A click that could not be made, or whose flow failed, is the page not doing what it is for.
    ok:
      issues.length === 0 &&
      consoleErrors.length === 0 &&
      failedRequests.length === 0 &&
      !clicked?.problem &&
      (clicked?.failed.length ?? 0) === 0,
    checked: report.checked,
    problems: issues.map(issue => issue.message),
    issues,
    hiddenAtWidth: report.hiddenAtWidth,
    consoleErrors,
    failedRequests,
    devTools: devTools.available,
    lists,
    ...(late ? { browserOnly: late.browserOnly } : {}),
    ...(!asked.state || devTools.state === undefined ? {} : { state: devTools.state }),
    ...(!asked.state || devTools.sources === undefined ? {} : { sources: devTools.sources }),
    ...(devTools.element === undefined ? {} : { element: devTools.element }),
    ...(styled === undefined ? {} : { styles: styled }),
    ...(clicked === undefined ? {} : { clicked }),
    ...(sentWith === 404 ? { notFound: true as const } : {})
  };
};

/** What the page holds, when it was asked for: one compact line each, the shape of a source rather than its rows. */
const heldText = (report: CheckReport, asked: DevToolsInput): string[] => {
  if (!asked.state && asked.element === undefined) {
    return [];
  }

  if (!report.devTools) {
    return ['  · the page has no dev tools on (debug mode), so its state and elements cannot be read'];
  }

  return [
    ...(report.state === undefined ? [] : [`  · state ${JSON.stringify(report.state)}`]),
    ...Object.entries(report.sources ?? {}).map(([name, value]) => `  · source ${name}: ${shapeOf(value)}`),
    ...(asked.element === undefined ? [] : [`  · element ${asked.element}: ${JSON.stringify(report.element ?? null)}`]),
    ...(asked.element === undefined || report.styles === undefined
      ? []
      : report.styles === null
        ? [`  · element ${asked.element} is not on the page: its styles cannot be read`]
        : [
            ...(report.styles.contested.length === 0
              ? [`  · element ${asked.element}: no property is set by more than one of its classes`]
              : contestedText(report.styles.contested, report.styles.wornBy).map(
                  line => `  · element ${asked.element} at rest — ${line}`
                )),
            ...inertText(report.styles.inert, report.width, report.styles.wornBy).map(
              line => `  · element ${asked.element}: ${line}`
            )
          ])
  ];
};

/** A value's shape in a few words: a list's length, an object's keys, a short value as it is. */
const shapeOf = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `a list of ${String(value.length)}`;
  }

  if (isRecord(value)) {
    const keys = Object.keys(value);

    return `{ ${keys.slice(0, 8).join(', ')}${keys.length > 8 ? ', …' : ''} }`;
  }

  const text = value === undefined ? 'undefined' : JSON.stringify(value);

  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
};

const rowsText = (count: number): string => `${String(count)} row${count === 1 ? '' : 's'}`;

/** One list's rows in a few words: `plan-list 3 rows`, `feed 4 of 8 rows`, `hits not rendered (16 in its source)`. */
export const listText = (id: string, { rendered, source }: ListRows): string => {
  if (source === null) {
    return `${id} reads nothing`;
  }

  if (rendered === null) {
    return `${id} not rendered (${String(source)} in its source)`;
  }

  return `${id} ${rendered === source ? rowsText(source) : `${String(rendered)} of ${rowsText(source)}`}`;
};

/** Each list's rows, drawn and in its source — so an empty one is seen, not inferred from a box. */
const listsText = (lists: CheckReport['lists']): string[] => {
  const entries = Object.entries(lists);
  if (entries.length === 0) {
    return [];
  }

  return [chalk.dim(`  · lists: ${entries.map(([id, rows]) => listText(id, rows)).join(', ')}`)];
};

/** With `--ssr`, what only the browser renders — not a problem outside a server provider, and said so it is seen. */
const browserOnlyText = (report: CheckReport): string[] =>
  report.browserOnly && report.browserOnly.length > 0
    ? [
        chalk.dim(
          `  · rendered only in the browser, outside any server provider: ${report.browserOnly.slice(0, 10).join(', ')}${report.browserOnly.length > 10 ? `, … (${String(report.browserOnly.length)})` : ''}`
        )
      ]
    : [];

/** What a click changed, a line each — or that it changed nothing, which is the line a broken button gets. */
export const clickedText = (clicked: ClickReport | undefined): string[] => {
  if (!clicked) {
    return [];
  }

  if (clicked.problem) {
    return [`  - click: ${clicked.problem}`];
  }

  return [
    ...(clicked.filled ? [`  · filled ${clicked.filled.join(', ')}`] : []),
    ...(clicked.changes.length === 0
      ? [
          `  · clicking ${clicked.element} changed nothing: no flow ran, the page went nowhere, nothing scrolled, appeared or went, nothing was said, and the state is as it was`
        ]
      : [
          `  · clicking ${clicked.element}:`,
          ...clicked.changes.map(change => `      ${change}`),
          // A flow that ran and succeeded is not a page that changed: when only flows are said, that is said too.
          ...(clicked.changes.every(change => change.startsWith('ran '))
            ? [
                '      — and nothing on the page changed: the page went nowhere, nothing scrolled, appeared or went, nothing was said, and the state is as it was'
              ]
            : [])
        ]),
    ...clicked.failed.map(flow => `  - ${flow}`)
  ];
};

export const reportText = (report: CheckReport, asked: DevToolsInput): string => {
  const head = `${report.path} at ${String(report.width)} px`;
  const held = [
    ...(report.notFound ? ['  · sent with status 404: the page for an address that shows nothing'] : []),
    ...listsText(report.lists),
    ...browserOnlyText(report),
    ...heldText(report, asked),
    ...clickedText(report.clicked)
  ];
  const atWidth =
    report.hiddenAtWidth.length > 0
      ? chalk.dim(`  · hidden at this width by a breakpoint, on purpose: ${report.hiddenAtWidth.join(', ')}`)
      : undefined;
  if (report.ok) {
    return [
      chalk.green(
        `✓ ${head} — ${report.checked > 0 ? `${String(report.checked)} elements on screen, ` : ''}nothing wrong`
      ),
      ...(atWidth ? [atWidth] : []),
      ...held
    ].join('\n');
  }

  return [
    chalk.red(`✗ ${head}`),
    ...report.problems.map(problem => `  - ${problem}`),
    ...report.consoleErrors.map(error => `  - console: ${error}`),
    ...report.failedRequests.map(request => `  - request refused: ${request}`),
    ...held
  ].join('\n');
};

const withoutTrailingSlash = (path: string): string => (path.length > 1 ? path.replace(/\/+$/, '') : path);

export const check = async (routes: string[], options: CheckOptions): Promise<void> => {
  const project = await projectHere('whose page to check');
  if (!project) {
    return;
  }

  // Signed in only when asked: a page checked as nobody is what a visitor who has not signed in sees.
  const account = options.as === undefined ? undefined : await checkAccount(project.root, options.as);
  if (account && 'problem' in account) {
    fail(`--as ${account.problem}.`);

    return;
  }

  if (options.fill && !options.click) {
    fail('--fill fills fields for a --click: with nothing clicked, nothing they hold is sent anywhere.');

    return;
  }

  if (options.click && routes.length > 1) {
    fail(`--click clicks one element of one page: ${String(routes.length)} were named.`);

    return;
  }

  const asked: DevToolsInput = {
    state: Boolean(options.state),
    ...(options.element ? { element: options.element } : {})
  };
  const reports = await checkRoutes(project, routes.length > 0 ? routes : ['/'], {
    widths: options.width ?? [1440, 390],
    asked,
    ssr: Boolean(options.ssr),
    ...(options.scheme ? { scheme: options.scheme } : {}),
    ...(account ? { account } : {}),
    ...(options.click ? { click: { element: options.click, fill: options.fill ?? [] } } : {})
  });
  if ('problem' in reports) {
    fail(reports.problem);

    return;
  }

  console.log(options.json ? JSON.stringify(reports) : reports.map(report => reportText(report, asked)).join('\n'));
  if (reports.some(report => !report.ok)) {
    process.exitCode = 1;
  }
};

/**
 * Pages of the running project checked, each at each width, in one browser: what `check` does for one route and
 * `verify` for every page that has no parameter in its path. A project the server does not answer for, or with no
 * browser, is a problem said once rather than a report per page.
 */
export const checkRoutes = async (
  project: { root: string; plitzi?: ExistingProject['plitzi'] },
  routes: readonly string[],
  options: {
    widths: readonly number[];
    asked: DevToolsInput;
    ssr: boolean;
    scheme?: Scheme;
    account?: Account;
    click?: ClickAsk;
  }
): Promise<CheckReport[] | { problem: string }> => {
  const plitzi = project.plitzi?.kind === 'project' ? project.plitzi : undefined;
  const where = await projectOrigin(project.root, plitzi);
  if ('problem' in where) {
    return where;
  }

  const authored = plitzi?.source === 'local' ? await projectSpace(project.root) : undefined;
  if (authored && 'problem' in authored) {
    return authored;
  }

  const browser = await launchBrowser(project.root);
  if ('problem' in browser) {
    return browser;
  }

  try {
    const reports: CheckReport[] = [];
    for (const route of routes) {
      for (const width of options.widths) {
        reports.push(
          await checkAt(
            browser,
            where.origin,
            route,
            width,
            options.scheme,
            authored,
            options.asked,
            options.ssr,
            options.account,
            options.click
          )
        );
      }
    }

    return reports;
  } finally {
    await browser.close();
  }
};

/** The paths of the space's pages that take no parameter — the ones a check can open as they are. */
export const staticPaths = async (root: string): Promise<string[] | { problem: string }> => {
  const authored = await projectSpace(root);
  if ('problem' in authored) {
    return authored;
  }

  return (
    Object.values(authored.handles.pages)
      // The page for an address nothing answers is looked at where it shows: at an address no page has.
      .map(page => (isNotFoundPage(page) ? `${page.path.slice(0, -1)}${NOT_FOUND_PROBE}` : page.path))
      .filter(pathname => pathname.split('/').every(segment => !segment.startsWith(':') && !/\{\{.*\}\}/.test(segment)))
  );
};
