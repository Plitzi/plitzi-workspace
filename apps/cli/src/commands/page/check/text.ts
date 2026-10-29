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
    // One named is read whole, every key with its value: its shape alone cut the very keys a run's tester asked for.
    ...Object.entries(report.sources ?? {}).map(
      ([name, value]) => `  · source ${name}: ${asked.stateOf ? valuesOf(value) : shapeOf(value)}`
    ),
    ...Object.entries(report.elements ?? {}).flatMap(([id, { read, styles }]) => [
      read === null || read === undefined
        ? `  · element ${id}: the page's dev tools read no element by that name`
        : `  · element ${id}: ${JSON.stringify(read)}`,
      ...('unread' in styles
        ? [`  · element ${id}: its styles cannot be read — ${styles.unread}`]
        : [
            ...(styles.partOf
              ? [
                  `  · element ${id}: a part of the component ${styles.partOf}${styles.copies > 1 ? `, read on the first of the ${String(styles.copies)} copies the page draws` : ''}`
                ]
              : []),
            ...(styles.contested.length === 0
              ? [`  · element ${id}: no property is set by more than one of its classes`]
              : contestedText(styles.contested, styles.wornBy).map(line => `  · element ${id} at rest — ${line}`)),
            ...inertText(styles.inert, report.width, styles.wornBy).map(line => `  · element ${id}: ${line}`)
          ])
    ])
  ];
};

/** A short value as it is, cut past `most` characters. */
const shortOf = (value: unknown, most: number): string => {
  const text = value === undefined ? 'undefined' : JSON.stringify(value);

  return text.length > most ? `${text.slice(0, most - 1)}…` : text;
};

/**
 * A value's shape in a few words: a list's length, an object's keys with what each holds — a short value as it is, a
 * list or an object by its size. A run's designer read `channel_siteInbox.connected` with `--json` and a script.
 */
const shapeOf = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `a list of ${String(value.length)}`;
  }

  if (isRecord(value)) {
    const keys = Object.keys(value);
    const held = (each: unknown): string =>
      Array.isArray(each)
        ? `[${String(each.length)}]`
        : isRecord(each)
          ? `{${String(Object.keys(each).length)}}`
          : shortOf(each, 30);

    return `{ ${keys
      .slice(0, 8)
      .map(key => `${key}: ${held(value[key])}`)
      .join(', ')}${keys.length > 8 ? `, … ${String(keys.length - 8)} more` : ''} }`;
  }

  return shortOf(value, 60);
};

