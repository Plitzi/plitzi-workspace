import { resolveLayoutChain } from '@plitzi/sdk-shared/schema';

import { followPath, isWrongPath, pathSteps, stoppedAt } from '../schema/dataPath';

import type { Element, Schema } from '@plitzi/sdk-shared';

/**
 * What a page's bindings read, held against what its providers answered: the half of "is this page whole" a box on
 * the screen cannot tell.
 *
 * A binding onto a path the answer does not have resolves to nothing, and nothing renders wrong in a way the eye or a
 * probe sees: a list draws no rows and keeps its box, a heading keeps its default words. So a page fed the wrong path
 * — `landing.data.plans` where the answer is `{ plans }` — was "36 elements on screen, nothing wrong". Read here, with
 * the provider's answer in hand, it is the binding, the path it reads and the keys that ARE there.
 *
 * Pure: the sources come from the page's dev tools (`window.__plitzi.sources()`), so a suite or `plitzi page check` reads
 * them however it reaches the page.
 */

export type DataIssueCode = 'binding-reads-nothing' | 'provider-failed';

export interface DataIssue {
  code: DataIssueCode;
  message: string;
  elementId: string;
}

export interface DataReport {
  issues: DataIssue[];
  /**
   * Every list of the page whose rows come from a provider: how many rows its source holds, `null` when it reads
   * nothing. The source, before the binding's transformers: a list that filters or slices them draws fewer — what is
   * drawn is the page's to count (`plitzi page check` does).
   */
  lists: Record<string, number | null>;
  /**
   * The providers that failed and the page shows it: an element on screen reads the failure — its `errorMessage`, its
   * `hasError` or its `status`. A page whose purpose is a refusal ("Nobody here goes by that name") handles it; it is
   * said, never an issue — a run's check failed such a page at every width, and its acceptance could only be said.
   */
  shownFailures: { provider: string; failure: string; by: string }[];
}

export interface DataIssuesOptions {
  /**
   * Elements with a visibility condition of their own that the page is not showing. Nothing inside one is mounted —
   * its bindings read nothing because nothing reads them — so only its own condition is held against the answer.
   */
  hidden?: ReadonlySet<string>;
}

const PROVIDER = 'apiContainer_';

