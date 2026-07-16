import { envelope } from './envelope';
import {
  definitionRefs,
  definitionToAI,
  globalStyleToAI,
  globalStyleTypes,
  idStyleIds,
  idStyleToAI,
  styleVariablesToAI
} from '../tools/operations/style/translator';

import type { Space } from '../helpers';
import type { Env, ResourceEnvelope } from '../types';

/** Style-schema reads: definitions, global (per-type) styles and design-token variables by category. Returns
 *  undefined when the URI belongs to another domain, null when the shape is ours but the ref does not resolve. */
export const readStyleResource = (
  space: Space,
  env: Env,
  uri: string
): ResourceEnvelope<unknown> | null | undefined => {
  if (uri === `plitzi://definitions/${env}`) {
    return envelope(definitionRefs(space.style));
  }

  if (uri.startsWith(`plitzi://definitions/${env}/`)) {
    const ref = uri.slice(`plitzi://definitions/${env}/`.length);
    const def = definitionToAI(space.style, ref);

    return def ? envelope(def) : null;
  }

  if (uri === `plitzi://global-styles/${env}`) {
    return envelope(globalStyleTypes(space.style));
  }

  if (uri.startsWith(`plitzi://global-styles/${env}/`)) {
    const componentType = uri.slice(`plitzi://global-styles/${env}/`.length);
    const global = globalStyleToAI(space.style, componentType);

    return global ? envelope(global) : null;
  }

  if (uri === `plitzi://id-styles/${env}`) {
    return envelope(idStyleIds(space.style));
  }

  if (uri.startsWith(`plitzi://id-styles/${env}/`)) {
    const targetId = uri.slice(`plitzi://id-styles/${env}/`.length);
    const idStyle = idStyleToAI(space.style, targetId);

    return idStyle ? envelope(idStyle) : null;
  }

  if (uri === `plitzi://style-variables/${env}`) {
    return envelope(styleVariablesToAI(space.style));
  }

  if (uri.startsWith(`plitzi://style-variables/${env}/`)) {
    const category = uri.slice(`plitzi://style-variables/${env}/`.length);
    const byCategory = styleVariablesToAI(space.style);

    return envelope(Object.hasOwn(byCategory, category) ? byCategory[category] : []);
  }

  return undefined;
};
