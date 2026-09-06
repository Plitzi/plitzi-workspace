import { z } from 'zod';

import { empty } from '../../../../helpers';
import { fontsUri, fontUri } from '../../../../helpers/uris';

import type { OpResult, Space } from '../../../../helpers';
import type { Env } from '../../../../types';

export const deleteFontOp = z
  .object({
    type: z.literal('deleteFont'),
    family: z.string()
  })
  .describe('Stop loading a family. Rules still naming it are left alone and render in their fallback.');

export type DeleteFont = z.infer<typeof deleteFontOp>;

export const deleteFont = (space: Space, env: Env, op: DeleteFont): OpResult => {
  const fonts = space.style.fonts ?? [];
  const index = fonts.findIndex(item => item.family === op.family);
  if (index === -1) {
    return empty();
  }

  fonts.splice(index, 1);

  return { ...empty(), deleted: 1, staleResources: [fontUri(env, op.family), fontsUri(env)] };
};
