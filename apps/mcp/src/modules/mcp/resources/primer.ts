import { connectorSummaries } from './connectors';
import { envelope } from './envelope';
import {
  buildDataSourceCatalog,
  buildInteractionCatalog,
  buildTypeRegistry,
  cssProperties,
  cssShorthands
} from '../catalogs';
import {
  connectorsUri,
  dataSourcesUri,
  defsUri,
  foldersUri,
  interactionsUri,
  layoutsUri,
  pagesUri,
  primerUri,
  schemaVarsUri,
  settingsUri,
  styleVarsUri,
  typesUri
} from '../helpers';
import { guideQuickstart } from '../helpers/guide';
import {
  foldersToAI,
  layoutSummariesToAI,
  pageSummariesToAI,
  schemaVariablesToAI,
  settingsToAI
} from '../tools/operations/schema/translator';
import { definitionRefs, styleVariablesToAI } from '../tools/operations/style/translator';

import type { Space } from '../helpers';
import type { Env, ResourceEnvelope } from '../types';

/**
 * How much of the cold-start bundle the SPACE may fill, in characters of JSON.
 *
 * Only the space-derived sections are measured against it: the guide and the CSS vocabulary are constants that no
 * schema can grow, so budgeting them would only make a large space evict a fixed cost it did not cause.
 *
 * The number exists because every section here scales with something — pages with pages, definitions with style
 * classes, interactions with flows — and their sum does not converge. A space big enough made the one read that is
 * supposed to START the work the one an agent could not finish: too long to hold, and too long to grep out of the
 * tool-output file it was spilled to.
 */
const SPACE_BUDGET = 24_000;

interface ElidedSection {
  elided: true;
  /** What it would have cost inline, so an agent can tell a section it can afford from one it should query. */
  bytes: number;
  entries?: number;
  read: string;
}

/** A section, and the resource that serves the SAME projection whole when the bundle cannot afford it. */
interface Section {
  key: string;
  value: unknown;
  read: string;
}

const entryCount = (value: unknown): number | undefined => {
  if (Array.isArray(value)) {
    return value.length;
  }

  if (value !== null && typeof value === 'object') {
    return Object.keys(value).length;
  }

  return undefined;
};

/**
 * Keeps every section the budget can still afford and replaces the rest with a pointer to its own resource.
 *
 * Two properties worth being deliberate about. It SKIPS rather than stops: one oversized section costs the bundle
 * that section, not everything declared after it, so a space with a thousand style classes still gets its handful of
 * schema variables inline. And the order below is a priority, not an accident — what an agent cannot begin without
 * comes first, so what a large space loses is always the tail.
 */
const fit = (sections: Section[], budget: number) => {
  const bundle: Record<string, unknown> = {};
  const elided: string[] = [];
  let spent = 0;

  for (const { key, value, read } of sections) {
    const bytes = JSON.stringify(value).length;
    if (spent + bytes <= budget) {
      bundle[key] = value;
      spent += bytes;
      continue;
    }

    const stub: ElidedSection = { elided: true, bytes, entries: entryCount(value), read };
    bundle[key] = stub;
    elided.push(key);
  }

  return { bundle, elided };
};

/** The cold-start bundle: everything the guide says to read before the first write, in one round-trip.
 *
 *  Summaries only — never full page/element trees (those are opened on demand), so it stays cheap even on a
 *  large space. Carries the condensed `guideQuickstart` (not the full guideText, which the agent reads on demand at
 *  plitzi://guide) to keep the bundle small.
 *
 *  Past `SPACE_BUDGET` the summaries themselves stop being cheap, and the tail is replaced by pointers. Nothing is
 *  lost by that: the primer is an aggregate of reads an agent can make one at a time, and every section here names
 *  the resource that answers it in full — eliding one costs a round-trip, never information.
 *
 *  Returns undefined when the URI is not the primer. */
export const readPrimerResource = (space: Space, env: Env, uri: string): ResourceEnvelope<unknown> | undefined => {
  if (uri !== primerUri(env)) {
    return undefined;
  }

  const { bundle, elided } = fit(
    [
      // The map of the space: which pages exist, which shells they render inside, how they are filed. An agent
      // that has not read this cannot pick a target for anything it does next.
      { key: 'pages', value: pageSummariesToAI(space.schema), read: pagesUri(env) },
      // The shells those pages render inside. In the cold-start bundle because a space's header and sidebar are in
      // one, and an agent that has only seen the page list has not seen them at all.
      { key: 'layouts', value: layoutSummariesToAI(space.schema), read: layoutsUri(env) },
      { key: 'folders', value: foldersToAI(space.schema), read: foldersUri(env) },
      // The vocabulary every write is spelled in. Bounded by the number of element TYPES rather than by the size
      // of the schema, so it is near its ceiling already on a modest space and rarely the section that grows.
      { key: 'types', value: buildTypeRegistry(space.schema, space.catalog), read: typesUri },
      { key: 'schemaVariables', value: schemaVariablesToAI(space.schema, false), read: schemaVarsUri(env) },
      { key: 'styleVariables', value: styleVariablesToAI(space.style), read: styleVarsUri(env) },
      { key: 'settings', value: settingsToAI(space.schema), read: settingsUri(env) },
      { key: 'definitions', value: definitionRefs(space.style), read: defsUri(env) },
      // The three catalogs an agent consults once it has something specific to wire, rather than to orient itself.
      // Last on purpose: they are the sections a large space grows most, and the ones it least needs up front.
      { key: 'interactions', value: buildInteractionCatalog(space.schema), read: interactionsUri(env) },
      { key: 'dataSources', value: buildDataSourceCatalog(space.schema), read: dataSourcesUri(env) },
      // Summaries only (endpoint/operator NAMES, no manifests): enough to know a space reads a CMS and to wire an
      // element to it, while a manifest stays one read away at plitzi://connectors/{env}/{ref}.
      { key: 'connectors', value: connectorSummaries(space).connectors, read: connectorsUri(env) }
    ],
    SPACE_BUDGET
  );

  return envelope({
    guide: guideQuickstart,
    cssProperties,
    cssShorthands,
    ...bundle,
    ...(elided.length > 0
      ? {
          elided: {
            sections: elided,
            note: 'This space is too large to summarise in one read. Each section above carries the resource URI that serves it whole; read only the ones the task needs.'
          }
        }
      : {})
  });
};
