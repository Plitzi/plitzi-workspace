import { costInAll } from '../../runs/spent';

import type { Spent } from '../../runs/spent';

/**
 * The monitor's spend: what each agent's harness spent so far, kept as each piece of its work ended (`spent.ts`).
 * Tokens taken in and written apart from those read again from the cache every turn — a tenth of the price or less, and
 * most of what is read: one figure of them all said 1.1M for one spec of a run's tester, ~240k its price. Beside them,
 * what they cost at the API's prices, when every model that spent them has one (`runs/harness/prices.ts`).
 */

/** Tokens in a few characters: 950, 72k, 4.8M. */
export const tokensShort = (tokens: number): string =>
  tokens >= 1_000_000
    ? `${(tokens / 1_000_000).toFixed(tokens >= 10_000_000 ? 0 : 1)}M`
    : tokens >= 1000
      ? `${String(Math.round(tokens / 1000))}k`
      : String(tokens);

/**
 * What the spend's rows are ordered by — `s` turns to the next: what costs (in and out), that a session and a task, what
 * was read again, the context now, the name.
 */
export type SpendSort = 'spent' | 'session' | 'task' | 'cached' | 'context' | 'agent';

export const SPEND_SORTS: readonly SpendSort[] = ['spent', 'session', 'task', 'cached', 'context', 'agent'];

/**
 * Every token an agent's harness counted: what it took in new, what it wrote and its context read again — the whole of
 * what the run costs in the harness, which no other figure says (Carlos).
 */
const totalOf = (each: Spent): number => each.input + each.output + each.cached;

/** What a session of an agent's costs on average: in and out. */
const perSession = (each: Spent): number => (each.input + each.output) / each.sessions;

/** What a task an agent worked on — its own, or one it reviewed — cost it on average: in and out. */
const perTask = (each: Spent): number => (each.input + each.output) / Math.max(1, each.tasks.length);

export const SORT_WORDS: Record<SpendSort, string> = {
  spent: 'IN+OUT ↓',
  session: 'PER SESS ↓',
  task: 'PER TASK ↓',
  cached: 'CACHED ↓',
  context: 'CONTEXT ↓',
  agent: 'WHO A→Z'
};

/** The rows in the order asked, a tie by name: the same order on every draw. */
export const sortSpend = (spend: readonly Spent[], by: SpendSort): Spent[] =>
  [...spend].sort((a, b) => {
    const order =
      by === 'spent'
        ? b.input + b.output - (a.input + a.output)
        : by === 'session'
          ? perSession(b) - perSession(a)
          : by === 'task'
            ? perTask(b) - perTask(a)
            : by === 'cached'
              ? b.cached - a.cached
              : by === 'context'
                ? b.context - a.context
                : 0;

    return order || a.agent.localeCompare(b.agent);
  });

export const sum = (spend: readonly Spent[], of: (each: Spent) => number): number =>
  spend.reduce((total, each) => total + of(each), 0);

/** An agent's row of the spend, each figure as the table says it. */
export interface SpendRow {
  agent: string;
  pieces: number;
  tasks: number;
  sessions: number;
  turns: number;
  input: number;
  output: number;
  cached: number;
  total: number;
  perSession: number;
  perTask: number;
  context: number;
  cost?: number;
  /** Past its `freshContextAt`: started fresh after its piece. */
  pastFresh: boolean;
}

/**
 * The spend as the Spend view tables it: an agent a row, in the order asked, and the run's whole — a task counted once
 * for the run, whoever worked on it: the whole over them is what a task cost the run.
 */
export const spendTable = (
  spend: readonly Spent[],
  /**
   * The agents started again only once their context passes a size (`"session": "context"`), each with that size: the
   * rest start fresh after every piece (`task`, the default) or never (`keep`), and no size says anything of them.
   */
  freshAt: ReadonlyMap<string, number>,
  by: SpendSort
): { rows: SpendRow[]; all: SpendRow } => {
  const rowOf = (each: Spent): SpendRow => ({
    agent: each.agent,
    pieces: each.pieces,
    tasks: each.tasks.length,
    sessions: each.sessions,
    turns: each.turns,
    input: each.input,
    output: each.output,
    cached: each.cached,
    total: totalOf(each),
    perSession: Math.round(perSession(each)),
    perTask: Math.round(perTask(each)),
    context: each.context,
    ...(each.cost === undefined ? {} : { cost: each.cost }),
    pastFresh: each.context > (freshAt.get(each.agent) ?? Number.POSITIVE_INFINITY)
  });
  const cost = costInAll(spend);
  const tasks = new Set(spend.flatMap(each => each.tasks)).size;
  const sessions = sum(spend, each => each.sessions);
  const costs = sum(spend, each => each.input + each.output);

  return {
    rows: sortSpend(spend, by).map(rowOf),
    all: {
      agent: 'all',
      pieces: sum(spend, each => each.pieces),
      tasks,
      sessions,
      turns: sum(spend, each => each.turns),
      input: sum(spend, each => each.input),
      output: sum(spend, each => each.output),
      cached: sum(spend, each => each.cached),
      total: sum(spend, totalOf),
      perSession: sessions === 0 ? 0 : Math.round(costs / sessions),
      perTask: Math.round(costs / Math.max(1, tasks)),
      context: 0,
      ...(cost === undefined ? {} : { cost }),
      pastFresh: false
    }
  };
};

/** What the run's agents spent in all — every token their harnesses counted. */
export const spentInAll = (spend: readonly Spent[]): number => sum(spend, totalOf);

/**
 * The spend's chart: each column a bar's height, 0 for none to 8 for the busiest — the minutes put together when there
 * are more than columns, each column the same number of them but for the rounding.
 */
export const sparkline = (minutes: readonly number[], width: number): number[] => {
  const columns = Math.max(0, Math.min(width, minutes.length));
  const sums = Array.from({ length: columns }, (_, column) =>
    minutes
      .slice(Math.floor((column * minutes.length) / columns), Math.floor(((column + 1) * minutes.length) / columns))
      .reduce((total, each) => total + each, 0)
  );
  const most = Math.max(0, ...sums);

  return sums.map(each => (each === 0 || most === 0 ? 0 : Math.max(1, Math.round((each / most) * 8))));
};

/** A chart's bar of each height, 1 to 8. */
export const BARS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'] as const;
