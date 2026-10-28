import { authorSpace, closest, pageAt } from '@plitzi/sdk-authoring';
import { authorIsolated } from '@plitzi/sdk-authoring/node';

import { authoredKey, keepAuthored, keptAuthored } from './authoredCache';
import { SCHEMES } from '../../../browser';
import { loadProjectSpace } from '../../project/projectSpace';

import type { BrowserPage, Scheme } from '../../../browser';
import type { SpaceHandles } from '@plitzi/sdk-authoring';
import type { Element as SchemaElement, Schema } from '@plitzi/sdk-shared';

/**
 * The space a page is held to — the project's, or a module's — and which of its pages an address is, its not-found
 * page included; what it owes on screen, and what it shows only under a condition.
 */

/**
 * The space the project declares, authored: what each page owes (the handles), what it reads (the schema), and the
 * themes it can be painted in — a visitor whose system is dark sees the dark one.
 */
export type Authored = { handles: SpaceHandles; schema: Schema; schemes: Scheme[] };

/** The space the project declares, authored. Only for one written here. */
export const projectSpace = async (
  root: string,
  { fresh = false }: { fresh?: boolean } = {}
): Promise<Authored | { problem: string }> => {
  const key = await authoredKey(root);
  const kept = fresh ? undefined : await keptAuthored(root, key);
  if (kept) {
    return kept;
  }

  const project = await loadProjectSpace(root);
  if ('problem' in project) {
    return { problem: `${project.problem} There is nothing to check the page against.` };
  }

  try {
    const { handles, schema, style } = authorSpace(project.space, project.authoring);
    const schemes = SCHEMES.filter(scheme => style.theme.schemes.includes(scheme));
    const authored = { handles, schema, schemes };
    // Kept by what it was authored from — a check that cannot keep it still has it.
    await keepAuthored(root, key, authored).catch(() => undefined);

    return authored;
  } catch (error) {
    return {
      problem: `The space does not author — npm run author says why: ${error instanceof Error ? refusedText(error.message) : String(error)}`
    };
  }
};

/**
 * What authoring refused, its first lines — never its count alone: a run's dev-2 read "1 problem" in page check, and
 * not which.
 */
export const refusedText = (message: string): string => {
  const lines = message
    .split('\n')
    .map(line => line.trim())
    .filter(line => line !== '');

  return `${lines.slice(0, 6).join(' · ')}${lines.length > 6 ? ' …' : ''}`;
};

/**
 * A space module that is not the project's — what another server serves, an agent's page — authored in a process of its
 * own (`authorIsolated`), since whoever wrote it is not necessarily who runs the check.
 */
export const moduleSpace = async (file: string): Promise<Authored | { problem: string }> => {
  const result = await authorIsolated(file);
  if (!result.ok) {
    return { problem: `--space ${file} does not author: ${result.message}` };
  }

  const { handles, schema, style } = result.space;

  return { handles, schema, schemes: SCHEMES.filter(scheme => style.theme.schemes.includes(scheme)) };
};

/**
 * That no page answers a path, with every path the space's pages answer — a parameter written as it is matched
 * (`/p/:slug`), so the one meant is read off the list rather than guessed from letters.
 */
export const noPageMessage = (handles: SpaceHandles, pathname: string): string =>
  `no page of the space answers at ${pathname}: its pages are ${Object.values(handles.pages)
    .map(page => page.path)
    .join(', ')}`;

/** The page an address more likely meant, among the space's own: ` — did you mean /walks?`, or nothing. */
export const meantPage = (handles: SpaceHandles, pathname: string): string => {
  const meant = closest(
    pathname,
    Object.values(handles.pages)
      .filter(page => !isNotFoundPage(page))
      .map(page => page.path)
  );

  return meant === undefined ? '' : ` — did you mean ${meant}?`;
};

/**
 * The space's "not found" page: a page whose slug is `*`, the page of every address under its folder that no other
 * page answers. Not every path ending in `*` — `update/*` is a page of its own that answers a whole subtree.
 */
export const isNotFoundPage = (page: { slug: string }): boolean => page.slug === '*';

/**
 * Whether no page of the space answers `pathname` — a guest nor a signed-in visitor — its not-found page read in its
 * place: a scout measured /explore, the page being /rooms, and read "not drawn here" of every element.
 */
export const noPageAt = (
  authored: { schema: Pick<Schema, 'flat' | 'pages' | 'pageFolders'> },
  pathname: string
): boolean => [false, true].every(signedIn => pageAt(authored.schema, pathname, { signedIn }).action === 'notFound');

/** Where `verify` looks at a page for an address nothing answers: an address under its folder no page has. */
export const NOT_FOUND_PROBE = 'plitzi-check-not-found';

/**
 * The page an address is answered by: the router's own answer (`pageAt`, sdk-authoring) — a guest's, else a signed-in
 * visitor's, a not-found page when nothing else answers. A copy of the router's rules here once drifted from it.
 */
export const pageFor = (
  authored: { schema: Pick<Schema, 'flat' | 'pages' | 'pageFolders'> },
  pathname: string
): string | undefined => {
  const answered = (signedIn: boolean): string | undefined => {
    const at = pageAt(authored.schema, pathname, { signedIn });

    return at.action === 'normal' || at.action === 'notFound' ? at.pageId : undefined;
  };

  return answered(false) ?? answered(true);
};

/** The elements a piece of HTML carries, by the id each is marked with. */
export const markedIn = (html: string): Set<string> =>
  new Set([...html.matchAll(/data-plitzi-el="([^"]+)"/g)].map(([, id]) => id));

/** The `runtime: 'server'` provider an element is inside — or is — if any: what the server's HTML owes. */
export const serverProviderOf = (schema: Schema, id: string): string | undefined => {
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

export const notShown = async (page: BrowserPage, authored: Authored): Promise<Set<string>> => {
  const conditioned = Object.values(authored.schema.flat).flatMap(element => {
    const handle = Object.hasOwn(authored.handles.elements, element.id)
      ? authored.handles.elements[element.id]
      : undefined;

    // A provider with no tag has no node to look for, shown or not.
    return handle && !handle.boxless && hasOwnCondition(element) ? [{ id: element.id, selector: handle.selector }] : [];
  });

  return new Set(conditioned.length > 0 ? await page.evaluate(notShownInPage, conditioned) : []);
};

/** What a whole-project check opens: every page with no parameter in its path, in every theme the space can show. */
export const staticPaths = async (
  root: string
): Promise<{ paths: string[]; schemes: Scheme[] } | { problem: string }> => {
  const authored = await projectSpace(root);
  if ('problem' in authored) {
    return authored;
  }

  const paths = Object.values(authored.handles.pages)
    // The page for an address nothing answers is looked at where it shows: at an address no page has.
    .map(page => (isNotFoundPage(page) ? `${page.path.slice(0, -1)}${NOT_FOUND_PROBE}` : page.path))
    .filter(pathname => pathname.split('/').every(segment => !segment.startsWith(':') && !/\{\{.*\}\}/.test(segment)));

  return { paths, schemes: authored.schemes };
};
