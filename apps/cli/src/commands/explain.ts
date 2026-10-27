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
import { SCHEMA_SETTINGS } from '@plitzi/sdk-shared/schema';

import { apiDeclarations, apiIndex, apiText, memberDeclarations } from './apiDeclarations';
import { findProject } from './existingProject';
import { actionText, projectActions } from './projectActions';
import { pluginText, projectPlugins } from './projectPlugins';
import { serverTasks, serverTaskText } from './serverTasks';
import { skillPassages, skillsMentions } from './skillsMentions';
import { fail } from './terminal';
import { LINT_RULES } from '../lint/catalog';

import type { ApiExplanation, ApiIndexEntry } from './apiDeclarations';
import type { SkillPassage } from './skillsMentions';
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
  limit = 10,
  /** The skills' passages, a project's: what its references teach, answered beside the catalogues. */
  passages: readonly SkillPassage[] = [],
  /** A member of what the project's code is handed, by its name — `ctx.later` — as the installed types declare it. */
  memberOf: (name: string) => readonly ApiExplanation[] = () => [],
  /** The authoring package's exports, types among them (`BindingSpec`), found by their names' words and their docs. */
  exported: readonly ApiIndexEntry[] = []
): (Omit<SearchHit, 'score'> | { kind: 'command' | 'code' | 'skill' | 'api'; name: string; summary: string })[] => {
  // A member named in the words is answered first: a run's "ctx.later" was searched for five times and found every
  // passage that said "later", never the member.
  const members = (words.match(/\b[\w$]+\.[\w$]+\b/g) ?? []).flatMap(name =>
    memberOf(name).map(each => ({ kind: each.kind, name: each.name, summary: each.summary }))
  );
  const asked = [...new Set(searchWords(words))];
  const own = [
    ...commandsOf(commands).map(each => ({ kind: 'command' as const, ...each })),
    ...[...CHECK_CODES.values()].map(code => ({ kind: 'code' as const, name: code.name, summary: code.means })),
    // A type found by the words of its name (`binding spec`) and its doc: its name split as it is read.
    ...exported.map(each => ({
      kind: 'api' as const,
      name: each.name,
      summary: `${each.of === 'type' ? 'a type' : 'an export'} of @plitzi/sdk-authoring — ${each.summary}`,
      title: each.name.replace(/([a-z0-9])([A-Z])/g, '$1 $2'),
      scored: each.summary
    })),
    // A passage is found by what it says, never by where it is: its file's name would match every word of a path.
    ...passages.map(each => ({
      kind: each.kind,
      name: each.name,
      summary: each.summary,
      title: each.title,
      scored: each.text
    }))
  ];
  const ranked = [
    ...explainSearch(words, limit).map(({ score, ...hit }) => ({ hit, score })),
    ...own
      .map(hit => ({
        hit: 'scored' in hit ? { kind: hit.kind, name: hit.name, summary: hit.summary } : hit,
        score: 'scored' in hit ? searchScore(asked, hit.title, hit.scored) : searchScore(asked, hit.name, hit.summary)
      }))
      .filter(each => each.score > 0)
  ];

  // Of two that hold as many words, what the skills teach first — a passage says how, a catalogue's line what it is.
  const taught = (hit: { kind: string }): number => (hit.kind === 'skill' ? 0 : 1);

  return [
    ...members,
    ...ranked
      .sort((a, b) => b.score - a.score || taught(a.hit) - taught(b.hit) || a.hit.name.localeCompare(b.hit.name))
      .map(each => each.hit)
  ].slice(0, limit);
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

/** A name as the words a search reads: `keepState` → `keep state`, `page-play` → `page play`. */
export const wordsOfName = (name: string): string =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_.]+/g, ' ')
    .toLowerCase()
    .trim();

