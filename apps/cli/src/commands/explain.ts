import chalk from 'chalk';

import { EXPLAIN_KINDS, explain, explainKindOf, explainList, explanationText } from '@plitzi/sdk-authoring';

/**
 * `plitzi explain <name>`: what a name means when authoring a space — an element, a step, a trigger, a problem's code,
 * a transformer — in a few lines, from the catalogues the checks themselves read. `--list steps` names every one of a
 * kind; `--json` answers in one object, for a tool or an agent.
 */

export interface ExplainOptions {
  list?: string;
  json?: boolean;
}

const kinds = Object.values(EXPLAIN_KINDS).join(', ');

export const explainCommand = (name: string | undefined, options: ExplainOptions): void => {
  if (options.list !== undefined) {
    const kind = explainKindOf(options.list);
    if (!kind) {
      console.error(chalk.red(`--list takes ${kinds}, not "${options.list}".`));
      process.exitCode = 1;

      return;
    }

    const entries = explainList(kind);
    console.log(
      options.json
        ? JSON.stringify(entries)
        : entries.map(entry => `${entry.name.padEnd(32)} ${chalk.dim(entry.summary)}`).join('\n')
    );

    return;
  }

  if (!name) {
    console.error(chalk.red(`Name what to explain — plitzi explain container — or list a kind: --list ${kinds}.`));
    process.exitCode = 1;

    return;
  }

  const explanations = explain(name);
  if (explanations.length === 0) {
    console.error(
      chalk.red(`"${name}" is no element, step, trigger, code or transformer. See what there is: --list ${kinds}.`)
    );
    process.exitCode = 1;

    return;
  }

  console.log(options.json ? JSON.stringify(explanations) : explanations.map(explanationText).join('\n\n'));
};
