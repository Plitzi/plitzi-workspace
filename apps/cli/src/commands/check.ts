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
import { loadProjectSpace } from './projectSpace';
import { fail } from './terminal';
import { launchBrowser, openProjectPage, projectOrigin, withoutDevTools } from '../browser';

import type { Browser, BrowserPage, Scheme } from '../browser';
import type { DataIssueCode, DevToolsInput, PageIssue, SpaceHandles } from '@plitzi/sdk-authoring';
import type { Element as SchemaElement, Schema } from '@plitzi/sdk-shared';

/**
 * `plitzi check`: whether a page of the running project is whole, said in text — every element it owes on screen, no
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
 *   plitzi check / --width 1440,390 --json
 *   plitzi check /products --state --element catalog-count
 *   plitzi check /pricing --ssr
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
  /**
   * An account of the project to sign in as first, through its server's `/auth` routes (`createServer({ auth })`), with
   * the password in `PLITZI_CHECK_PASSWORD` — what a page for signed-in visitors is checked as.
   */
  as?: string;
}

/** Where `--as` reads the account's password: the environment, never the command line, which a shell keeps. */
export const CHECK_PASSWORD_ENV = 'PLITZI_CHECK_PASSWORD';

/** The project's sign-in route: where `createServer({ auth })` mounts its flows unless told otherwise. */
const SIGN_IN_PATH = '/auth/login';

interface Account {
  username: string;
  password: string;
}

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
    | 'redirected';
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
  /** With `--element`: each property more than one of its classes sets, and which the page shows. `null`: not on it. */
  styles?: ContestedStyle[] | null;
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
const pageFor = (handles: SpaceHandles, pathname: string): string | undefined => {
  const wanted = pathname.replace(/\/$/, '').split('/');

  return Object.values(handles.pages).find(page => {
    const segments = page.path.replace(/\/$/, '').split('/');

    return (
      segments.length === wanted.length &&
      segments.every(
        (segment, index) => segment.startsWith(':') || /^\{\{.*\}\}$/.test(segment) || segment === wanted[index]
      )
    );
  })?.id;
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
}): ContestedStyle[] | null => {
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

  const contested = [...declared].filter(([, list]) => list.length > 1);
  const { transition, animation } = node.style;
  // Off while the classes come and go: a transition would answer the value it starts from, not the one it ends at.
  node.style.transition = 'none';
  node.style.animation = 'none';
  const shownOf = (property: string): string => getComputedStyle(node).getPropertyValue(property);
  const result = contested.map(([property, list]): ContestedStyle => {
    const shown = shownOf(property);
    const winner = list.find(({ className }) => {
      node.classList.remove(className);
      const without = shownOf(property);
      node.classList.add(className);

      return without !== shown;
    })?.className;

    return { property, declared: list, shown, ...(winner ? { winner } : {}) };
  });
  node.style.transition = transition;
  node.style.animation = animation;

  return result;
};

/** Contested properties as lines, those that say the same of the same classes said once: a shorthand's longhands. */
export const contestedText = (contested: readonly ContestedStyle[]): string[] => {
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

    return style.winner
      ? `${named}: ${style.shown}, from ${style.winner} (${over})`
      : `${named}: ${style.shown} — ${style.declared.map(({ className }) => className).join(' and ')} all set it so: any one of them alone gives it`;
  });
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
): Promise<ContestedStyle[] | null> => {
  const handle = authored && Object.hasOwn(authored.handles.elements, id) ? authored.handles.elements[id] : undefined;
  const element = authored && Object.hasOwn(authored.schema.flat, id) ? authored.schema.flat[id] : undefined;
  if (!handle || !element) {
    return null;
  }

  const classes = Object.values(element.definition.styleSelectors).flatMap(names => names.split(/\s+/).filter(Boolean));

  return page.evaluate(contestedStylesInPage, { selector: handle.selector, classes });
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
  account: Account | undefined
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
            : `${account.username} was not signed in (${String(signedIn.status())}): ${(await signedIn.text()).slice(0, 200)} — check ${CHECK_PASSWORD_ENV}`,
        width
      });
    }
  }

  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on('pageerror', error => consoleErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('response', response => {
    if (response.status() >= 400 && response.url().startsWith(origin)) {
      failedRequests.push(`${String(response.status())} ${response.url().slice(origin.length)}`);
    }
  });

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
          : `${pathname} sent the browser to ${landed} — what a page for signed-in visitors does: \`plitzi check ${pathname} --as <username>\` signs in first, the password in ${CHECK_PASSWORD_ENV}`,
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
  const issues: CheckIssue[] = [
    ...noPage,
    ...report.issues.map((issue): CheckIssue => ({ ...issue, width })),
    ...(data?.issues ?? []).map((issue): CheckIssue => ({ ...issue, width })),
    ...(late?.issues ?? []),
    ...failedFlows
  ];

  return {
    path: pathname,
    width,
    ok: issues.length === 0 && consoleErrors.length === 0 && failedRequests.length === 0,
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
    ...(styled === undefined ? {} : { styles: styled })
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
        : report.styles.length === 0
          ? [`  · element ${asked.element}: no property is set by more than one of its classes`]
          : contestedText(report.styles).map(line => `  · element ${asked.element} at rest — ${line}`))
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

const reportText = (report: CheckReport, asked: DevToolsInput): string => {
  const head = `${report.path} at ${String(report.width)} px`;
  const held = [...listsText(report.lists), ...browserOnlyText(report), ...heldText(report, asked)];
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

export const check = async (route: string | undefined, options: CheckOptions): Promise<void> => {
  const project = await projectHere('whose page to check');
  if (!project) {
    return;
  }

  const password = process.env[CHECK_PASSWORD_ENV];
  if (options.as && !password) {
    fail(
      `--as ${options.as} signs in with the password in ${CHECK_PASSWORD_ENV}: set it — ${CHECK_PASSWORD_ENV}=… npx plitzi check …`
    );

    return;
  }

  const account = options.as && password ? { username: options.as, password } : undefined;

  const plitzi = project.plitzi?.kind === 'project' ? project.plitzi : undefined;
  const where = await projectOrigin(project.root, plitzi);
  if ('problem' in where) {
    fail(where.problem);

    return;
  }

  const authored = plitzi?.source === 'local' ? await projectSpace(project.root) : undefined;
  if (authored && 'problem' in authored) {
    fail(authored.problem);

    return;
  }

  const browser = await launchBrowser(project.root);
  if ('problem' in browser) {
    fail(browser.problem);

    return;
  }

  try {
    const widths = options.width ?? [1440, 390];
    const { scheme } = options;
    const asked: DevToolsInput = {
      state: Boolean(options.state),
      ...(options.element ? { element: options.element } : {})
    };
    const reports: CheckReport[] = [];
    for (const width of widths) {
      reports.push(
        await checkAt(
          browser,
          where.origin,
          route ?? '/',
          width,
          scheme,
          authored,
          asked,
          Boolean(options.ssr),
          account
        )
      );
    }

    console.log(options.json ? JSON.stringify(reports) : reports.map(report => reportText(report, asked)).join('\n'));
    if (reports.some(report => !report.ok)) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
};
