import { envelope } from './envelope';
import {
  afterPrefix,
  defUri,
  defsUri,
  globalUri,
  globalsUri,
  idUri,
  idsUri,
  styleVarUri,
  styleVarsUri
} from '../helpers';
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
  if (uri === defsUri(env)) {
    return envelope(definitionRefs(space.style));
  }

  const defRef = afterPrefix(uri, defUri(env, ''));
  if (defRef !== undefined) {
    const def = definitionToAI(space.style, defRef);

    return def ? envelope(def) : null;
  }

  if (uri === globalsUri(env)) {
    return envelope(globalStyleTypes(space.style));
  }

  const componentType = afterPrefix(uri, globalUri(env, ''));
  if (componentType !== undefined) {
    const global = globalStyleToAI(space.style, componentType);

    return global ? envelope(global) : null;
  }

  if (uri === idsUri(env)) {
    return envelope(idStyleIds(space.style));
  }

  const targetId = afterPrefix(uri, idUri(env, ''));
  if (targetId !== undefined) {
    const idStyle = idStyleToAI(space.style, targetId);

    return idStyle ? envelope(idStyle) : null;
  }

  if (uri === styleVarsUri(env)) {
    return envelope(styleVariablesToAI(space.style));
  }

  const category = afterPrefix(uri, styleVarUri(env, ''));
  if (category !== undefined) {
    const byCategory = styleVariablesToAI(space.style);

    return envelope(Object.hasOwn(byCategory, category) ? byCategory[category] : []);
  }

  return undefined;
};
