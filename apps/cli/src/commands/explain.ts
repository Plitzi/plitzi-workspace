import chalk from 'chalk';

import { EXPLAIN_KINDS, explain, explainKindOf, explainList, explanationText } from '@plitzi/sdk-authoring';
import { PROJECT_LAYOUT_CODES } from '@plitzi/sdk-shared/project/layout';

import { apiDeclaration, apiText } from './apiDeclarations';
import { fail } from './terminal';
import { LINT_RULES } from '../lint/catalog';

import type { Explanation } from '@plitzi/sdk-authoring';

/**
 * `plitzi explain <name>`: what a name means when authoring a space — an element, a step, a trigger, a problem's code,
 * a transformer, a helper (`bindTemplate`, `scope`, `motion`…) — in a few lines, from the catalogues the checks
 * themselves read; any other export of `@plitzi/sdk-authoring` (`pageFamily`, `SpaceSpec`) by its published declaration. A code is any check's: authoring's, `plitzi lint`'s own rules (`LINT_RULES`) and the project's
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
  checkedBy: 'plitzi lint' | 'the project layout';
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
      checkedBy: 'plitzi lint'
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

export const explainCommand = (name: string | undefined, options: ExplainOptions): void => {
  if (options.list !== undefined) {
    const kind = explainKindOf(options.list);
    if (!kind) {
      fail(`--list takes ${kinds}, not "${options.list}".`);

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
    // Not a name the catalogues hold: an export of the authoring package, read from the types the project installed.
    const api = apiDeclaration(process.cwd(), name);
    if (api) {
      console.log(options.json ? JSON.stringify([api]) : apiText(api));

      return;
    }

    fail(
      `"${name}" is no element, step, trigger, code, transformer, helper or export of @plitzi/sdk-authoring. See what there is: --list ${kinds}.`
    );

    return;
  }

  console.log(options.json ? JSON.stringify(explanations) : explanations.map(textOf).join('\n\n'));
};
