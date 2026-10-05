import { afterPrefix, dataFileUri, dataUri } from '../helpers';
import { envelope } from './envelope';

import type { Space } from '../helpers';
import type { Env, ResourceEnvelope } from '../types';

/**
 * The space's own data: JSON its server providers read (`query: '/data/<file>'`, `runtime: 'server'`), never served.
 * The listing says which files there are, so an agent reads the one it needs; a file reads whole — parsed, so its
 * shape is what a binding onto it reads.
 */
export const readDataResource = (space: Space, env: Env, uri: string): ResourceEnvelope<unknown> | null | undefined => {
  if (uri === dataUri(env)) {
    if (!space.data) {
      return envelope({ available: false, reason: 'This deployment keeps no space data' });
    }

    const { files, version } = space.data;

    return envelope({
      available: true,
      version,
      files: Object.entries(files).map(([path, content]) => ({ path, query: `/data/${path}`, bytes: content.length }))
    });
  }

  const path = afterPrefix(uri, dataFileUri(env, ''));
  if (path === undefined) {
    return undefined;
  }

  const content = space.data && Object.hasOwn(space.data.files, path) ? space.data.files[path] : undefined;
  if (content === undefined) {
    return null;
  }

  try {
    return envelope({ path, query: `/data/${path}`, content: JSON.parse(content) as unknown });
  } catch {
    // Saved before it was checked, or written by hand: said as it is, for the agent to rewrite it as JSON.
    return envelope({ path, query: `/data/${path}`, text: content, problem: 'It is not JSON' });
  }
};
