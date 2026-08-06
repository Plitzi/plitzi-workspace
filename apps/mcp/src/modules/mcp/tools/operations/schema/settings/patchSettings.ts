import { z } from 'zod';

import { empty } from '../../../../helpers';
import { settingsUri } from '../write';

import type { Space } from '../../../../helpers';
import type { OpResult } from '../../../../helpers';
import type { Env } from '../../../../types';
import type { Schema } from '@plitzi/sdk-shared';

const userProvider = z.enum(['auth0', 'basic', 'custom', '']);
const storage = z.enum(['localStorage', 'sessionStorage', '']);

// Every field optional and merged onto the existing settings — a patch touches only the keys it sends. `customCss`
// is arbitrary global CSS injected for the whole space (NOT the structured, per-element style schema): reach for it
// only for genuinely global rules (keyframes, @font-face, resets), never to style one element.
export const patchSettingsOp = z
  .object({
    type: z.literal('patchSettings'),
    customCss: z.string().optional().describe('Raw global CSS for the whole space (keyframes, @font-face, resets)'),
    keepState: z.boolean().optional().describe('Persist element state across reloads'),
    stateStorage: z.enum(['localStorage', 'sessionStorage']).optional(),
    userProvider: userProvider.optional().describe('Auth provider; "" disables authentication'),
    auth0Domain: z.string().optional(),
    auth0ClientId: z.string().optional(),
    tokenStorage: storage.optional(),
    loginUrl: z.string().optional(),
    userUrl: z.string().optional(),
    refreshUrl: z.string().optional(),
    logoutUrl: z.string().optional(),
    detailsPath: z.string().optional(),
    tokenPath: z.string().optional(),
    expirationTimePath: z.string().optional()
  })
  .describe(
    'Merge space-level settings: the global CSS (customCss) and the state/auth (user-provider) configuration. ' +
      'Only the fields you pass change; the rest are preserved. Use customCss for site-wide CSS, never to style ' +
      'one element (attach a definition for that).'
  );

export type PatchSettings = z.infer<typeof patchSettingsOp>;

export const patchSettings = (space: Space, env: Env, op: PatchSettings): OpResult => {
  const { type, ...patch } = op;
  void type;
  // zod omits absent optional keys, so Object.entries yields only the fields the agent actually sent.
  const next = { ...space.schema.settings } as Schema['settings'] & Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    next[key] = value;
  }

  space.schema.settings = next;

  return { ...empty(), updated: 1, staleResources: [settingsUri(env)] };
};
