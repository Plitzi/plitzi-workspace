import { afterPrefix, functionFileUri, functionsUri } from '../helpers';
import { envelope } from './envelope';

import type { Space } from '../helpers';
import type { Env, ResourceEnvelope } from '../types';

/**
 * The space's own functions: the listing says what they declare and which files they are, so an agent knows where to
 * look before it reads one; a file reads whole. Server-side code — never a browser payload — and it holds no secret: a
 * request NAMES a credential, the platform writes it in.
 */
export const readFunctionsResource = (
  space: Space,
  env: Env,
  uri: string
): ResourceEnvelope<unknown> | null | undefined => {
  if (uri === functionsUri(env)) {
    if (!space.functions) {
      return envelope({ available: false, reason: 'This deployment runs no space functions' });
    }

    const { files, version, manifest } = space.functions;

    return envelope({
      available: true,
      version,
      files: Object.entries(files).map(([path, content]) => ({ path, bytes: content.length })),
      declares: manifest
    });
  }

  const path = afterPrefix(uri, functionFileUri(env, ''));
  if (path === undefined) {
    return undefined;
  }

  const content =
    space.functions && Object.hasOwn(space.functions.files, path) ? space.functions.files[path] : undefined;

  return content === undefined ? null : envelope({ path, content });
};
