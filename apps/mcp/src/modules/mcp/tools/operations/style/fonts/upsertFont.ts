import { z } from 'zod';

import { FontValidationError, parseSpaceFont } from '@plitzi/sdk-shared/style';

import { empty, fail } from '../../../../helpers';
import { fontsUri, fontUri } from '../../../../helpers/uris';

import type { OpResult, Space } from '../../../../helpers';
import type { Env } from '../../../../types';

/**
 * What an AGENT can say about a font, which is less than a manifest entry can hold.
 *
 * `display`, `preload`, `subsets` and per-face unicode ranges are left out on purpose: every field here is carried
 * in four tool schemas, in the model's context, on every request — and those four are tuning a person makes in the
 * Fonts panel, never something an agent has a reason to decide. The manifest still holds them; this vocabulary
 * simply does not offer them.
 */
const fontFile = z.object({
  weight: z.number().int(),
  style: z.enum(['normal', 'italic']),
  format: z.enum(['woff2', 'woff']),
  url: z.string().optional().describe('remote: https URL of the file'),
  path: z.string().optional().describe('hosted: path in the font store')
});

export const upsertFontOp = z
  .object({
    type: z.literal('upsertFont'),
    family: z.string().describe('What font-family names. Unique per space.'),
    source: z.enum(['system', 'google', 'remote', 'hosted']).describe('system loads nothing; remote needs a URL'),
    fallback: z.string().describe('Read until the face arrives, e.g. "system-ui, sans-serif"'),
    weights: z.array(z.number().int()).optional().describe('Each one is a file. Default [400].'),
    styles: z.array(z.enum(['normal', 'italic'])).optional(),
    stylesheet: z.string().optional().describe('remote: https URL declaring the @font-face rules'),
    files: z.array(fontFile).optional()
  })
  .describe('Declare a family the space loads. A font-family naming one that is not declared renders in a fallback.');

export type UpsertFont = z.infer<typeof upsertFontOp>;

export const upsertFont = (space: Space, env: Env, op: UpsertFont): OpResult => {
  let font;
  try {
    // `swap` because a page whose text is invisible until a font arrives is worse than one that reflows, and the
    // agent is given no way to choose otherwise.
    // `type` is the op discriminator and not a field of the font; `display` because a page whose text is invisible
    // until a face arrives is worse than one that reflows, and the agent is given no way to choose otherwise.
    font = parseSpaceFont({ ...op, type: undefined, display: 'swap' });
  } catch (err) {
    if (!(err instanceof FontValidationError)) {
      throw err;
    }

    return fail('font', err.message, 'Fix the field the message names and send the operation again.');
  }

  const fonts = (space.style.fonts ??= []);
  const index = fonts.findIndex(item => item.family === font.family);
  if (index === -1) {
    fonts.push(font);

    return { ...empty(), created: 1, staleResources: [fontUri(env, font.family), fontsUri(env)] };
  }

  fonts[index] = font;

  return { ...empty(), updated: 1, staleResources: [fontUri(env, font.family), fontsUri(env)] };
};
