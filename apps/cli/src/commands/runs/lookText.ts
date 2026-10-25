import path from 'node:path';

import chalk from 'chalk';

import { PROJECT_STATE } from '@plitzi/sdk-shared/project';

import { list } from './text';

import type { lookAt } from './review';

/**
 * The pictures not taken, a reason once with every picture it stopped: a run's look said "siteRooms is not on <url>"
 * ten times — a part only a signed-in visitor has, which no line said how to see.
 */
export const unpicturedText = (unpictured: readonly { what: string; why: string }[]): string[] => {
  const byWhy = new Map<string, string[]>();
  for (const { what, why } of unpictured) {
    const reason = why.replace(/https?:\/\/\S+?(?=[\s.,;]*$|[\s,;])/g, 'the page').replace(/\.$/, '');
    byWhy.set(reason, [...(byWhy.get(reason) ?? []), what]);
  }

  return [
    chalk.yellow(`Not pictured (${String(unpictured.length)}):`),
    ...[...byWhy].map(([why, whats]) =>
      chalk.yellow(
        `  ${why} — ${whats.length > 3 ? `${whats.slice(0, 3).join('; ')}; and ${String(whats.length - 3)} more` : whats.join('; ')}${/is not on the page/.test(why) && whats.length > 1 ? ' — on none of them: a part a guest has not (--as <username>), or one a state opens (--click <id>)' : ''}`
      )
    )
  ];
};

/**
 * The pictures, each folder said once and its files under it: a look of eight pages listed sixteen whole paths, the same
 * hundred characters before each name.
 */
export const picturesText = (shots: readonly string[]): string[] => {
  const byFolder = new Map<string, string[]>();
  for (const shot of shots) {
    const folder = path.dirname(shot);
    byFolder.set(folder, [...(byFolder.get(folder) ?? []), path.basename(shot)]);
  }

  return [...byFolder].flatMap(([folder, files]) => [`  in ${folder}/`, ...files.map(file => `    ${file}`)]);
};

/** The most of a comparison's sections and dress said on its line: its picture has them all. */
const MOST_SAID = 4;

const fewOf = (items: readonly string[], joiner: string): string =>
  items.length > MOST_SAID
    ? `${items.slice(0, MOST_SAID).join(joiner)}${joiner}and ${String(items.length - MOST_SAID)} more`
    : items.join(joiner);

/** What `task look` says of a look: what it served, read and pictured, and what it could not. */

export type Looked = Awaited<ReturnType<typeof lookAt>>;

