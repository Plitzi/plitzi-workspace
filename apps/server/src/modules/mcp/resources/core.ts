import { envelope } from './envelope';
import { buildTypeRegistry, cssProperties } from '../catalogs';
import { guideText } from '../helpers/guide';

import type { Space } from '../helpers';
import type { ResourceEnvelope } from '../types';

/** Space-independent singletons: the usage guide, the observed type registry and the CSS property catalog.
 *  Returns undefined when the URI is not one of these, so the router falls through to the next resolver. */
export const readCoreResource = (space: Space, uri: string): ResourceEnvelope<unknown> | undefined => {
  if (uri === 'plitzi://guide') {
    return envelope(guideText);
  }

  if (uri === 'plitzi://types') {
    return envelope(buildTypeRegistry(space.schema, space.catalog));
  }

  if (uri === 'plitzi://css-properties') {
    return envelope(cssProperties);
  }

  return undefined;
};