/** A value named in `--state`, every key of it with what it holds — a list or an object inside it by its size. */
const valuesOf = (value: unknown): string => {
  if (!isRecord(value)) {
    return Array.isArray(value) ? `a list of ${String(value.length)}: ${shortOf(value, 300)}` : shortOf(value, 300);
  }

  const held = (each: unknown): string =>
    Array.isArray(each)
      ? `[${String(each.length)}]`
      : isRecord(each)
        ? `{${Object.keys(each).slice(0, 6).join(', ')}${Object.keys(each).length > 6 ? ', …' : ''}}`
        : shortOf(each, 60);

  return `{ ${Object.entries(value)
    .map(([key, each]) => `${key}: ${held(each)}`)
    .join(', ')} }`;
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

/** How many findings of a few shown in full, said in text: the rest by count, `--json` holding every one. */
const FEW = 3;

/**
 * Findings on elements other tasks write, in a line: their elements, counted — a run's look printed some 150 lines of
 * them, the same for every page and width, before the one line about the task.
 */
const apartText = (apart: NonNullable<CheckReport['apart']>): string[] => {
  if (apart.length === 0) {
    return [];
  }

  const ids = [...new Set(apart.map(each => each.elementId))];

  return [
    chalk.dim(
      `  · ${String(apart.length)} finding${apart.length === 1 ? '' : 's'} on elements another task writes, not this one's — ${ids.slice(0, 6).join(', ')}${ids.length > 6 ? `, … (${String(ids.length)})` : ''} (--json says each)`
    )
  ];
};

/** Where a visitor sees each element asked (`--sight`): those in sight in one line, each of the rest with why. */
const sightsText = (sights: Readonly<Record<string, string>>): string[] => {
  const entries = Object.entries(sights);
  const inSight = entries.filter(([, sight]) => sight === 'in sight').map(([id]) => id);

  return [
    ...(inSight.length > 0 ? [chalk.dim(`  · in sight: ${inSight.join(', ')}`)] : []),
    ...entries.filter(([, sight]) => sight !== 'in sight').map(([id, sight]) => `  · ${id}: ${sight}`)
  ];
};

/** What an expecting check found besides what it expects: the first few, then a count — failing nothing. */
const besidesText = (besides: readonly string[]): string[] =>
  besides.length === 0
    ? []
    : [
        chalk.dim(
          `  · the page has ${String(besides.length)} more finding${besides.length === 1 ? '' : 's'}, not what --expect asks — failing nothing here; page check without --expect holds the page whole:`
        ),
        ...besides.slice(0, FEW).map(each => chalk.dim(`      ${each}`)),
        ...(besides.length > FEW
          ? [chalk.dim(`      … and ${String(besides.length - FEW)} more (--json says each)`)]
          : [])
      ];

/** Past this many elements that say one thing, they are said in one line: their names, then what each is. */
const GROUPED_FROM = 3;

/** A problem as `<the element> <what it is>`: an element named first, quoted or not, its kind before it. */
const NAMED_FIRST =
  /^(?:(?:text|list|container|link|button|image|element) )?"?([\w-]+)"?( \(×\d+\))? ((?:is|shows) .+)$/;

/**
 * The page's problems, those many elements share said once: "N elements are a text with no words…: a, b, c" — a run's
 * check printed twenty-five lines of one finding, one an element, before what else it found.
 */
export const groupedProblems = (problems: readonly string[]): string[] => {
  const byWhat = new Map<string, string[]>();
  for (const problem of problems) {
    const named = NAMED_FIRST.exec(problem);
    if (named) {
      const [, id = '', times = '', what = ''] = named;
      byWhat.set(what, [...(byWhat.get(what) ?? []), `${id}${times}`]);
    }
  }

  const said = new Set<string>();

  return problems.flatMap(problem => {
    const what = NAMED_FIRST.exec(problem)?.[3];
    const ids = what === undefined ? undefined : byWhat.get(what);
    if (what === undefined || !ids || ids.length < GROUPED_FROM) {
      return [problem];
    }

    if (said.has(what)) {
      return [];
    }

    said.add(what);

    return [
      `${String(ids.length)} elements — ${ids.slice(0, 8).join(', ')}${ids.length > 8 ? `, … (--json names each)` : ''} — each ${what}`
    ];
  });
};

export const reportText = (report: CheckReport, asked: CheckAsk): string => {
  const head = `${report.path} at ${String(report.width)} px${report.scheme ? `, ${report.scheme}` : ''}${report.signedInAs === undefined ? '' : `, signed in as ${report.signedInAs}`}`;
  const held = [
    ...(report.notFound ? ['  · sent with status 404: the page for an address that shows nothing'] : []),
    ...(report.retriedAfter ? [`  · looked at again after the server failed: ${report.retriedAfter.join(', ')}`] : []),
    ...listsText(report.lists),
    ...apartText(report.apart ?? []),
    ...besidesText(report.besides ?? []),
    ...sightsText(report.sights ?? {}),
    ...(report.asTheOriginal ?? []).map(each => chalk.dim(`  · as the original: ${each}`)),
    ...(report.expected ?? []).map(each => chalk.dim(`  · expected ${each} ✓`)),
    ...(report.shownFailures ?? []).map(each => chalk.dim(`  · failed, and the page shows it: ${each}`)),
    ...(report.handledRefusals ?? []).map(each => chalk.dim(`  · refused, and its flow went on: ${each}`)),
    ...browserOnlyText(report),
    ...(report.throttled && report.throttled.length > 0
      ? [
          chalk.dim(
            `  · held back by their host (a 429 or 503, a connection it let go or never answered, or dropped while it sent the rest), not the page's: ${report.throttled.slice(0, 4).join(', ')}${report.throttled.length > 4 ? `, … (${String(report.throttled.length)})` : ''}`
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
  const cut =
    report.cut && report.cut.length > 0
      ? chalk.dim(
          `  · cut short at this width, by a box that cuts its text (an ellipsis, a clipped overflow): ${report.cut.join(', ')} — on purpose for data that varies; --expect "<id>~<text>" holds one whole`
        )
      : undefined;
  const painted = (report.oneColour ?? []).map(each =>
    chalk.yellow(
      `  · canvas ${each.id}: painted one colour, ${each.colour}, edge to edge — a map or a chart drawing nothing but its ground? What a canvas draws is read only as a picture: plitzi page shot`
    )
  );
  const busy = report.busy
    ? chalk.dim(
        `  · its main thread busy in ${String(report.busy.tasks)} long task${report.busy.tasks === 1 ? '' : 's'} as it loaded, the longest ${String(report.busy.longest)} ms (${String(report.busy.total)} ms in all) — a visitor waits that long for a press to answer; a development build runs longer`
      )
    : undefined;
  const empty =
    report.empty.length > 0
      ? chalk.dim(`  · empty, with nothing in them yet and no size: ${report.empty.join(', ')}`)
      : undefined;
  const outOfUse =
    report.outOfUse.length > 0
      ? chalk.dim(`  · out of use on purpose — transparent and taking no press: ${report.outOfUse.join(', ')}`)
      : undefined;
  if (report.ok) {
    return [
      chalk.green(
        `✓ ${head} — ${report.checked > 0 ? `${String(report.checked)} elements on screen, ` : ''}nothing wrong`
      ),
      ...(atWidth ? [atWidth] : []),
      ...painted,
      ...(cut ? [cut] : []),
      ...(busy ? [busy] : []),
      ...(empty ? [empty] : []),
      ...(outOfUse ? [outOfUse] : []),
      ...held
    ].join('\n');
  }

  return [
    chalk.red(`✗ ${head}`),
    ...groupedProblems(report.problems).map(problem => `  - ${problem}`),
    // What a guest sees reads hidden to an account: said where it fails, with how to read it as one.
    ...(report.signedInAs === undefined
      ? []
      : [chalk.dim(`  · read signed in as ${report.signedInAs}: what a guest sees, --guest`)]),
    ...report.consoleErrors.map(error => `  - console: ${error}`),
    ...report.failedRequests.map(request => `  - request refused: ${request}`),
    ...painted,
    ...(empty ? [empty] : []),
    ...(outOfUse ? [outOfUse] : []),
    ...held
  ].join('\n');
};
