/**
 * Who a line is for. On a board several people talk to each other, and an agent that took every line for itself
 * answered conversations that were not its own. So a line is for an agent when it names it with an @ — `@Claude` — and
 * everything else is the team talking among themselves: heard, as context, and left alone. A person named the same way
 * — `@Ana`, or everyone with `@all` — hears a ping, and is told who wrote to them.
 *
 * Read by the agent (what it acts on) and by the pages (whom to ping).
 */

/** What addresses every agent on the board at once. */
export const ANY_AGENT = ['agent', 'agents'] as const;

/** What addresses every person on the board at once. */
export const ANYONE = ['all', 'everyone'] as const;

/**
 * The ways a name is written after an @, lower case: `Claude Code` as `@claude code`, `@claudecode`, `@claude-code`,
 * `@claude_code`, and by its first word, `@claude`.
 */
const handlesOf = (name: string): string[] => {
  const words = name.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) {
    return [];
  }

  return [...new Set([words.join(' '), words.join(''), words.join('-'), words.join('_'), words[0]])];
};

const escaped = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const names = (text: string, handles: readonly string[]): boolean => {
  const lower = text.toLowerCase();

  return handles.some(handle => new RegExp(`(^|[^\\w@])@${escaped(handle)}(?![\\w-])`, 'u').test(lower));
};

/** Whether `text` names the agent `name` with an @ — or every agent, with `@agent` — as a word of its own. */
export const mentions = (text: string, name: string): boolean => names(text, [...handlesOf(name), ...ANY_AGENT]);

/** Whether `text` names the person `name` with an @ — or everyone, with `@all` — as a word of its own. */
export const mentionsPerson = (text: string, name: string): boolean => names(text, [...handlesOf(name), ...ANYONE]);

/** How a person addresses an agent called `name`: what the pages show them to type. */
export const handleOf = (name: string): string => `@${name.trim()}`;
