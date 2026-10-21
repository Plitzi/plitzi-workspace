import chalk from 'chalk';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { listsText } from './lists';
import { contestedText, inertText } from './styles';

import type { CheckAsk, CheckReport, ClickReport } from './types';

/**
 * A page's report, in text: what it holds, what only the browser has, what a click did, every issue.
 */

/** What the page holds, when it was asked for: one compact line each, the shape of a source rather than its rows. */
const heldText = (report: CheckReport, asked: CheckAsk): string[] => {
  if (!asked.state && asked.elements.length === 0) {
    return [];
  }

  if (!report.devTools) {
    return ['  · the page has no dev tools on (debug mode), so its state and elements cannot be read'];
  }

  return [
    ...(report.state === undefined ? [] : [`  · state ${JSON.stringify(report.state)}`]),
    ...Object.entries(report.sources ?? {}).map(([name, value]) => `  · source ${name}: ${shapeOf(value)}`),
    ...Object.entries(report.elements ?? {}).flatMap(([id, { read, styles }]) => [
      `  · element ${id}: ${JSON.stringify(read)}`,
      ...(styles === null
        ? [`  · element ${id} is not on the page: its styles cannot be read`]
        : [
            ...(styles.contested.length === 0
              ? [`  · element ${id}: no property is set by more than one of its classes`]
              : contestedText(styles.contested, styles.wornBy).map(line => `  · element ${id} at rest — ${line}`)),
            ...inertText(styles.inert, report.width, styles.wornBy).map(line => `  · element ${id}: ${line}`)
          ])
    ])
  ];
};

/** A value's shape in a few words: a list's length, an object's keys, a short value as it is. */
const shapeOf = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `a list of ${String(value.length)}`;
  }

  if (isRecord(value)) {
    const keys = Object.keys(value);

    return `{ ${keys.slice(0, 8).join(', ')}${keys.length > 8 ? ', …' : ''} }`;
  }

  const text = value === undefined ? 'undefined' : JSON.stringify(value);

  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
};

/** With `--ssr`, what only the browser renders — not a problem outside a server provider, and said so it is seen. */
const browserOnlyText = (report: CheckReport): string[] =>
  report.browserOnly && report.browserOnly.length > 0
    ? [
        chalk.dim(
          `  · rendered only in the browser, outside any server provider: ${report.browserOnly.slice(0, 10).join(', ')}${report.browserOnly.length > 10 ? `, … (${String(report.browserOnly.length)})` : ''}`
        )
      ]
    : [];

/**
 * What a click or a hover changed, a line each — or that it changed nothing, which is the line a broken button gets, and
 * a hover with no effect.
 */
export const clickedText = (clicked: ClickReport | undefined): string[] => {
  if (!clicked) {
    return [];
  }

  if (clicked.problem) {
    return [`  - ${clicked.hovered ? 'hover' : 'click'}: ${clicked.problem}`];
  }

  if (clicked.skipped) {
    return [`  · ${clicked.hovered ? 'hovering' : 'clicking'} ${clicked.element}: ${clicked.skipped}`];
  }

  const doing =
    clicked.element === 'the fields filled'
      ? 'filling them'
      : `${clicked.hovered ? 'hovering' : 'clicking'} ${clicked.element}`;
  const nothing = `no flow ran, the page went nowhere, nothing scrolled, appeared or went, nothing was said, ${clicked.hovered ? 'the state is as it was, and it and its elements look as they did' : 'and the state is as it was'}`;

  return [
    ...(clicked.filled ? [`  · filled ${clicked.filled.join(', ')}`] : []),
    ...(clicked.fillChanges ? ['  · filling them:', ...clicked.fillChanges.map(change => `      ${change}`)] : []),
    ...(clicked.changes.length === 0
      ? [`  · ${doing} changed nothing${clicked.fillChanges ? ' more than the filling did' : `: ${nothing}`}`]
      : [
          `  · ${doing}:`,
          ...clicked.changes.map(change => `      ${change}`),
          // A flow that ran and succeeded is not a page that changed: when only flows are said, that is said too.
          ...(clicked.changes.every(change => change.startsWith('ran '))
            ? [`      — and nothing on the page changed: ${nothing.replace('no flow ran, ', '')}`]
            : [])
        ]),
    ...clicked.failed.map(flow => `  - ${flow}`)
  ];
};

export const reportText = (report: CheckReport, asked: CheckAsk): string => {
  const head = `${report.path} at ${String(report.width)} px${report.scheme ? `, ${report.scheme}` : ''}`;
  const held = [
    ...(report.notFound ? ['  · sent with status 404: the page for an address that shows nothing'] : []),
    ...(report.retriedAfter ? [`  · looked at again after the server failed: ${report.retriedAfter.join(', ')}`] : []),
    ...listsText(report.lists),
    ...(report.apart ?? []).map(each => chalk.dim(`  · another task's, not this one's: ${each}`)),
    ...(report.expected ?? []).map(each => chalk.dim(`  · expected ${each} ✓`)),
    ...browserOnlyText(report),
    ...(report.throttled && report.throttled.length > 0
      ? [
          chalk.dim(
            `  · held back by their host (a 429, or dropped while it sent the rest), not the page's: ${report.throttled.slice(0, 4).join(', ')}${report.throttled.length > 4 ? `, … (${String(report.throttled.length)})` : ''}`
          )
        ]
      : []),
    ...(report.fromEmbeds ?? []).map(each =>
      chalk.dim(`  · said by a document embedded in the page, not the page: ${each}`)
    ),
    ...heldText(report, asked),
    ...clickedText(report.clicked)
  ];
  const atWidth =
    report.hiddenAtWidth.length > 0
      ? chalk.dim(`  · hidden at this width by a breakpoint, on purpose: ${report.hiddenAtWidth.join(', ')}`)
      : undefined;
  if (report.ok) {
    return [
      chalk.green(
        `✓ ${head} — ${report.checked > 0 ? `${String(report.checked)} elements on screen, ` : ''}nothing wrong`
      ),
      ...(atWidth ? [atWidth] : []),
      ...held
    ].join('\n');
  }

  return [
    chalk.red(`✗ ${head}`),
    ...report.problems.map(problem => `  - ${problem}`),
    ...report.consoleErrors.map(error => `  - console: ${error}`),
    ...report.failedRequests.map(request => `  - request refused: ${request}`),
    ...held
  ].join('\n');
};