/** What of a provider's answer says it failed: an element that reads one, shown, shows the failure. */
const FAILURE_FIELDS = new Set(['errorMessage', 'hasError', 'status']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Whether a provider has answered and what it answered can be read: not on its way, and not failed. */
const failureOf = (answer: Record<string, unknown>): string | undefined => {
  if (answer.hasError === true) {
    return typeof answer.errorMessage === 'string' && answer.errorMessage
      ? answer.errorMessage
      : 'it could not be reached';
  }

  return typeof answer.status === 'number' && answer.status >= 400 ? `it answered ${String(answer.status)}` : undefined;
};

/** The elements a page renders: its own, and those of every shell it is rendered inside. */
const pageElements = (schema: Schema, pageId: string): Element[] => {
  const page = Object.hasOwn(schema.flat, pageId) ? schema.flat[pageId] : undefined;
  const text = (value: unknown): string => (typeof value === 'string' ? value : '');
  const shells = page
    ? resolveLayoutChain(
        id => (Object.hasOwn(schema.flat, id) ? schema.flat[id] : undefined),
        text(page.attributes.layout),
        text(page.attributes.layoutContainer)
      ).map(link => link.layout)
    : [];
  const roots = new Set([pageId, ...shells]);

  return Object.values(schema.flat).filter(element => roots.has(element.definition.rootId));
};

const named = (element: Element): string => `${element.definition.type} "${element.id}"`;

/** Whether an element sits inside one of `hidden` — not whether it is one. */
const insideHidden = (schema: Schema, element: Element, hidden: ReadonlySet<string>): boolean => {
  const seen = new Set<string>();
  for (let id = element.definition.parentId; id !== undefined && !seen.has(id);) {
    if (hidden.has(id)) {
      return true;
    }

    seen.add(id);
    id = Object.hasOwn(schema.flat, id) ? schema.flat[id].definition.parentId : undefined;
  }

  return false;
};

/**
 * Every binding of the page onto a provider that has answered, read against that answer: a path that stops before its
 * last step — or a list's rows that are not there — is an issue that says where it stopped and what was there; a
 * provider on the page that failed is one too, whether or not anything shown reads it. A provider still on its way, or not on this page, is passed over — its answer is not
 * in yet, or not this page's to judge — and so is what is inside an element the page is not showing (`hidden`).
 */
export const dataIssues = (
  schema: Schema,
  pageId: string,
  sources: Record<string, unknown>,
  { hidden = new Set() }: DataIssuesOptions = {}
): DataReport => {
  const issues: DataIssue[] = [];
  const lists: Record<string, number | null> = {};
  const failed = new Set<string>();
  const shownBy = new Map<string, string>();
  for (const element of pageElements(schema, pageId)) {
    if (insideHidden(schema, element, hidden)) {
      continue;
    }

    const ownConditionOnly = hidden.has(element.id);
    for (const binding of Object.values(element.definition.bindings ?? {}).flat()) {
      const [source, field] = pathSteps(binding.source);
      if (
        binding.enabled !== false &&
        !ownConditionOnly &&
        source.startsWith(PROVIDER) &&
        FAILURE_FIELDS.has(field) &&
        !shownBy.has(source)
      ) {
        shownBy.set(source, element.id);
      }

      if (
        binding.enabled === false ||
        !binding.source.startsWith(PROVIDER) ||
        (ownConditionOnly && binding.to !== 'visibility')
      ) {
        continue;
      }

      const [provider, ...path] = pathSteps(binding.source);
      const answer = sources[provider];
      if (!isRecord(answer) || answer.isLoading === true) {
        continue;
      }

      const failure = failureOf(answer);
      if (failure) {
        if (!failed.has(provider)) {
          failed.add(provider);
          issues.push({
            code: 'provider-failed',
            message: `${provider} failed — ${failure} — so everything bound to it is empty`,
            elementId: provider.slice(PROVIDER.length)
          });
        }

        continue;
      }

      const reached = followPath(answer, path);
      const items = element.definition.type === 'list' && binding.to === 'items';
      if (items) {
        lists[element.id] = reached.found && Array.isArray(reached.value) ? reached.value.length : null;
      }

      if (!reached.found && isWrongPath(reached, path.length, items)) {
        issues.push({
          code: 'binding-reads-nothing',
          message: `${named(element)} reads ${binding.source} for its ${binding.to}, and the answer has no such path — ${stoppedAt(provider, reached)}`,
          elementId: element.id
        });
      }
    }
  }

  // One that failed with nothing shown reading it — what reads it hidden at this width — failed all the same: a run's
  // check passed a room at 1440 with its lists at 0 rows, and only the 390 pass said why.
  for (const [provider, answer] of Object.entries(sources)) {
    const failure =
      provider.startsWith(PROVIDER) && !failed.has(provider) && isRecord(answer) && answer.isLoading !== true
        ? failureOf(answer)
        : undefined;
    if (failure) {
      failed.add(provider);
      issues.push({
        code: 'provider-failed',
        message: `${provider} failed — ${failure} — so everything bound to it is empty`,
        elementId: provider.slice(PROVIDER.length)
      });
    }
  }

  const shownFailures: DataReport['shownFailures'] = [];
  const kept = issues.filter(issue => {
    const provider = `${PROVIDER}${issue.elementId}`;
    const by = issue.code === 'provider-failed' ? shownBy.get(provider) : undefined;
    const answer = sources[provider];
    const failure = by !== undefined && isRecord(answer) ? failureOf(answer) : undefined;
    if (by === undefined || failure === undefined) {
      return true;
    }

    shownFailures.push({ provider, failure, by });

    return false;
  });

  return { issues: kept, lists, shownFailures };
};
