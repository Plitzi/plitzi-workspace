import { z } from 'zod';

import { NOTIFICATIONS_FIELDS, splitNotificationsCss, withNotificationsCss } from '@plitzi/sdk-authoring';
import { channelProblems } from '@plitzi/sdk-shared/realtime';
import { spaceIdentity, spaceIdentityProblems, withheldPageOf } from '@plitzi/sdk-shared/schema';

import { empty, fail } from '../../../../helpers';
import { settingsUri } from '../write';

import type { Space } from '../../../../helpers';
import type { OpResult } from '../../../../helpers';
import type { Env } from '../../../../types';
import type { ChannelDeclaration, Schema } from '@plitzi/sdk-shared';

// Open on purpose: `basic` covers any HTTP+JSON backend by configuration, and anything else is the name of a
// provider someone registered in the page. An enum here would refuse valid names it cannot know.
const userProvider = z.string();
const storage = z.enum(['localStorage', 'sessionStorage', '']);

// The shape only: what each field MEANS — a role that names no permission, a pattern the server cannot read, `retain`
// without `publish: "server"` — is `channelProblems`'s, the same check authoring and the linter make. Every field a
// channel takes is here: one an agent cannot write is one it meets in a space and cannot explain.
const channel = z.object({
  access: z.object({ mode: z.enum(['public', 'session', 'role']), permissions: z.array(z.string()).optional() }),
  publish: z.enum(['clients', 'server']).optional(),
  presence: z.boolean().optional(),
  grant: z.boolean().optional().describe('A page needs a grant from realtime.grant to open a topic'),
  retain: z.boolean().optional().describe('The server keeps the latest message of each type for pages that join'),
  maxMessageBytes: z.number().int().positive().optional(),
  messagesPerSecond: z.number().int().positive().optional()
});

// A record, not an object of its fields: the op union is in four tools' listings, and the fields are named once in
// the description instead. A field authoring's `notifications` does not take is refused by its own check, by name.
const notifications = z.record(z.string(), z.string().nullable());

// Every field optional and merged onto the existing settings — a patch touches only the keys it sends. `customCss`
// is arbitrary global CSS injected for the whole space (NOT the structured, per-element style schema): reach for it
// only for genuinely global rules (keyframes, @font-face, resets), never to style one element.
export const patchSettingsOp = z
  .object({
    type: z.literal('patchSettings'),
    customCss: z.string().optional().describe('Raw global CSS for the whole space (keyframes, @font-face, resets)'),
    notifications: notifications
      .optional()
      .describe(`The toasts' look: ${NOTIFICATIONS_FIELDS.join(', ')} — CSS values; null removes one`),
    keepState: z.boolean().optional().describe('Keep runtime state (setState keys) across reloads'),
    stateStorage: z.enum(['localStorage', 'sessionStorage']).optional(),
    transientState: z.array(z.string()).optional().describe('Top-level state keys never kept'),
    keptState: z.array(z.string()).optional().describe('The only top-level state keys kept (not with transientState)'),
    paintedState: z.array(z.string()).optional().describe('Kept keys the first paint shows'),
    userProvider: userProvider
      .optional()
      .describe('Auth provider: "basic" for an HTTP+JSON backend, a registered name, or "" to disable auth'),
    tokenStorage: storage.optional(),
    loginUrl: z.string().optional(),
    userUrl: z.string().optional(),
    refreshUrl: z.string().optional(),
    logoutUrl: z.string().optional(),
    detailsPath: z.string().optional(),
    tokenPath: z.string().optional(),
    refreshTokenPath: z.string().optional(),
    expirationTimePath: z.string().optional(),
    refreshExpirationTimePath: z.string().optional(),
    sessionHintCookie: z
      .string()
      .optional()
      .describe(
        'Readable cookie holding only session expiries, so a page can tell nobody is signed in with no request'
      ),
    sessionExchangeUrl: z
      .string()
      .optional()
      .describe('Where to hand a browser-obtained credential so the server issues its own session (client-side IdPs)'),
    sessionGate: z
      .enum(['optimistic', 'strict'])
      .optional()
      .describe('Render from the stored session and confirm behind it (default), or wait for the confirmation'),
    sessionRevalidateSeconds: z.number().optional(),
    siteName: z.string().optional().describe('Shown beside each title in a link card'),
    language: z.string().optional().describe('"en", "es-MX"'),
    favicon: z.string().optional().describe('"/favicon.svg" or https://…'),
    shareImage: z.string().optional().describe('A link card\'s picture when its page has none: "/og.png"'),
    themeColor: z
      .union([z.string(), z.object({ light: z.string().optional(), dark: z.string().optional() })])
      .optional(),
    robotsTxt: z.string().optional(),
    blockAiCrawlers: z.boolean().optional().describe('robots.txt bars AI-training crawlers'),
    viewTransitions: z.boolean().optional(),
    withheldPage: z
      .string()
      .optional()
      .describe('Page id drawn for a withheld page (its 401/403); "" = Plitzi\'s words'),
    channels: z
      .record(z.string(), channel.nullable())
      .optional()
      .describe('Realtime channels by topic pattern (`board:{id}`); null removes one. See the guide')
  })
  .describe(
    "Merge space-level settings — global CSS, notifications, kept state, auth, realtime channels, the site's identity " +
      'and robots.txt. Only the fields ' +
      'sent change. ' +
      'customCss is for site-wide CSS, never to style one element (attach a definition for that).'
  );

