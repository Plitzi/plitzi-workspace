import { EXPLAIN_KINDS, explain, explainKindOf, explainList, explanationText } from '@plitzi/sdk-authoring';

import type { ExplainKind, Explanation } from '@plitzi/sdk-authoring';

/** `plitzi://explain/{name}`: what a name means when authoring, or every name of a kind (`plitzi://explain/steps`). */
export const EXPLAIN_URI_TEMPLATE = 'plitzi://explain/{name}';

const PREFIX = 'plitzi://explain/';

/**
 * The read behind the resource: a kind's plural lists it; any other name is explained, each meaning it has, as data
 * and as the text the CLI prints. A name that is nothing says what there is to ask about instead.
 */
export type ExplainRead =
  | { list: ExplainKind; names: { name: string; summary: string }[] }
  | { name: string; explanations: Explanation[]; text: string };

export const explainResource = (uri: string): ExplainRead => {
  const name = decodeURIComponent(uri.startsWith(PREFIX) ? uri.slice(PREFIX.length) : uri);
  const kind = explainKindOf(name);
  if (kind) {
    return { list: kind, names: explainList(kind) };
  }

  const explanations = explain(name);
  if (explanations.length === 0) {
    throw new Error(
      `"${name}" is no element, step, trigger, code or transformer. List what there is: ${Object.values(EXPLAIN_KINDS)
        .map(plural => `${PREFIX}${plural}`)
        .join(', ')}.`
    );
  }

  return { name, explanations, text: explanations.map(explanationText).join('\n\n') };
};
