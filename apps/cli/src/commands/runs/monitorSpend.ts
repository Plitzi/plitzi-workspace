import chalk from 'chalk';

import { cell } from './monitorCells';

import type { Spent } from '../../runs/spent';

/**
 * The monitor's spend: what each agent's harness read so far, kept as each piece of its work ended (`spent.ts`) — beside
 * the activity on a wide terminal, a line over it on a narrow one. Read, not cost: every turn reads its whole context
 * again, so an agent whose context grew reads more each turn — said apart once it is past the team's fresh start.
 */

/** How wide the spend panel is, beside the activity. */
export const SPEND_WIDTH = 38;

/** From this width on the panel is beside the activity; under it, a line over it. */
export const SPEND_BESIDE = 140;

/** Tokens in a few characters: 950, 72k, 4.8M. */
export const tokensShort = (tokens: number): string =>
  tokens >= 1_000_000
    ? `${(tokens / 1_000_000).toFixed(tokens >= 10_000_000 ? 0 : 1)}M`
    : tokens >= 1000
      ? `${String(Math.round(tokens / 1000))}k`
      : String(tokens);

/** The panel's lines, `SPEND_WIDTH` wide: an agent a row, the most read first, and the run's whole under them. */
export const spendLines = (spend: readonly Spent[], freshContextAt: number, rows: number): string[] => {
  const head = [
    ' '.repeat(SPEND_WIDTH),
    cell(`${chalk.bold('SPEND')}${chalk.dim('  tokens read by each agent')}`, SPEND_WIDTH),
    chalk.dim(
      cell(`  ${'WHO'.padEnd(10)} ${'DONE'.padStart(4)} ${'READ'.padStart(7)} ${'CONTEXT'.padStart(8)}`, SPEND_WIDTH)
    )
  ];
  if (spend.length === 0) {
    return [...head, chalk.dim(cell('  nothing ended yet', SPEND_WIDTH))];
  }

  const row = (who: string, pieces: string, read: string, context: string): string =>
    `  ${who.slice(0, 10).padEnd(10)} ${pieces.padStart(4)} ${read.padStart(7)} ${context}`;
  const total = spend.reduce((sum, each) => sum + each.read, 0);
  const pieces = spend.reduce((sum, each) => sum + each.pieces, 0);
  const foot = [
    chalk.dim(cell(`  ${'─'.repeat(SPEND_WIDTH - 4)}`, SPEND_WIDTH)),
    cell(chalk.bold(row('all', String(pieces), tokensShort(total), '')), SPEND_WIDTH),
    chalk.dim(cell(`  ${tokensShort(Math.round(total / pieces))} a piece of work`, SPEND_WIDTH)),
    ...(spend.some(each => each.context > freshContextAt)
      ? [chalk.yellow(cell(`  ! past ${tokensShort(freshContextAt)}: started fresh next`, SPEND_WIDTH))]
      : [])
  ];
  const agents = spend.map(each => {
    const context = tokensShort(each.context).padStart(8);

    return cell(
      row(
        each.agent,
        String(each.pieces),
        tokensShort(each.read),
        each.context > freshContextAt ? chalk.yellow(`${context}!`) : context
      ),
      SPEND_WIDTH
    );
  });
  // The heaviest kept when the rows are few: the rest said in one line.
  const room = Math.max(1, rows - head.length - foot.length);
  const shown =
    agents.length <= room
      ? agents
      : [...agents.slice(0, room - 1), chalk.dim(cell(`  +${String(agents.length - room + 1)} more`, SPEND_WIDTH))];

  return [...head, ...shown, ...foot];
};

/** The spend in one line, over the activity on a narrow terminal: the whole, then the heaviest. */
export const spendLine = (spend: readonly Spent[], width: number): string =>
  spend.length === 0
    ? ''
    : cell(
        `${chalk.bold('SPEND')} ${tokensShort(spend.reduce((sum, each) => sum + each.read, 0))} read${chalk.dim(` — ${spend.map(each => `${each.agent} ${tokensShort(each.read)}`).join(' · ')}`)}`,
        width
      );