export type PatchSettings = z.infer<typeof patchSettingsOp>;

/** The space's channels with the patch merged in, pattern by pattern — `null` takes one out. */
const mergeChannels = (
  current: Schema['settings']['channels'],
  patch: NonNullable<PatchSettings['channels']>
): NonNullable<Schema['settings']['channels']> => {
  const merged = { ...current, ...patch };

  return Object.fromEntries(
    Object.entries(merged).filter((entry): entry is [string, ChannelDeclaration] => entry[1] !== null)
  );
};

/**
 * The space's `customCss` with the patch's own CSS and notifications in it. Both live in that one string — the
 * notifications as the rule authoring writes for them — so each is read out of it, changed apart, and written back
 * together: a new `customCss` keeps the notifications, and new notifications keep the space's CSS.
 */
const patchCustomCss = (
  current: string,
  customCss: string | undefined,
  patch: PatchSettings['notifications']
): string => {
  const was = splitNotificationsCss(current);
  // A `customCss` read before this field existed may carry the rule itself: what it says is read out of it as well.
  const sent = customCss === undefined ? undefined : splitNotificationsCss(customCss);
  const merged = { ...was.notifications, ...sent?.notifications, ...patch };

  return withNotificationsCss(
    sent?.customCss ?? was.customCss,
    Object.fromEntries(
      Object.entries(merged).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    )
  );
};

export const patchSettings = (space: Space, env: Env, op: PatchSettings): OpResult => {
  const { type, channels, customCss, notifications: notificationsPatch, ...patch } = op;
  // The same check authoring and the linter make: a pattern the server could not read opens nothing, silently.
  for (const [pattern, declaration] of Object.entries(channels ?? {})) {
    const [problem] = declaration === null ? [] : channelProblems(pattern, declaration);
    if (problem) {
      return fail(
        `channels["${pattern}"]`,
        `Channel "${pattern}": ${problem}.`,
        'Fix the pattern or declaration and send it again'
      );
    }
  }

  // What a head reads of the site, held as authoring and the builder hold it: a bare file name is a tab with no icon.
  const [identityProblem] = spaceIdentityProblems(spaceIdentity({ ...space.schema.settings, ...patch }));
  if (identityProblem) {
    return fail('settings', identityProblem, 'Fix the field and send it again');
  }

  // zod omits absent optional keys, so Object.entries yields only the fields the agent actually sent.
  const next = { ...space.schema.settings } as Schema['settings'] & Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    next[key] = value;
  }

  if (channels) {
    next.channels = mergeChannels(space.schema.settings.channels, channels);
  }

  if (customCss !== undefined || notificationsPatch) {
    const current = space.schema.settings.customCss;
    try {
      next.customCss = patchCustomCss(typeof current === 'string' ? current : '', customCss, notificationsPatch);
    } catch (error) {
      // authoring's own check: a value that is not one CSS value would end the rule early.
      return fail(
        'notifications',
        error instanceof Error ? error.message : String(error),
        'Write one CSS value per field — a colour, a length or a token like var(--card)'
      );
    }
  }

  if (next.withheldPage === '') {
    delete next.withheldPage;
  } else if (next.withheldPage !== undefined && withheldPageOf({ ...space.schema, settings: next }) === undefined) {
    return fail(
      'withheldPage',
      `withheldPage "${next.withheldPage}" is no page of the space, or one with an access of its own — withheld from the visitor it is drawn for.`,
      'Name the id of a page every visitor may see, or "" for the platform\'s words'
    );
  }

  space.schema.settings = next;

  return { ...empty(), updated: 1, staleResources: [settingsUri(env)] };
};
