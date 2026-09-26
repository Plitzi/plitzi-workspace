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
