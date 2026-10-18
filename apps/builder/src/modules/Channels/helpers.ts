import { channelProblems } from '@plitzi/sdk-shared/realtime';

import type { ChannelDeclaration, ChannelDeclarations } from '@plitzi/sdk-shared';

export type ChannelAccessMode = ChannelDeclaration['access']['mode'];

/**
 * One channel as its fields hold it while it is edited: the permissions and the limits as the text typed, so a comma or
 * a digit being typed is never normalised away under the cursor.
 */
export type ChannelDraft = {
  mode: ChannelAccessMode;
  permissions: string;
  publish: 'clients' | 'server';
  presence: boolean;
  grant: boolean;
  retain: boolean;
  maxMessageBytes: string;
  messagesPerSecond: string;
};

/** What a channel added in the builder starts as: anybody joins, and pages speak directly. */
export const NEW_CHANNEL: ChannelDraft = {
  mode: 'public',
  permissions: '',
  publish: 'clients',
  presence: false,
  grant: false,
  retain: false,
  maxMessageBytes: '',
  messagesPerSecond: ''
};

const namesOf = (text: string): string[] =>
  text
    .split(',')
    .map(name => name.trim())
    .filter(Boolean);

export const draftOf = (declaration: ChannelDeclaration): ChannelDraft => ({
  mode: declaration.access.mode,
  permissions: declaration.access.mode === 'role' ? declaration.access.permissions.join(', ') : '',
  publish: declaration.publish ?? 'clients',
  presence: declaration.presence ?? false,
  grant: declaration.grant ?? false,
  retain: declaration.retain ?? false,
  maxMessageBytes: declaration.maxMessageBytes === undefined ? '' : String(declaration.maxMessageBytes),
  messagesPerSecond: declaration.messagesPerSecond === undefined ? '' : String(declaration.messagesPerSecond)
});

const accessOf = (draft: ChannelDraft): ChannelDeclaration['access'] =>
  draft.mode === 'role' ? { mode: 'role', permissions: namesOf(draft.permissions) } : { mode: draft.mode };

/** A limit left empty is the server's default, so it is left out — and one typed is written as the number it says. */
const limitOf = (text: string): number | undefined => (text.trim() === '' ? undefined : Number(text));

/** The channel a draft declares: only what differs from the defaults is written, as authoring writes it. */
export const declarationOf = (draft: ChannelDraft): ChannelDeclaration => {
  const maxMessageBytes = limitOf(draft.maxMessageBytes);
  const messagesPerSecond = limitOf(draft.messagesPerSecond);

  return {
    access: accessOf(draft),
    ...(draft.publish === 'server' ? { publish: 'server' as const } : {}),
    ...(draft.presence ? { presence: true } : {}),
    ...(draft.grant ? { grant: true } : {}),
    ...(draft.retain ? { retain: true } : {}),
    ...(maxMessageBytes === undefined ? {} : { maxMessageBytes }),
    ...(messagesPerSecond === undefined ? {} : { messagesPerSecond })
  };
};

export type CheckedChannels =
  { ok: true; channels: ChannelDeclarations } | { ok: false; problems: Record<string, string[]> };

/**
 * The space's channels as the drafts declare them — or, when one would be refused, every problem of every channel, by
 * its pattern: the server's and authoring's own check (`channelProblems`), so the builder never saves one they refuse.
 */
export const checkChannels = (drafts: Record<string, ChannelDraft>): CheckedChannels => {
  const channels: ChannelDeclarations = {};
  const problems: Record<string, string[]> = {};
  for (const [pattern, draft] of Object.entries(drafts)) {
    const declaration = declarationOf(draft);
    const found = [
      ...channelProblems(pattern, declaration),
      ...(draft.mode === 'role' && namesOf(draft.permissions).length === 0
        ? ['visitors with permissions: name at least one, like `boardEdit`']
        : [])
    ];
    if (found.length > 0) {
      problems[pattern] = found;
    }

    channels[pattern] = declaration;
  }

  return Object.keys(problems).length > 0 ? { ok: false, problems } : { ok: true, channels };
};
