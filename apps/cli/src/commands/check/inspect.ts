import {
  dataIssues,
  failedFlowText,
  inspectDocument,
  inspectPage,
  openPage,
  readDevTools
} from '@plitzi/sdk-authoring';

import { CHECK_PASSWORD_ENV, sentElsewhere, signInAs } from './account';
import { clickEffects } from './click';
import { missedExpectations, wrappedLabelsInPage } from './expect';
import { listRows } from './lists';
import {
  NOT_FOUND_PROBE,
  isNotFoundPage,
  markedIn,
  meantPage,
  noPageMessage,
  notShown,
  pageFor,
  serverProviderOf
} from './space';
import { elementStyles } from './styles';
import { openProjectPage, withoutDevTools } from '../../browser';

import type { Account } from './account';
import type { Authored } from './space';
import type { CheckAsk, CheckIssue, CheckReport, ClickAsk, Expectation } from './types';
import type { Browser, BrowserPage, ProjectView } from '../../browser';
import type { Schema } from '@plitzi/sdk-shared';

/**
 * One page checked at one width: opened, followed by its own links (`--then`), inspected whole, and reported.
 */

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

/**
 * Goes to `path` the way a visitor does: a click on a link of the page that goes there — `href` the path itself, or the
 * page's own address for it — and the space's client navigation. What it could not do, said; nothing when it went.
 */
const followLink = async (page: BrowserPage, origin: string, path: string): Promise<string | undefined> => {
  const selector = `a[href="${path}"], a[href="${origin}${path}"]`;
  const link = page.locator(selector).first();
  if ((await link.count()) === 0) {
    return `--then ${path}: no link on the page goes there — a visitor could not get to it from here (check it on its own)`;
  }

  await link.click({ timeout: 3000 });
  let arrived = false;
  for (let waited = 0; waited < 10_000 && !arrived; waited += 200) {
    arrived = (await page.evaluate(() => window.location.pathname, undefined)) === path;
    if (!arrived) {
      await page.waitForTimeout(200);
    }
  }

  if (!arrived) {
    return `--then ${path}: the link was clicked, and the page stayed at ${new URL(page.url()).pathname}`;
  }

  // Let what the next page reads arrive, as a load would: providers, then a paint.
  await page.waitForTimeout(800);

  return undefined;
};

/** What the page open in `page` is checked for, as it stands: what `checkAt` asks of its first page and `--then` of each next. */
/**
 * An image the probe calls never loaded that the browser was answered for (2xx): it loaded and draws no size of its own
 * — an SVG with a viewBox and no width or height, a flag — which the browser reports as 0 wide (la-velada: every
 * country flag of the schedules, failing each check of the home).
 */
export const answeredImage = (issue: { code: string; message: string }, answered: ReadonlySet<string>): boolean => {
  if (issue.code !== 'image-not-loaded') {
    return false;
  }

  const address = /https?:\/\/\S+/.exec(issue.message)?.[0];

  return address !== undefined && answered.has(address);
};

const hostOf = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
};

/** A console error, with the document it came from when the browser says. */
interface ConsoleLine {
  text: string;
  from?: string;
}

/** The address an image issue names, when it is one the browser was told to ask again later (429). */
export const throttledImage = (
  issue: { code: string; message: string },
  throttled: ReadonlySet<string>
): string | undefined => {
  const address = issue.code === 'image-not-loaded' ? /https?:\/\/\S+/.exec(issue.message)?.[0] : undefined;

  return address !== undefined && throttled.has(address) ? address : undefined;
};

