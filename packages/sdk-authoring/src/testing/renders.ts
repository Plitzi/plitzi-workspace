import type { TracingReader } from '@plitzi/sdk-shared/store/tracing';

/**
 * Which elements an interaction rendered, and why — read off the SDK's own render tracing.
 *
 * A page that does the right thing can still do it by rendering everything: a binding subscribed to more than it
 * reads, a value that comes out a new object each time, a parent whose change carries every child with it. Nothing
 * shows it but the frame rate, on somebody else's slower machine. This names every element that rendered, how often,
 * and what changed for it — so a suite can hold an interaction to what it should cost, and a failure says where the
 * extra renders came from.
 */

/** What the tracing records of one render — the part read here. */
type TracedRender = {
  elementId: string;
  /**
   * What changed for the element since its previous render, as its `withElement` saw it: set only when the element
   * itself rendered, and empty when it rendered with none of its inputs changed (its context, or its parent).
   */
  changedProps?: { key: string }[];
};

type TracedCommit = { commitId: number; elements: TracedRender[]; causes: { path: string }[] };

/** A page a function can be evaluated in, with one argument — Playwright's `Page`, Puppeteer's, or anything alike. */
export interface RenderEvaluator {
  evaluate<R>(fn: (since: number) => R, since: number): Promise<R>;
}

export interface RenderOptions {
  /** The most element renders the interaction may cause. Over it, `problems` says so and names the elements. */
  max?: number;
  /** How long to wait after the interaction for what it set off to render, in milliseconds — 300 by default. */
  settle?: number;
}

export interface ElementRenders {
  /** The element, by the id the space gave it. */
  id: string;
  renders: number;
  /**
   * What changed for it, over all its renders: `attributes`, `elementState`, a prop's name. Empty when it rendered
   * with nothing of its own changed — carried by its context or its parent, the render worth looking at first.
   */
  changed: string[];
}

export interface RenderReport {
  /** React commits the interaction caused. */
  commits: number;
  /** Element renders in all of them. */
  total: number;
  /** Every element that rendered, most renders first. */
  elements: ElementRenders[];
  /** The store paths written meanwhile — what set the renders off. */
  causes: string[];
  /** Empty unless `max` was given and exceeded: one sentence with the count and the elements that rendered most. */
  problems: string[];
}

const NO_TRACING =
  'The page has no render tracing (`window.plitziTracing`). It is on only under `debugMode`: render the space with ' +
  '`debugMode` (the harness: `renderSpace(page, space, { debugMode: true })`; a server: authorize it), then ask again.';

/** Evaluated in the page: the last commit, or `-1` where there is no tracing to read. */
const markIn = (): number => {
  const reader: TracingReader | undefined = window.plitziTracing;

  return reader ? reader.lastCommitId() : -1;
};

/** Evaluated in the page: the commits after `since`. */
const commitsIn = (since: number): TracedCommit[] => window.plitziTracing?.commitsSince(since) ?? [];

const pause = (milliseconds: number): Promise<void> => new Promise(resolve => setTimeout(resolve, milliseconds));

/** The commits as a report. Separate from the page so what a report SAYS is tested without a browser. */
export const summariseRenders = (commits: readonly TracedCommit[], max?: number): RenderReport => {
  const byElement = new Map<string, { renders: number; changed: Set<string> }>();
  const causes = new Set<string>();
  for (const commit of commits) {
    commit.causes.forEach(cause => causes.add(cause.path));
    for (const render of commit.elements) {
      // Only an element's own render: a profiled ancestor reports the commit too, without having rendered itself.
      if (!render.changedProps) {
        continue;
      }

      const entry = byElement.get(render.elementId) ?? { renders: 0, changed: new Set<string>() };
      entry.renders += 1;
      render.changedProps.forEach(change => entry.changed.add(change.key));
      byElement.set(render.elementId, entry);
    }
  }

  const elements = [...byElement.entries()]
    .map(([id, { renders, changed }]) => ({ id, renders, changed: [...changed] }))
    .sort((a, b) => b.renders - a.renders);
  const total = elements.reduce((sum, element) => sum + element.renders, 0);
  const worst = elements
    .slice(0, 8)
    .map(element => `${element.id} ×${element.renders} (${element.changed.join(', ') || 'nothing of its own'})`);

  return {
    commits: commits.length,
    total,
    elements,
    causes: [...causes],
    problems:
      max !== undefined && total > max
        ? [
            `${total} element renders, more than the ${max} allowed — most: ${worst.join('; ')}` +
              (elements.length > worst.length ? `; and ${elements.length - worst.length} more elements` : '')
          ]
        : []
  };
};

/**
 * What `act` rendered: every element, how often, what changed for it, and what was written to set it off.
 *
 * ```ts
 * const report = await inspectRenders(page, () => page.click('[data-plitzi-el="save"]'), { max: 10 });
 * expect(report.problems).toEqual([]);
 * ```
 *
 * The page must be rendering under `debugMode`, where the SDK profiles every element; anywhere else this throws, with
 * how to turn it on.
 */
export const inspectRenders = async (
  page: RenderEvaluator,
  act: () => Promise<unknown>,
  options: RenderOptions = {}
): Promise<RenderReport> => {
  const mark = await page.evaluate(markIn, 0);
  if (mark < 0) {
    throw new Error(NO_TRACING);
  }

  await act();
  await pause(options.settle ?? 300);

  return summariseRenders(await page.evaluate(commitsIn, mark), options.max);
};
