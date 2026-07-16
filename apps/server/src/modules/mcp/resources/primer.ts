import { envelope } from './envelope';
import { guideText } from '../helpers/guide';
import { buildDataSourceCatalog, buildInteractionCatalog } from '../tools/operations/schema/observed';
import { buildTypeRegistry } from '../tools/operations/schema/registry';
import {
  foldersToAI,
  pageSummariesToAI,
  schemaVariablesToAI,
  settingsToAI
} from '../tools/operations/schema/translator';
import { cssProperties } from '../tools/operations/style/cssCatalog';
import { definitionRefs, styleVariablesToAI } from '../tools/operations/style/translator';

import type { Space } from '../helpers';
import type { Env, ResourceEnvelope } from '../types';

/** The cold-start bundle: everything the guide says to read before the first write, in one round-trip.
 *  Summaries only — never full page/element trees (those are opened on demand), so it stays cheap even on a
 *  large space. Returns undefined when the URI is not the primer. */
export const readPrimerResource = (space: Space, env: Env, uri: string): ResourceEnvelope<unknown> | undefined => {
  if (uri !== `plitzi://primer/${env}`) {
    return undefined;
  }

  return envelope({
    guide: guideText,
    types: buildTypeRegistry(space.schema, space.catalog),
    cssProperties,
    pages: pageSummariesToAI(space.schema),
    folders: foldersToAI(space.schema),
    definitions: definitionRefs(space.style),
    styleVariables: styleVariablesToAI(space.style),
    schemaVariables: schemaVariablesToAI(space.schema, false),
    settings: settingsToAI(space.schema),
    interactions: buildInteractionCatalog(space.schema),
    dataSources: buildDataSourceCatalog(space.schema)
  });
};
