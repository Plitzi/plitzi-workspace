import type { ChannelDeclaration, ChannelDeclarations } from '../types/RealtimeTypes';

/** A topic, as a page may name one: letters, digits and `:_-.`, at most 128 characters. */
const TOPIC = /^[A-Za-z0-9:_.-]{1,128}$/;

/** What a `{name}` in a pattern stands for: one segment of a topic, never a `:`. */
const PARAMETER = '[A-Za-z0-9_.-]{1,64}';

export const isValidTopic = (topic: string): boolean => TOPIC.test(topic);

/** A pattern (`board:{id}`) as the expression every topic of it matches. */
const patternExpression = (pattern: string): RegExp =>
  new RegExp(
    `^${pattern
      .split(/(\{[A-Za-z0-9_]+\})/)
      .map(part => (/^\{[A-Za-z0-9_]+\}$/.test(part) ? PARAMETER : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      .join('')}$`
  );

export type ChannelMatch = { pattern: string; declaration: ChannelDeclaration };

/**
 * The declaration a topic falls under — the first pattern that matches it — or `undefined` when none does.
 *
 * One function for the server that authorises a subscription, the linter that checks a page's topic and the client
 * that opens it, so the three cannot disagree about what `board:{id}` covers.
 */
export const matchChannel = (
  topic: string,
  declarations: ChannelDeclarations | undefined
): ChannelMatch | undefined => {
  if (!declarations || !isValidTopic(topic)) {
    return undefined;
  }

  const pattern = Object.keys(declarations).find(candidate => patternExpression(candidate).test(topic));

  return pattern === undefined ? undefined : { pattern, declaration: declarations[pattern] };
};

/** A pattern as a space declares one: a topic's characters, with `{name}` for each part a page fills in. */
const PATTERN = /^(?=.)[A-Za-z0-9:_.-]*(\{[A-Za-z0-9_]+\}[A-Za-z0-9:_.-]*)*$/;

const ACCESS_MODES = new Set(['public', 'session', 'role']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * What is wrong with one channel of a space, each as a sentence that says how to write it — empty when nothing is.
 *
 * One check for every writer: authoring refuses the first, `lintSpace` reports them all for what the builder and an
 * agent write, and the server never has to guess what a malformed declaration meant. Read as `unknown`, because a
 * space from JSON or from an agent has no type to hold it.
 */
export const channelProblems = (pattern: string, declaration: unknown): string[] => {
  const problems: string[] = [];
  if (!PATTERN.test(pattern)) {
    problems.push('a pattern is letters, digits and `:_.-`, with `{name}` for the part a page fills in — `board:{id}`');
  }

  if (!isRecord(declaration)) {
    return [...problems, 'a channel is an object: `{ access: { mode: "public" } }`'];
  }

  const { access, publish, presence, maxMessageBytes, messagesPerSecond } = declaration;
  const mode = isRecord(access) ? access.mode : undefined;
  if (typeof mode !== 'string' || !ACCESS_MODES.has(mode)) {
    problems.push('`access` is { mode: "public" }, { mode: "session" } or { mode: "role", permissions: […] }');
  } else if (
    mode === 'role' &&
    !(
      isRecord(access) &&
      Array.isArray(access.permissions) &&
      access.permissions.every(entry => typeof entry === 'string')
    )
  ) {
    problems.push('`access: { mode: "role" }` names the permissions it needs: `permissions: ["boardEdit"]`');
  }

  if (publish !== undefined && publish !== 'clients' && publish !== 'server') {
    problems.push('`publish` is "clients" (pages send) or "server" (only a flow\'s realtime.publish)');
  }

  if (presence !== undefined && typeof presence !== 'boolean') {
    problems.push('`presence` is true or false');
  }

  for (const [name, value] of [
    ['maxMessageBytes', maxMessageBytes],
    ['messagesPerSecond', messagesPerSecond]
  ] as const) {
    if (value !== undefined && (typeof value !== 'number' || !Number.isInteger(value) || value <= 0)) {
      problems.push(`\`${name}\` is a whole number above zero`);
    }
  }

  return problems;
};

/** Channel limits, with the defaults a declaration leaves out. */
export const channelLimits = (
  declaration: ChannelDeclaration
): { maxMessageBytes: number; messagesPerSecond: number } => ({
  maxMessageBytes: declaration.maxMessageBytes ?? 4096,
  messagesPerSecond: declaration.messagesPerSecond ?? 30
});

/** The types a channel keeps for itself: a member's state, a member gone, a member arrived. */
export const PRESENCE_TYPE = '$presence';
export const LEAVE_TYPE = '$leave';
/** A member arrived: the others answer with their `$presence`, so the newcomer sees everyone at once. */
export const JOIN_TYPE = '$join';
