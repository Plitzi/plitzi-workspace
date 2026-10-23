import chalk from 'chalk';

import {
  EXPLAIN_KINDS,
  explain,
  explainKindOf,
  explainList,
  explainSearch,
  explanationText,
  searchScore,
  searchWords
} from '@plitzi/sdk-authoring';
import { PROJECT_LAYOUT_CODES } from '@plitzi/sdk-shared/project';

import { apiDeclarations, apiText } from './apiDeclarations';
import { findProject } from './existingProject';
import { pluginText, projectPlugins } from './projectPlugins';
import { serverTasks, serverTaskText } from './serverTasks';
import { fail } from './terminal';
import { LINT_RULES } from '../lint/catalog';

import type { Explanation, SearchHit } from '@plitzi/sdk-authoring';
import type { Command } from 'commander';

/**
 * `plitzi explain <name>`: what a name means when authoring a space — an element, a step, a trigger, a problem's code,
 * a transformer, a helper (`bindTemplate`, `scope`, `motion`…), a template's filter, function or global source — in a few lines, from the catalogues the checks
 * themselves read; any other export of a `@plitzi` package (`pageFamily`, `SpaceSpec`, `createServer`) by its published
 * declaration. A code is any check's: authoring's, `plitzi space lint`'s own rules (`LINT_RULES`) and the project's
 * layout (`PROJECT_LAYOUT_CODES`, what the server, `npm run author` and `plitzi doctor` hold a project to). `--list
 * steps` names every one of a kind; `--json` answers in one object, for a tool or an agent.
 */

export interface ExplainOptions {
  list?: string;
  /** Words of what is looked for: everything they describe, best first. */
  search?: string;
  json?: boolean;
}

/** A command of the CLI as a search finds it: `plitzi page outline`, and what its help says it does. */
const commandsOf = (commands: readonly Command[], above = 'plitzi'): { name: string; summary: string }[] =>
  commands.flatMap(command => {
    const name = `${above} ${command.name()}`;

    // Its options too, each said with the command: `page measure --click` is what measures an open drawer.
    return [
      { name, summary: command.description() },
      ...command.options.flatMap(option =>
        option.long && !['--json', '--token', '--agent', '--run', '--help'].includes(option.long)
          ? [{ name: `${name} ${option.long}`, summary: `${option.description} (${command.description()})` }]
          : []
      ),
      ...commandsOf(command.commands, name)
    ];
  });

/**
 * Everything the words describe: what authoring knows, the codes of the CLI's own checks and its commands — "is there
 * a way to…" answered in one call, never by reading a bundle's types or the help of every command.
 */
export const searchAll = (
  words: string,
  commands: readonly Command[],
  limit = 10
): (SearchHit | { kind: 'command' | 'code'; name: string; summary: string })[] => {
  const asked = [...new Set(searchWords(words))];
  const own = [
    ...commandsOf(commands).map(each => ({ kind: 'command' as const, ...each })),
    ...[...CHECK_CODES.values()].map(code => ({ kind: 'code' as const, name: code.name, summary: code.means }))
  ];
  const ranked = [
    ...explainSearch(words, limit).map(hit => ({ hit, score: searchScore(asked, hit.name, hit.summary) })),
    ...own.map(hit => ({ hit, score: searchScore(asked, hit.name, hit.summary) })).filter(each => each.score > 0)
  ];

  return ranked
    .sort((a, b) => b.score - a.score || a.hit.name.localeCompare(b.hit.name))
    .slice(0, limit)
    .map(each => each.hit);
};

/**
 * A code of a check the CLI runs on the project rather than on the space — said as authoring says one of its own, and
 * which check raises it. Its fix is in each finding, which names the file; here, where that is said at length.
 */
export interface CheckCodeExplanation {
  kind: 'code';
  name: string;
  codeKind: 'error' | 'warning';
  means: string;
  fix: string;
  checkedBy: 'plitzi space lint' | 'the project layout';
}

const LAYOUT_FIX =
  'what its message says, naming the file — plitzi doctor says every one, and plitzi doctor --fix makes those with one reading';

/** Every code of the CLI's own checks, by name. */
const CHECK_CODES: ReadonlyMap<string, CheckCodeExplanation> = new Map([
  ...Object.entries(LINT_RULES).map(([name, rule]): [string, CheckCodeExplanation] => [
    name,
    {
      kind: 'code',
      name,
      codeKind: rule.severity,
      means: rule.means,
      fix: `what its message says — explained in ${rule.docs}`,
      checkedBy: 'plitzi space lint'
    }
  ]),
  ...Object.entries(PROJECT_LAYOUT_CODES).map(([name, code]): [string, CheckCodeExplanation] => [
    name,
    { kind: 'code', name, codeKind: code.level, means: code.means, fix: LAYOUT_FIX, checkedBy: 'the project layout' }
  ])
]);

