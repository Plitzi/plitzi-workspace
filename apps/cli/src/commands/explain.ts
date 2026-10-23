import chalk from 'chalk';

import { EXPLAIN_KINDS, explain, explainKindOf, explainList, explanationText } from '@plitzi/sdk-authoring';
import { PROJECT_LAYOUT_CODES } from '@plitzi/sdk-shared/project';

import { apiDeclarations, apiText } from './apiDeclarations';
import { findProject } from './existingProject';
import { pluginText, projectPlugins } from './projectPlugins';
import { serverTasks, serverTaskText } from './serverTasks';
import { fail } from './terminal';
import { LINT_RULES } from '../lint/catalog';

import type { Explanation } from '@plitzi/sdk-authoring';

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
  json?: boolean;
}

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

export const explainCommand = async (name: string | undefined, options: ExplainOptions): Promise<void> => {
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
