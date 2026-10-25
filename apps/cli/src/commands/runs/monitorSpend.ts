import chalk from 'chalk';

import { cell, visible } from './monitorCells';

import type { Spent } from '../../runs/spent';

/**
 * The monitor's spend: what each agent's harness spent so far, kept as each piece of its work ended (`spent.ts`) —
 * beside the activity, as wide as what it says, the activity taking the rest; a line over it when that leaves the
 * activity too narrow. Tokens taken in and written apart from those read again from the cache every turn — a tenth of
 * the price, and most of what is read: one figure of them all said 1.1M for one spec of a run's tester, ~240k its
 * price.
 */

/** The fewest columns the activity keeps beside the spend: under them, the spend is a line over it. */
export const ACTIVITY_LEAST = 80;

/** Tokens in a few characters: 950, 72k, 4.8M. */
export const tokensShort = (tokens: number): string =>
  tokens >= 1_000_000
    ? `${(tokens / 1_000_000).toFixed(tokens >= 10_000_000 ? 0 : 1)}M`
    : tokens >= 1000
      ? `${String(Math.round(tokens / 1000))}k`
      : String(tokens);

const COLUMNS = [
  'WHO',
  'DONE',
  'TASKS',
  'SESS',
  'TURNS',
  'IN',
  'OUT',
  'CACHED',
  'TOTAL',
  'PER SESS',
  'PER TASK',
  'CONTEXT'
] as const;

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

const SORT_WORDS: Record<SpendSort, string> = {
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

/** A row's cells: the agent's name to the left of its column, every figure to the right of its own. */
const rowOf = (cells: readonly string[], widths: readonly number[]): string =>
  `  ${cells.map((each, index) => (index === 0 ? each.padEnd(widths[index] ?? 0) : each.padStart(widths[index] ?? 0))).join('  ')}`;

const sum = (spend: readonly Spent[], of: (each: Spent) => number): number =>
  spend.reduce((total, each) => total + of(each), 0);

/**
 * The panel's lines, each as wide as the widest — an agent a row, the most spent first, the run's whole under them —
 * and that width: what the activity leaves it. `rows` at most, the heaviest kept.
 */
export const spendPanel = (
  spend: readonly Spent[],
  /**
   * The agents started again only once their context passes a size (`"session": "context"`), each with that size: the
   * rest start fresh after every piece (`task`, the default) or never (`keep`), and no size says anything of them.
   */
  freshAt: ReadonlyMap<string, number>,
  rows: number,
  by: SpendSort = 'spent'
): { lines: string[]; width: number } => {
  const past = (each: Spent): boolean => each.context > (freshAt.get(each.agent) ?? Number.POSITIVE_INFINITY);
  const title = `${chalk.bold('SPEND')}${chalk.dim(`  by ${SORT_WORDS[by]} (s) · cached: read again, a tenth the price`)}`;
  if (spend.length === 0) {
    const width = visible(title);

    return { lines: [' '.repeat(width), title, chalk.dim(cell('  nothing ended yet', width))], width };
  }

  const pieces = sum(spend, each => each.pieces);
  const sessions = sum(spend, each => each.sessions);
  // A task is counted once for the run, whoever worked on it: the whole spend over them is what a task cost the run.
  const tasks = new Set(spend.flatMap(each => each.tasks)).size;
  const costs = sum(spend, each => each.input + each.output);
  const cellsOf = (each: Spent): string[] => [
    each.agent,
    String(each.pieces),
    String(each.tasks.length),
    String(each.sessions),
    String(each.turns),
    tokensShort(each.input),
    tokensShort(each.output),
    tokensShort(each.cached),
    tokensShort(totalOf(each)),
    tokensShort(Math.round(perSession(each))),
    tokensShort(Math.round(perTask(each))),
    `${tokensShort(each.context)}${past(each) ? '!' : ' '}`
  ];
  const total = [
    'all',
    String(pieces),
    String(tasks),
    String(sessions),
    String(sum(spend, each => each.turns)),
    tokensShort(sum(spend, each => each.input)),
    tokensShort(sum(spend, each => each.output)),
    tokensShort(sum(spend, each => each.cached)),
    tokensShort(sum(spend, totalOf)),
    tokensShort(Math.round(costs / sessions)),
    tokensShort(Math.round(costs / Math.max(1, tasks))),
    ''
  ];
  const widths = COLUMNS.map((name, index) =>
    Math.max(name.length, ...[...spend.map(cellsOf), total].map(cells => (cells[index] ?? '').length))
  );
  // The legend is as narrow as the table: the spend is as wide as its widest line, taken from the activity.
  const perPiece = '  PER SESS · PER TASK: IN+OUT over its sessions · its tasks';
  const totalLegend = '  TOTAL: IN+OUT+CACHED, every token its harness counted';
  const pastAny = spend.some(past);
  const pastLine = '  ! past its freshContextAt: started fresh after its piece';
  const width = Math.max(
    visible(title),
    visible(rowOf([...COLUMNS], widths)),
    visible(perPiece),
    visible(totalLegend),
    ...(pastAny ? [visible(pastLine)] : [])
  );
  const agents = sortSpend(spend, by).map(each => {
    const row = rowOf(cellsOf(each), widths);

    return cell(past(each) ? chalk.yellow(row) : row, width);
  });
  const head = [' '.repeat(width), cell(title, width), chalk.dim(cell(rowOf([...COLUMNS], widths), width))];
  const foot = [
    chalk.dim(cell(`  ${'─'.repeat(width - 2)}`, width)),
    cell(chalk.bold(rowOf(total, widths)), width),
    chalk.dim(cell(totalLegend, width)),
    chalk.dim(cell(perPiece, width)),
    ...(pastAny ? [chalk.yellow(cell(pastLine, width))] : [])
  ];
  // The heaviest kept when the rows are few: the rest said in one line.
  const room = Math.max(1, rows - head.length - foot.length);
  const shown =
    agents.length <= room
      ? agents
      : [...agents.slice(0, room - 1), chalk.dim(cell(`  +${String(agents.length - room + 1)} more`, width))];

  return { lines: [...head, ...shown, ...foot], width };
};

/** The spend in one line, over the activity when beside it would leave it too narrow: the whole, then the heaviest. */
export const spendLine = (spend: readonly Spent[], width: number): string =>
  spend.length === 0
    ? ''
    : cell(
        `${chalk.bold('SPEND')} ${tokensShort(sum(spend, totalOf))} in all — ${tokensShort(sum(spend, each => each.input))} in · ${tokensShort(sum(spend, each => each.output))} out · ${tokensShort(sum(spend, each => each.cached))} cached${chalk.dim(
          ` — ${sortSpend(spend, 'spent')
            .map(each => `${each.agent} ${tokensShort(each.input + each.output)}`)
            .join(' · ')}`
        )}`,
        width
      );