const inspectHere = async (
  page: BrowserPage,
  {
    origin,
    pathname,
    width,
    authored,
    asked,
    ssr,
    click,
    expect,
    sentWith,
    consoleErrors,
    failedRequests,
    answered,
    throttled
  }: {
    origin: string;
    pathname: string;
    width: number;
    authored: Authored | undefined;
    asked: CheckAsk;
    ssr: boolean;
    click: ClickAsk | undefined;
    expect: readonly Expectation[];
    /** What the document was sent with — none for a page reached by a click, which no document was sent for. */
    sentWith: number | undefined;
    /** The page's console errors so far — read once the page is looked at, so what came while it was is in them. */
    consoleErrors: () => ConsoleLine[];
    failedRequests: string[];
    /** The images the browser was answered with, by address: one of them that draws no size is loaded, not failed. */
    answered: ReadonlySet<string>;
    /**
     * What a host held back — answered 429 (ask again later), or dropped while it answered the page's other requests:
     * its limit met by the checks asking at once (la-velada: the original's CDN, under a run's checks), said apart and
     * never the page's failure. Read once the page is looked at.
     */
    throttled: () => ReadonlySet<string>;
  }
): Promise<CheckReport> => {
  const handles = authored?.handles;
  // What is checked is the page: the dev tools' badge sits over it and is no part of it.
  await withoutDevTools(page);
  const pageId = handles ? pageFor(handles, pathname) : undefined;
  const report = handles && pageId ? await inspectPage(page, handles, { page: pageId }) : await inspectDocument(page);
  // The sources always: what the bindings read is held against them. Printed only when asked.
  const devTools = await readDevTools(page, { state: true });
  const clicked = click === undefined ? undefined : await clickEffects(page, authored, click);
  // What is said of the element and the state is the page as the visitor left it: after the fill and the click, when
  // there were any — the page's own checks still read it as it loaded.
  const shown = clicked === undefined ? devTools : await readDevTools(page, { state: true });
  const { missed, met } = await missedExpectations(
    page,
    authored,
    expect.filter(each => each.path === undefined || each.path === pathname),
    width
  );
  const wrapped: CheckIssue[] = (
    await page.evaluate(wrappedLabelsInPage, 'a[data-plitzi-el], button[data-plitzi-el]')
  ).map(each => ({
    code: 'label-wraps',
    message: `${each.id}'s label "${each.label}" breaks onto ${String(each.lines)} lines at ${String(width)} px: it is squeezed — give its row room, or let the row wrap as a whole and keep the label on one line (white-space: nowrap). A link or button of three words or fewer is read as a label, and its text's lines are counted where they are drawn`,
    elementId: each.id,
    width
  }));
  // Each element asked for, one read each: what it reads and holds, and how its classes meet on it.
  const elements: NonNullable<CheckReport['elements']> = {};
  for (const id of asked.elements) {
    elements[id] = {
      read: (await readDevTools(page, { state: false, element: id })).element ?? null,
      styles: await elementStyles(page, authored, id)
    };
  }

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
    notFoundPage && sentWith !== undefined && sentWith !== 404
      ? [
          {
            code: 'page-status',
            message: `${pathname} shows the page for an address nothing answers, sent with status ${String(sentWith)}: a crawler reads it as a page that exists — the server should send it with 404`,
            width
          }
        ]
      : sentWith !== undefined && sentWith >= 400 && sentWith !== 404
        ? [{ code: 'page-status', message: `${pathname} was sent with status ${String(sentWith)}`, width }]
        : // Asked for a page, the space's page for an address nothing answers came: no page of it is there. Only the
          // address a whole-project check makes for it looks at that page on purpose.
          notFoundPage && !pathname.endsWith(NOT_FOUND_PROBE)
          ? [
              {
                code: 'no-page',
                message: `no page of the space is at ${pathname}: its page for an address nothing answers came, with ${String(sentWith ?? 404)}${handles ? meantPage(handles, pathname) : ''}`,
                width
              }
            ]
          : [];
  const heldBack = throttled();
  const limited = report.issues.flatMap(issue => throttledImage(issue, heldBack) ?? []);
  const issues: CheckIssue[] = [
    ...noPage,
    ...statusIssues,
    ...report.issues
      .filter(issue => !answeredImage(issue, answered) && throttledImage(issue, heldBack) === undefined)
      .map((issue): CheckIssue => ({ ...issue, width })),
    ...(data?.issues ?? []).map((issue): CheckIssue => ({ ...issue, width })),
    ...(late?.issues ?? []),
    ...failedFlows,
    ...missed,
    ...wrapped
  ];

  // What a document embedded in the page said (a video player's frame, by the origin of an iframe there) is that
  // document's, not the space's: said apart, never the page's failure (la-velada: YouTube's player, a permissions
  // policy line now and then).
  const embeds = new Set(
    await page.evaluate(
      (selector: string) =>
        Array.from(document.querySelectorAll(selector), frame => {
          try {
            return new URL(frame.getAttribute('src') ?? '', location.href).origin;
          } catch {
            return '';
          }
        }),
      'iframe[src]'
    )
  );
  const originOf = (url: string | undefined): string | undefined => {
    try {
      return url ? new URL(url).origin : undefined;
    } catch {
      return undefined;
    }
  };
  const lines = consoleErrors();
  const embedded = (line: ConsoleLine): boolean => {
    const from = originOf(line.from);

    return from !== undefined && from !== new URL(origin).origin && embeds.has(from);
  };
  const errors = lines.filter(line => !embedded(line)).map(line => line.text);
  const fromEmbeds = lines.filter(embedded).map(line => `${originOf(line.from) ?? ''}: ${line.text}`);

  return {
    path: pathname,
    width,
    // A click that could not be made, or whose flow failed, is the page not doing what it is for.
    ok:
      issues.length === 0 &&
      errors.length === 0 &&
      failedRequests.length === 0 &&
      !clicked?.problem &&
      (clicked?.failed.length ?? 0) === 0,
    checked: report.checked,
    problems: issues.map(issue => issue.message),
    issues,
    hiddenAtWidth: report.hiddenAtWidth,
    consoleErrors: errors,
    failedRequests,
    devTools: devTools.available,
    lists,
    ...(limited.length > 0 ? { throttled: limited } : {}),
    ...(fromEmbeds.length > 0 ? { fromEmbeds } : {}),
    ...(met.length > 0 ? { expected: met } : {}),
    ...(late ? { browserOnly: late.browserOnly } : {}),
    ...(!asked.state || shown.state === undefined ? {} : { state: shown.state }),
    ...(!asked.state || shown.sources === undefined ? {} : { sources: shown.sources }),
    ...(asked.elements.length > 0 ? { elements } : {}),
    ...(clicked === undefined ? {} : { clicked }),
    ...(sentWith === 404 ? { notFound: true as const } : {})
  };
};

