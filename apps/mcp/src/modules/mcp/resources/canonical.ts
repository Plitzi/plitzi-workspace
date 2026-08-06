import { afterPrefix, aliasedRoots, itemTemplates, primerUri } from '../helpers';

import type { Env } from '../types';

// Style resources live at their own top-level roots (plitzi://definitions, plitzi://style-variables,
// plitzi://schema-variables) but agents reach for them by analogy under plitzi://schema/{env}/… . Accept that
// alias shape and fold it back to the canonical root, so both forms resolve (RFC 0005 I3).
export const canonicalUri = (env: Env, uri: string): string => {
  const rest = afterPrefix(uri, `plitzi://schema/${env}/`);
  if (rest === undefined) {
    return uri;
  }

  for (const root of aliasedRoots) {
    if (rest === root) {
      return `plitzi://${root}/${env}`;
    }

    if (rest.startsWith(`${root}/`)) {
      return `plitzi://${root}/${env}/${rest.slice(root.length + 1)}`;
    }
  }

  return uri;
};

/** Teachable message for a URI that read as null. Distinguishes a well-formed URI whose ref does not resolve (the
 *  resource may be stale/deleted) from a URI whose shape matches no template at all (malformed — echo the valid
 *  templates so the agent stops hand-building URIs). See RFC 0004 I2. */
export const resourceErrorMessage = (env: Env, uri: string): string => {
  const canonical = canonicalUri(env, uri);
  const knownShape = itemTemplates(env).some(tpl => canonical.startsWith(tpl.slice(0, tpl.lastIndexOf('/') + 1)));
  if (knownShape) {
    return JSON.stringify({
      error: 'NOT_FOUND',
      message: `No resource at '${uri}'. Its shape is valid but the ref does not resolve.`,
      hint: 'It may have been deleted or your URI is stale. Re-list the parent resource (pages/definitions) to refresh.'
    });
  }

  return JSON.stringify({
    error: 'MALFORMED_URI',
    message: `'${uri}' matches no resource template.`,
    hint: 'Do not hand-build element URIs — take the ready-made uri from plitzi_search or a write response.',
    validTemplates: [primerUri(env), ...itemTemplates(env)]
  });
};