type AnyExplanation = Explanation | CheckCodeExplanation;

const isCheckCode = (explanation: AnyExplanation): explanation is CheckCodeExplanation => 'checkedBy' in explanation;

/** Everything a name is: what authoring knows it as, and a code of the CLI's own checks besides. */
export const explainName = (name: string): AnyExplanation[] => {
  const check = CHECK_CODES.get(name);

  return [...explain(name), ...(check ? [check] : [])];
};

const checkCodeText = (explanation: CheckCodeExplanation): string =>
  [
    `${explanation.name} — ${explanation.codeKind} of ${explanation.checkedBy}: ${explanation.means}.`,
    `Fix: ${explanation.fix}.`
  ].join('\n');

const textOf = (explanation: AnyExplanation): string =>
  isCheckCode(explanation) ? checkCodeText(explanation) : explanationText(explanation);

const kinds = Object.values(EXPLAIN_KINDS).join(', ');

export const explainCommand = async (
  name: string | undefined,
  options: ExplainOptions,
  commands: readonly Command[] = []
): Promise<void> => {
  if (options.search !== undefined) {
    const hits = searchAll(options.search, commands);
    if (hits.length === 0) {
      fail(
        `Nothing Plitzi has is described by "${options.search}" — other words, or what there is: --list ${kinds}, tasks. Something Plitzi should have: say it (plitzi run notice --plitzi "…", in a run).`
      );

      return;
    }

    console.log(
      options.json
        ? JSON.stringify(hits)
        : [
            ...hits.map(hit => `${hit.name.padEnd(36)} ${chalk.dim(`${hit.kind} — ${hit.summary}`)}`),
            chalk.dim('Each said whole: plitzi explain <name>; a command: its --help')
          ].join('\n')
    );

    return;
  }

  // The steps a server action runs are the project's sdk-server's: read from the one installed, not a catalogue here.
  if (options.list === 'tasks') {
    const project = await findProject(process.cwd());
    const read = await serverTasks(project?.root ?? process.cwd());
    if ('problem' in read) {
      fail(`No server steps to list: ${read.problem}.`);

      return;
    }

    console.log(
      options.json
        ? JSON.stringify(read.tasks.map(task => ({ name: task.name, summary: task.description ?? task.title })))
        : read.tasks.map(task => `${task.name.padEnd(32)} ${chalk.dim(task.description ?? task.title)}`).join('\n')
    );

    return;
  }

  if (options.list !== undefined) {
    const kind = explainKindOf(options.list);
    if (!kind) {
      fail(`--list takes ${kinds}, tasks (a server action's steps), not "${options.list}".`);

      return;
    }

    const checks =
      kind === 'code'
        ? [...CHECK_CODES.values()].map(code => ({
            name: code.name,
            summary: `${code.codeKind} of ${code.checkedBy}: ${code.means}`
          }))
        : [];
    const entries = [...explainList(kind), ...checks].sort((a, b) => a.name.localeCompare(b.name));
    console.log(
      options.json
        ? JSON.stringify(entries)
        : entries.map(entry => `${entry.name.padEnd(32)} ${chalk.dim(entry.summary)}`).join('\n')
    );

    return;
  }

  if (!name) {
    fail(`Name what to explain — plitzi explain container — or list a kind: --list ${kinds}.`);

    return;
  }

  const explanations = explainName(name);
  if (explanations.length === 0) {
    // A step of a server action (`list.put`): the project's sdk-server says what it is and what it takes.
    const project = await findProject(process.cwd());
    const read = await serverTasks(project?.root ?? process.cwd());
    const step = 'tasks' in read ? read.tasks.find(task => task.name === name) : undefined;
    if (step) {
      console.log(options.json ? JSON.stringify([step]) : serverTaskText(step));

      return;
    }

    // Not a name the catalogues hold: an export of a @plitzi package, read from the types the project installed.
    const api = apiDeclarations(process.cwd(), name);
    if (api.length > 0) {
      console.log(options.json ? JSON.stringify(api) : api.map(apiText).join('\n\n'));

      return;
    }

    // An element of the project's own, by the type it is placed by: said as one the SDK ships is.
    const own = project
      ? (await projectPlugins(project.root)).find(plugin => plugin.declaration.type === name)
      : undefined;
    if (own) {
      console.log(options.json ? JSON.stringify([own.declaration]) : pluginText(own));

      return;
    }

    fail(
      [
        `"${name}" is no element, step, trigger, code, transformer, helper, template filter, template function or global source, no step of a server action, nor an export of a @plitzi package installed here. See what there is: --list ${kinds}, tasks.`,
        `A name of the project's own code is read where it is written: \`grep -rn "${name}" src/\`.`
      ].join('\n')
    );

    return;
  }

  console.log(options.json ? JSON.stringify(explanations) : explanations.map(textOf).join('\n\n'));
};