export const explainCommand = async (
  name: string | undefined,
  options: ExplainOptions,
  commands: readonly Command[] = []
): Promise<void> => {
  // Several words are what something is described by, best first — a name is one word (`explain "carousel end"`).
  const words = name !== undefined && /\s/.test(name.trim()) ? name.trim() : undefined;
  if (words !== undefined) {
    const project = await findProject(process.cwd());
    const root = project?.root ?? process.cwd();
    const hits = searchAll(
      words,
      commands,
      10,
      skillPassages(root),
      each => memberDeclarations(root, each),
      apiIndex(root)
    );
    if (hits.length === 0) {
      fail(
        `Nothing Plitzi has is described by "${words}" — other words, or what there is: --list ${kinds}, tasks. Something Plitzi should have: say it (plitzi run notice --plitzi "…", in a run).`
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

  // The authoring package's types, by name, as the project installed it: what a helper of the project's own is typed by.
  if (options.list === 'types') {
    const project = await findProject(process.cwd());
    const types = apiIndex(project?.root ?? process.cwd()).filter(each => each.of === 'type');
    console.log(
      options.json
        ? JSON.stringify(types.map(({ name, summary }) => ({ name, summary })))
        : types.map(each => `${each.name.padEnd(32)} ${chalk.dim(each.summary)}`).join('\n')
    );

    return;
  }

  if (options.list !== undefined) {
    const kind = explainKindOf(options.list);
    if (!kind) {
      fail(
        `--list takes ${kinds}, tasks (a server action's steps), types (the authoring package's), not "${options.list}".`
      );

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

    // Not a name the catalogues hold: an export of a @plitzi package, read from the types the project installed — or a
    // member of one (`ctx.later`, or `later` when no export has the name).
    const exported = name.includes('.') ? [] : apiDeclarations(process.cwd(), name);
    const api = exported.length > 0 ? exported : memberDeclarations(process.cwd(), name);
    if (api.length > 0) {
      const taught = skillsMentions(project?.root ?? process.cwd(), name);
      console.log(
        options.json
          ? JSON.stringify(api.map(each => ({ ...each, ...(taught.length > 0 ? { skills: taught } : {}) })))
          : [
              api.map(apiText).join('\n\n'),
              ...(taught.length > 0
                ? [
                    'Where the skills teach it:',
                    ...taught.map(each => `  ${each.file}:${String(each.line)} — ${each.text}`)
                  ]
                : [])
            ].join('\n')
      );

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

    // An action of the project's own, by its id: what runs it, with what input, its steps — a run's designer read the
    // project's data and functions by hand to find who may run `host-close`.
    const actions = project ? await projectActions(project.root) : { actions: [] };
    const action = 'actions' in actions ? actions.actions.find(each => each.id === name) : undefined;
    if (action) {
      console.log(options.json ? JSON.stringify([action]) : actionText(action));

      return;
    }

    // A setting of the whole space (`settings.keepState`): said as one, with where the skills teach it — a run's
    // `explain keepState` was "no name", three times.
    if ((SCHEMA_SETTINGS as readonly string[]).includes(name)) {
      const taught = skillsMentions(project?.root ?? process.cwd(), name);
      console.log(
        options.json
          ? JSON.stringify([{ kind: 'setting', name, skills: taught }])
          : [
              `${name} — a setting of the whole space: \`settings: { ${name}: … }\` in the space's spec, never a page's.`,
              ...(taught.length > 0
                ? [
                    'Where the skills teach it:',
                    ...taught.map(each => `  ${each.file}:${String(each.line)} — ${each.text}`)
                  ]
                : [])
            ].join('\n')
      );

      return;
    }

    // No name: what its words describe, as several words are answered — a run's `explain active`, `explain keepState`,
    // `explain icon` each failed, nine times, where a search found the passage that teaches it.
    const described = searchAll(
      wordsOfName(name),
      commands,
      5,
      skillPassages(project?.root ?? process.cwd()),
      each => memberDeclarations(project?.root ?? process.cwd(), each),
      apiIndex(project?.root ?? process.cwd())
    );
    if (described.length > 0) {
      console.log(
        options.json
          ? JSON.stringify({ name, unknown: true, described })
          : [
              chalk.yellow(`"${name}" is no name Plitzi has — what the words describe:`),
              ...('problem' in actions
                ? [chalk.dim(`  (the project's actions could not be read: ${actions.problem})`)]
                : []),
              ...described.map(hit => `${hit.name.padEnd(36)} ${chalk.dim(`${hit.kind} — ${hit.summary}`)}`),
              chalk.dim(
                `Each said whole: plitzi explain <name>${/\s/.test(wordsOfName(name)) ? `; more: plitzi explain "${wordsOfName(name)}"` : ''}`
              )
            ].join('\n')
      );

      return;
    }

    fail(
      [
        `"${name}" is no element, step, trigger, code, transformer, helper, template filter, template function or global source, no step of a server action, no action of the project, nor an export of a @plitzi package installed here, and no passage of the skills says it. See what there is: --list ${kinds}, tasks.`,
        ...('problem' in actions ? [`The project's actions could not be read: ${actions.problem}`] : []),
        `A name of the project's own code is read where it is written: \`grep -rn "${name}" src/\`.`
      ].join('\n')
    );

    return;
  }

  console.log(options.json ? JSON.stringify(explanations) : explanations.map(textOf).join('\n\n'));
};