export const checkAt = async (
  browser: Browser,
  origin: string,
  pathname: string,
  width: number,
  view: Pick<ProjectView, 'scheme' | 'presence'>,
  authored: Authored | undefined,
  asked: CheckAsk,
  ssr: boolean,
  account: Account | undefined,
  click?: ClickAsk,
  expect: readonly Expectation[] = [],
  then: readonly string[] = []
): Promise<CheckReport[]> => {
  const handles = authored?.handles;
  const page = await openProjectPage(browser, origin, { width, height: 900, ...view });
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
  const notSignedIn = account && (await signInAs(page, origin, account));
  if (notSignedIn) {
    return [unchecked({ code: 'not-signed-in', message: notSignedIn, width })];
  }

  const said: { text: string; from?: string }[] = [];
  const failedRequests: string[] = [];
  const imagesAnswered = new Set<string>();
  const throttled = new Set<string>();
  // An image a host dropped (no answer at all) while it answered the page's other requests is that host holding back,
  // as a 429 is; a host that answered nothing is down, or the address wrong — the page's to fix.
  const answeredHosts = new Set<string>();
  const dropped = new Set<string>();
  // …and so is one it still has not answered when the page is looked at, a host that answered the rest stalling it:
  // neither a 429 nor a drop, and read as the page's own image that never loaded (la-velada's CDN, under a finish).
  const pending = new Set<string>();
  const elsewhere = (url: string, type: string): boolean => type === 'image' && !url.startsWith(origin);
  page.on('request', request => {
    if (elsewhere(request.url(), request.resourceType())) {
      pending.add(request.url());
    }
  });
  page.on('requestfailed', request => {
    pending.delete(request.url());
    if (elsewhere(request.url(), request.resourceType())) {
      dropped.add(request.url());
    }
  });
  const heldBack = (): ReadonlySet<string> =>
    new Set([...throttled, ...[...dropped, ...pending].filter(url => answeredHosts.has(hostOf(url)))]);
  page.on('pageerror', error => said.push({ text: error.message }));
  const address = `${origin}${pathname}`;
  page.on('console', message => {
    // The browser's own line for the page's status — a 404 the page is sent with on purpose — is said apart, below.
    if (message.type() === 'error' && message.location().url !== address) {
      said.push({ text: message.text(), from: message.location().url });
    }
  });
  // The browser's line for a resource its host held back is that host's limit, said with the images it held.
  const consoleErrors = (from = 0): ConsoleLine[] => {
    const held = heldBack();

    return said.slice(from).filter(each => each.from === undefined || !held.has(each.from));
  };
  let sentWith: number | undefined;
  page.on('response', response => {
    pending.delete(response.url());
    // The page itself, answered with the status it is sent with: said apart from what it asked for once it loaded.
    if (sentWith === undefined && response.url() === address) {
      sentWith = response.status();

      return;
    }

    if (response.status() < 300 && (response.headers()['content-type'] ?? '').startsWith('image/')) {
      imagesAnswered.add(response.url());
    }

    if (response.status() === 429) {
      throttled.add(response.url());
    } else if (response.status() < 400) {
      answeredHosts.add(hostOf(response.url()));
    }

    if (response.status() >= 400 && response.url().startsWith(origin)) {
      failedRequests.push(`${String(response.status())} ${response.url().slice(origin.length)}`);
    }
  });

  // A path no page of the space answers is said as that, before the browser opens it: whatever the server does with
  // it — a redirect home, a not-found — would otherwise be read as something the page did.
  if (handles && !pageFor(handles, pathname)) {
    return [
      {
        ...unchecked({ code: 'no-page', message: noPageMessage(handles, pathname), width }),
        consoleErrors: consoleErrors().map(each => each.text),
        failedRequests
      }
    ];
  }

  // Settled, not `networkidle`: a page with a live channel keeps its stream open, and never idles.
  const answered = await openPage(page, `${origin}${pathname}`);
  if (!answered) {
    return [
      {
        ...unchecked({ code: 'no-answer', message: `nothing answers at ${origin}${pathname}`, width }),
        consoleErrors: consoleErrors().map(each => each.text),
        failedRequests
      }
    ];
  }

  // A page that sent the browser elsewhere — a page for signed-in visitors, to the sign-in — is not the page asked for:
  // every element of it would read as missing.
  const landed = sentElsewhere(page, pathname);
  if (landed) {
    return [
      {
        ...unchecked({
          code: 'redirected',
          message: account
            ? `${pathname} sent the browser to ${landed}, signed in as ${account.username}: that account may not see it`
            : `${pathname} sent the browser to ${landed} — what a page for signed-in visitors does: \`plitzi page check ${pathname} --as <username>\` signs in first, the password in ${CHECK_PASSWORD_ENV} in .env`,
          width
        }),
        consoleErrors: consoleErrors().map(each => each.text),
        failedRequests
      }
    ];
  }

  const reports = [
    await inspectHere(page, {
      origin,
      pathname,
      width,
      authored,
      asked,
      ssr,
      click,
      expect,
      sentWith,
      consoleErrors: () => consoleErrors(),
      failedRequests,
      answered: imagesAnswered,
      throttled: heldBack
    })
  ];
  // On as a visitor goes on: a click on the page's own link to each next path, no reload — what the space keeps while
  // somebody browses (a filter's choice, a session's state) is what the next page is checked with.
  for (const next of then) {
    const errorsBefore = said.length;
    const failedBefore = failedRequests.length;
    const went = await followLink(page, origin, next);
    reports.push(
      went === undefined
        ? await inspectHere(page, {
            origin,
            pathname: next,
            width,
            authored,
            asked,
            ssr: false,
            click: undefined,
            expect,
            sentWith: undefined,
            consoleErrors: () => consoleErrors(errorsBefore),
            failedRequests: failedRequests.slice(failedBefore),
            answered: imagesAnswered,
            throttled: heldBack
          })
        : unchecked({ code: 'no-page', message: went, width })
    );
    if (went !== undefined) {
      break;
    }
  }

  return reports;
};
