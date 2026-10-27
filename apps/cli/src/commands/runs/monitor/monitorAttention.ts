import type { Attention, RunView } from '../../../runs/view/view';

/**
 * What needs someone, one notice at a time as the panel's box says it: what sort of thing, the task it comes from and
 * the agent at it, what it says — the most pressing first, what is only to know last — and the command that answers
 * it, copied rather than printed in its row.
 */

/** How pressing each sort is: a person's step and what stops the run first, what is only to know last. */
const RANK: Partial<Record<Attention['kind'], number>> = {
  person: 0,
  reconciliation: 0,
  version: 0,
  stopping: 1,
  blocked: 2,
  'refused-again': 2,
  'no-signal': 3,
  'agents-needed': 3,
  'changed-in-project': 4,
  overwrite: 4,
  'known-failure': 5,
  'held-up': 5,
  'held-ahead': 4,
  'slow-review': 5,
  'idle-team': 5,
  'review-waits': 5,
  spikes: 5,
  request: 7,
  proposal: 6,
  'long-wait': 6,
  'long-task': 6,
  'left-in-tmp': 6
};

/** A message to the lead is a question to answer, or only to know. */
const isQuestion = (item: Attention): boolean => item.kind === 'message' && / asks \(m\d+\)/.test(item.text);

const rankOf = (item: Attention): number =>
  item.who === 'person' ? -1 : item.kind === 'message' ? (isQuestion(item) ? 2 : 8) : (RANK[item.kind] ?? 6);

/** The sort, in a word or two. */
const sortOf = (item: Attention): string =>
  item.kind === 'message' ? (isQuestion(item) ? 'question' : 'to know') : item.kind.replace(/-/g, ' ');

/** What it says, its task's id and the boilerplate around a message left out: the columns say them. */
const saidOf = (item: Attention): string => {
  const own =
    item.task !== undefined && item.text.startsWith(`${item.task} `)
      ? item.text.slice(item.task.length + 1)
      : item.text;

  return own
    .replace(/^says \((m\d+)\), for you to know: /, '($1) ')
    .replace(/^asks \((m\d+)\): /, '($1) ')
    .replace(/^Request on (\S+) from \S+: Changed by task "[^"]+" \([^)]*\)/, '$1')
    .replace(/ — read: plitzi task inbox$/, '');
};

/** A notice as the panel's box says it: what sort, its task and agent, what it says, and the command that answers it. */
export interface Need {
  key: string;
  sort: string;
  /** For the person watching (`who: 'person'`), or the lead's to act on — shown so the person knows. */
  person: boolean;
  task?: string;
  agent?: string;
  said: string;
  /** The `plitzi …` command it names, when it names one: what `c` copies. */
  fix?: string;
}

/** What keeps a notice the same while its words change: put off (`esc`), it is back once it says something else. */
export const needKey = (item: Attention): string =>
  [item.kind, item.task ?? '', item.file ?? '', item.subject ?? '', item.message ?? '', item.text].join('|');

/** The command a notice names, whole: what it says to run — `plitzi run agent agent-4 --launch`. */
export const fixOf = (text: string): string | undefined =>
  /(plitzi (?:run|task|server|page|space) [^—;:()]*?)(?=\s+—|[;:()]|$)/.exec(text)?.[1]?.trim();

/** The notices, the most pressing first — those for the person watching before the lead's. */
export const needsOf = (view: RunView): Need[] => {
  const holder = new Map(view.tasks.flatMap(task => (task.agent ? [[task.id, task.agent] as const] : [])));

  return [...view.attention]
    .sort((a, b) => rankOf(a) - rankOf(b))
    .map(item => {
      const agent = item.task === undefined ? item.agent : (holder.get(item.task) ?? item.agent);
      const fix = fixOf(item.text);

      return {
        key: needKey(item),
        sort: sortOf(item),
        person: item.who === 'person',
        ...(item.task === undefined ? {} : { task: item.task }),
        ...(agent === undefined ? {} : { agent }),
        said: saidOf(item),
        ...(fix === undefined ? {} : { fix })
      };
    });
};