/** What a look says. */
export const lookText = (looked: Looked): string =>
  [
    chalk.bold(
      looked.borrowed === undefined
        ? `${looked.task}, as it went to review (served from its copy, now stopped):`
        : `${looked.task}, as its copy is now — served by ${looked.borrowed.by === 'agent' ? "its agent's own server" : 'the server a picture of it kept'} on :${String(looked.borrowed.port)}, left running (it holds the copy's state):`
    ),
    ...(looked.stoppedUnder ?? []).map(line => chalk.yellow(`⚠ ${line}`)),
    ...(looked.signedInAs
      ? [`Read signed in as ${looked.signedInAs}, as its acceptance checks it (--as another to read it otherwise)`]
      : []),
    ...('steps' in looked ? [`Pictured after "${looked.steps}"; the check read each page at rest`] : []),
    ...(looked.forVisitors
      ? [
          looked.forVisitors.as === undefined
            ? chalk.yellow(
                `⚠ ${list(looked.forVisitors.pages)} ${looked.forVisitors.pages.length === 1 ? 'is' : 'are'} for signed-in visitors, read as a guest: ${looked.forVisitors.problem ?? 'name the project’s account in .env (PLITZI_CHECK_USER, PLITZI_CHECK_PASSWORD)'} — or --as <username>`
              )
            : `Read signed in as ${looked.forVisitors.as}, the project’s account: ${list(looked.forVisitors.pages)} ${looked.forVisitors.pages.length === 1 ? 'is' : 'are'} for signed-in visitors (--as another to read it otherwise)`
        ]
      : []),
    ...(looked.notLooked
      ? [
          chalk.yellow(
            `⚠ Its changes are drawn at ${list(looked.notLooked)} too — a file it changed is read there — not looked at: plitzi task look ${looked.task}${looked.notLooked.map(page => ` ${page}`).join('')} --before`
          )
        ]
      : []),
    ...(looked.ownStatus ?? []).map(each =>
      chalk.yellow(
        `⚠ Its acceptance checks ${each.page} with --status ${String(each.status)} — looked at apart, with it: plitzi task look ${looked.task} ${each.page} --status ${String(each.status)}`
      )
    ),
    ...(looked.notReviewed
      ? [
          chalk.yellow(
            `⚠ Its copy changed after it went to review: ${list(looked.notReviewed)} — what is served is not what an approval merges (that is what went to review). Ask it why (plitzi task message ${looked.task} "…"), or send it back (--changes) to complete again`
          )
        ]
      : []),
    ...(looked.parts
      ? [`Its part of the page, pictured alone: ${looked.parts.join(', ')} — the rest is other tasks'`]
      : []),
    ...(looked.wholeFor
      ? [`Its parts — ${looked.wholeFor.join(', ')} — pictured with the page whole: too many to picture apart`]
      : []),
    ...(looked.unreached
      ? [
          chalk.yellow(
            `⚠ No link of the site reaches ${list(looked.unreached)}: not looked at — name one: plitzi task look ${looked.task} <its address>`
          )
        ]
      : []),
    looked.check,
    ...(looked.apart ? [chalk.dim(`  · ${String(looked.apart)} finding(s) on other tasks' parts left out`)] : []),
    ...(looked.movedElsewhere
      ? looked.movedElsewhere.map(each =>
          chalk.yellow(
            `⚠ ${each.route} moved outside its parts too — the first element that differs from the run before it: ${each.here}\n    before: ${each.there}`
          )
        )
      : []),
    ...(looked.unchanged
      ? [
          chalk.dim(
            `Drawn the same as the run before it — every element, box and style read on both, so not pictured: ${list(looked.unchanged)} (a shared file of it reaches them; plitzi task look ${looked.task} <page> pictures one anyway)`
          )
        ]
      : []),
    ...(looked.shots.length > 0
      ? [
          `Pictures — a browser in ${looked.timezone}, its language en-US (--timezone for another zone):`,
          ...picturesText(looked.shots)
        ]
      : [
          looked.unpictured
            ? 'No picture could be taken:'
            : looked.unchanged
              ? 'Nothing pictured: what it looked at is drawn as the run before it draws it.'
              : `No picture was taken, and no picture command said why: look at one page again — plitzi task look ${looked.task} <page> --fresh`
        ]),
    ...(looked.unpictured ? unpicturedText(looked.unpictured) : []),
    ...(looked.compared
      ? [
          "Beside the run before it (its approved work, without this task) — motion reduced and another site's pictures stood in for on both sides, so only what the project changed differs; each side by side (after | before) in its -after-compare.png:",
          ...looked.compared.map(each =>
            each.problem
              ? chalk.yellow(`  ${each.route} at ${each.width} ${each.scheme}: ${each.problem}`)
              : `  ${each.route} at ${each.width} ${each.scheme}: ${(each.changed === 0 || each.sections.length === 0) && each.dress.length === 0 ? 'nothing changed' : `${String(each.changed ?? 0)}% differs${each.sections.length > 0 ? ` — ${fewOf(each.sections, ', ')}` : ''}${each.dress.length > 0 ? ` · its dress: ${fewOf(each.dress, ' · ')}` : ''}`}${each.sideBySide ? chalk.dim(` · ${each.sideBySide}`) : ''}`
          )
        ]
      : []),
    ...(looked.warmCopy
      ? [
          chalk.dim(
            `  Its copy was served with the state its plays left (${PROJECT_STATE}/), the run before it cold: what the data says — a song playing, a count — may differ for that, not the task. Cold on both sides: plitzi server reset in its copy (its server stopped), then look again --fresh`
          )
        ]
      : []),
    ...(looked.notBeside
      ? [chalk.dim(`Not set beside the run before it — that nothing else moved is read with it: --before`)]
      : []),
    `Then: plitzi task review ${looked.task} --approve | --changes "…"`
  ].join('\n');
