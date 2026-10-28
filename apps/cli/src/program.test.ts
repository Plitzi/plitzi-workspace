import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { buildProgram } from './program';
import { projectScripts } from './scaffold/project';

import type { Command } from 'commander';

/**
 * Every `plitzi …` the CLI tells someone to run — in its skills, in an agent's prompt, in a refusal's way out — is a
 * command this CLI has, with options it takes: a run's prompt said `task complete --follow --take`, and three agents
 * were refused four times before anyone read the notices (`run view`, `--token` in a lead's hand-off, the same story).
 */

const SRC = import.meta.dirname;
const SKILLS = [path.join(SRC, '../skills'), path.join(SRC, '../../../packages/sdk-authoring/skills')];

/** The workspace's pages on the CLI's agents and tools, for whoever works on it. */
const DOCS = ['agent-runs.md', 'agent-tooling.md'].map(file => path.join(SRC, '../../../docs/en', file));

const filesUnder = (dir: string, ext: RegExp): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const at = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return ['node_modules', 'dist', 'tests'].includes(entry.name) ? [] : filesUnder(at, ext);
    }

    return ext.test(entry.name) && !/\.test\.ts$/.test(entry.name) ? [at] : [];
  });

/** Where a skill writes a command: its code — inline and fenced — never its prose. */
const codeOfMarkdown = (text: string): string[] => [
  ...[...text.matchAll(/```[\w-]*\n([\s\S]*?)```/g)].map(match => match[1]),
  ...[...text.replace(/```[\s\S]*?```/g, '').matchAll(/`([^`\n]+)`/g)].map(match => match[1])
];

/** What a template fills in, in the strings read: a word of the command, never one of its options. */
const FILLED = '¶';

/** What the code says to someone: its strings, a template's parts joined by a stand-in for what it fills in. */
const stringsOfSource = (file: string): string[] => {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf-8'), ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      found.push(node.text);
    } else if (ts.isTemplateExpression(node)) {
      found.push([node.head.text, ...node.templateSpans.map(span => `${FILLED}${span.literal.text}`)].join(''));
    }

    ts.forEachChild(node, visit);
  };
  visit(source);

  return found;
};

const program = buildProgram();

const subcommand = (from: Command, name: string): Command | undefined =>
  from.commands.find(each => each.name() === name || each.aliases().includes(name));

/** What is wrong with one `plitzi …` as written: its command, then its options — nothing when the CLI takes it. */
const problemsOf = (words: string, rest: string): string[] => {
  let command = program;
  const said = words.split(' ');
  let used = 0;
  for (const word of said) {
    const next = subcommand(command, word);
    if (!next) {
      break;
    }

    command = next;
    used += 1;
  }

  const name = ['plitzi', ...said.slice(0, used)].join(' ');
  if (used === 0) {
    return [`plitzi ${said[0]} is no command`];
  }

  // A group named alone is a way to its commands; one named with a word that is none of them is a command it has not.
  if (command.commands.length > 0) {
    return used < said.length ? [`${name} has no command ${said[used]}`] : [];
  }

  const options = new Set([
    '--help',
    '-h',
    ...command.options.flatMap(option => [option.long, option.short].filter(each => each !== undefined))
  ]);
  const written = `${said.slice(used).join(' ')} ${rest}`.replace(/¶|[[\]]/g, ' ');

  return (written.match(/(?<![^\s])--?[a-zA-Z][\w-]*/g) ?? [])
    .filter(option => !options.has(option))
    .map(option => `${name} has no ${option}`);
};

/**
 * A command written in a text, up to where the text goes on in words: a quote, a dash, a comma, the line's end. `PLITZI`
 * is how an agent's prompt writes its own CLI before its path is put in.
 */
const COMMAND =
  /(?<![\w./@-])(?:plitzi|PLITZI) ([a-z][\w-]*(?: [a-z][\w-]*){0,2})((?:[^`'"“”—;|),\n]|,(?=\S)|"[^"\n]*"|\|(?=\s*--))*)/g;

/** The groups of commands — `task`, `run`, `page`… — a text may name a command of without `plitzi` before it. */
const GROUPS = new Set(program.commands.filter(each => each.commands.length > 0).map(each => each.name()));

/**
 * A command of a group written without `plitzi` before it — `task check --fix`, `run open --dry-run` — read as one when
 * its group has that command: prose that only starts with the word (`a task next to it`) is not.
 */
const BARE_COMMAND =
  /(?<![\w./@-])(?=([a-z][\w-]*) ([a-z][\w-]*)((?:[^`'"“”—;|),\n]|,(?=\S)|"[^"\n]*"|\|(?=\s*--))*))/g;

/**
 * The commands a text names, each as the words before its options and what follows them. A group's two words at the
 * start of code — a span of a skill (`code`), or after a backtick in a string — are a command whether the group has it or
 * not: a prompt told agents never to run `run purge` after it was gone, read as prose.
 */
const commandsIn = (
  text: string,
  { code = false }: { code?: boolean } = {}
): { at: number; length: number; words: string; rest: string; said: string }[] => {
  const prefixed = [...text.matchAll(COMMAND)]
    .filter(match => !NOT_COMMANDS.has(match[0].trim()))
    .map(match => ({ at: match.index, length: match[0].length, words: match[1], rest: match[2], said: match[0] }));
  const covered = (at: number): boolean => prefixed.some(each => at >= each.at && at < each.at + each.length);
  const bare = [...text.matchAll(BARE_COMMAND)]
    .filter(match => {
      const group = GROUPS.has(match[1]) ? subcommand(program, match[1]) : undefined;

      const startsCode = text[match.index - 1] === '`' || (code && match.index === 0);

      return group !== undefined && (startsCode || subcommand(group, match[2]) !== undefined) && !covered(match.index);
    })
    .map(match => {
      // Its options end where a command written in full starts: `run watch says so: plitzi task next --role lead`.
      const next = prefixed.find(each => each.at > match.index)?.at ?? Number.POSITIVE_INFINITY;
      const said = `${match[1]} ${match[2]}${match[3]}`.slice(0, Math.max(0, next - match.index));
      const words = `${match[1]} ${match[2]}`;

      return { at: match.index, length: said.length, words, rest: said.slice(words.length), said };
    });

  return [...prefixed, ...bare];
};

/**
 * Written like a command and none: `decided.ts` keeps why there is no `plitzi link`, and the agent's prompt names its CLI
 * `PLITZI` ("PLITZI below") before it writes any command with it.
 */
const NOT_COMMANDS = new Set(['plitzi link', 'PLITZI below']);

const problemsIn = (texts: readonly string[], where: string, { code = false }: { code?: boolean } = {}): string[] =>
  texts.flatMap(text =>
    commandsIn(text, { code }).flatMap(command =>
      problemsOf(command.words, command.rest).map(
        problem => `${where}: ${problem} — “${command.said.trim().slice(0, 100)}”`
      )
    )
  );

/** Another program's command — the project's linter, formatter, test runner — whose options are its own. */
const OTHER_TOOLS = /(?<![\w./@-])(?:eslint|prettier|node|npx|npm|playwright|vitest|tsc)\b[^`'"“”—;|),\n]*/g;

/** What every command of a run takes — who calls (`--token`, `--agent`): an option of each, named by none. */
const EVERY_RUN_COMMANDS = (() => {
  const leaves = ['task', 'run'].flatMap(group => subcommand(program, group)?.commands ?? []);
  const each = leaves.map(
    command => new Set(command.options.flatMap(option => (option.long === undefined ? [] : [option.long])))
  );

  return new Set([...(each[0] ?? [])].filter(option => each.every(options => options.has(option))));
})();

/**
 * The options a text names with no command before them — `wait for it (--follow)` — which no check can hold to a command.
 * A string that is one option alone (`'--width'`, `'--expect='`) is code reading arguments, not a text.
 */
const bareOptionsIn = (text: string): string[] => {
  // Put onto a command in the code (`--skip-design reviewer`, `--approve --merge`): the command that says it is checked.
  if (/^\s*--[a-z]/.test(text)) {
    return [];
  }

  const spans = [
    ...commandsIn(text),
    ...[...text.matchAll(OTHER_TOOLS)].map(match => ({ at: match.index, length: match[0].length }))
  ];
  const named = (at: number): boolean => spans.some(each => at >= each.at && at < each.at + each.length);

  return (
    [...text.matchAll(/(?<![\w-])--[a-z][\w-]*/g)]
      // `${command} --friction "…"`: the command is filled in by the code, the option put right after it.
      .filter(
        match =>
          !named(match.index) && !EVERY_RUN_COMMANDS.has(match[0]) && !text.slice(0, match.index).endsWith(`${FILLED} `)
      )
      .map(match => match[0])
  );
};

/** A skill's sections: from a heading to the next, its code blocks and tables in it. */
const sectionsOf = (markdown: string): string[] => markdown.split(/\n(?=#+ )/).filter(each => each.trim() !== '');

/** The command a run of words names, as far as the CLI has one — `task review t-home` is `task review`. */
const commandOf = (words: string): Command | undefined => {
  let command = program;
  for (const word of words.split(' ')) {
    const next = subcommand(command, word);
    if (!next) {
      break;
    }

    command = next;
  }

  return command === program ? undefined : command;
};

const longOptions = (command: Command | undefined): string[] =>
  command?.options.flatMap(option => (option.long === undefined ? [] : [option.long])) ?? [];

/**
 * A project's scripts that run this CLI, by name — `check` is `plitzi page check` — as every kind of project has them: a
 * skill writes `check -- /path --width 390` for `npm run check -- …`.
 */
const SCRIPTS = new Map(
  (['server', 'client'] as const).flatMap(mode =>
    (['local', 'cloud'] as const).flatMap(source =>
      Object.entries(
        projectScripts({ name: 'x', mode, source, key: '', environment: '', packageManager: 'npm' })
      ).flatMap(([name, run]) => (run.startsWith('plitzi ') ? [[name, run] as const] : []))
    )
  )
);

/** Options so many commands take — `--json` — that a skill says them of any. */
const COMMON_OPTIONS = (() => {
  const leaves = (command: Command): Command[] =>
    command.commands.length === 0 ? [command] : command.commands.flatMap(leaves);
  const all = program.commands.flatMap(leaves);
  const counts = new Map<string, number>();
  for (const option of all.flatMap(command => longOptions(command))) {
    counts.set(option, (counts.get(option) ?? 0) + 1);
  }

  return new Set([...counts].filter(([, count]) => count * 2 >= all.length).map(([option]) => option));
})();

/**
 * The options of a skill's section, in its code, that no command the section names takes — a span that starts with
 * a command (`create --from <space>`, `whoami --json`) names it as `plitzi …` would. A CSS custom property
 * (`var(--accent)`, `--x: 4px`) is no option.
 */
const strayOptionsIn = (paragraph: string): string[] => {
  const code = codeOfMarkdown(paragraph).map(span => {
    const first = /^\s*([a-z][\w-]*)/.exec(span)?.[1];
    const script = /^\s*([\w:-]+) -- /.exec(span);
    const run = script ? SCRIPTS.get(script[1]) : undefined;
    if (script && run) {
      return `${run} ${span.slice(script[0].length)}`;
    }

    return first !== undefined && subcommand(program, first) && !/^\s*plitzi /.test(span) ? `plitzi ${span}` : span;
  });
  const taken = new Set(
    [...commandsIn(paragraph), ...code.flatMap(span => commandsIn(span))].flatMap(each =>
      longOptions(commandOf(each.words))
    )
  );
  const unnamed = (text: string): string[] => {
    const spans = [
      ...commandsIn(text),
      ...[...text.matchAll(OTHER_TOOLS)].map(match => ({ at: match.index, length: match[0].length }))
    ];

    // `-- --verbose`: what a script passes on to the program it runs, not an option of this CLI.
    return [...text.matchAll(/(?<![\w(-]|-- )--[a-z][\w-]*(?!\s*:)/g)]
      .filter(match => !spans.some(each => match.index >= each.at && match.index < each.at + each.length))
      .map(match => match[0]);
  };

  return [
    ...new Set(
      code
        .flatMap(unnamed)
        .filter(
          option =>
            !taken.has(option) && !EVERY_RUN_COMMANDS.has(option) && !COMMON_OPTIONS.has(option) && option !== '--help'
        )
    )
  ];
};

describe('the commands the CLI tells anyone to run', () => {
  // Its README too, and the workspace's pages on the runs: a renamed command lived on there, read by people and agents.
  it('are in its skills, its README and the docs of its runs as it takes them', () => {
    const problems = [
      ...SKILLS.flatMap(dir => filesUnder(dir, /\.md$/)),
      path.join(SRC, '../README.md'),
      ...DOCS
    ].flatMap(file =>
      problemsIn(codeOfMarkdown(fs.readFileSync(file, 'utf-8')), path.relative(SRC, file), { code: true })
    );

    expect(problems).toEqual([]);
  });

  it('are in what it says — prompts, refusals, their ways out — as it takes them', () => {
    const problems = filesUnder(SRC, /\.ts$/).flatMap(file =>
      problemsIn(stringsOfSource(file), path.relative(SRC, file))
    );

    expect(problems).toEqual([]);
  });

  // A skill says an option beside its command, in prose (`plitzi task tell "…" --ask` — `--follow` waits for the answer):
  // within its budget, the option is held to the commands its section names — one of them takes it.
  it('take, in their skills, each option a section tells of', () => {
    const problems = SKILLS.slice(0, 1).flatMap(dir =>
      filesUnder(dir, /\.md$/).flatMap(file =>
        sectionsOf(fs.readFileSync(file, 'utf-8')).flatMap(paragraph =>
          strayOptionsIn(paragraph).map(
            option => `${path.relative(SRC, file)}: ${option} — “${paragraph.trim().slice(0, 100)}”`
          )
        )
      )
    );

    expect(problems).toEqual([]);
  });

  // `task next` lost `--follow`, and five of its waits went on saying "(--follow)": an option with no command before it is
  // no command's to check. What the run's library says is shown by many commands: it names the one it means.
  it('name the command of every option the run’s texts tell of', () => {
    const problems = filesUnder(path.join(SRC, 'runs'), /\.ts$/).flatMap(file =>
      stringsOfSource(file).flatMap(text =>
        bareOptionsIn(text).map(option => `${path.relative(SRC, file)}: ${option} — “${text.trim().slice(0, 100)}”`)
      )
    );

    expect(problems).toEqual([]);
  });

  it('tells a command it does not have, and an option a command does not take', () => {
    expect(problemsIn(['then `plitzi task complete --follow --take`'], 'prompt')).toEqual([
      'prompt: plitzi task complete has no --follow — “plitzi task complete --follow --take”',
      'prompt: plitzi task complete has no --take — “plitzi task complete --follow --take”'
    ]);
    expect(problemsIn(['a stage reads plitzi run view'], 'skill')).toEqual([
      'skill: plitzi run has no command view — “plitzi run view”'
    ]);
    expect(problemsIn(['plitzi run team set dev --count 3 --min 1'], 'skill')).toEqual([]);
    expect(problemsIn(['then task check --fix, or task next --follow'], 'refusal')).toEqual([
      'refusal: plitzi task next has no --follow — “task next --follow”'
    ]);
    expect(problemsIn(['plitzi task review t-a --approve | --follow'], 'hint')).toEqual([
      'hint: plitzi task review has no --follow — “plitzi task review t-a --approve | --follow”'
    ]);
    expect(bareOptionsIn('wait for it (--follow)')).toEqual(['--follow']);
    expect(bareOptionsIn('wait: plitzi task next --no-wait answers now')).toEqual([]);
    expect(bareOptionsIn('--expect=')).toEqual([]);
  });
});

// `page outline --width 390,1440` and `page shot --scheme light,dark` were refused four times, where check,
// measure and play take a list.
describe('the page commands', () => {
  const page = subcommand(program, 'page');
  const optionOf = (command: string, flag: string) =>
    subcommand(page ?? program, command)?.options.find(option => option.long === flag);

  it('take a list of widths, and shot a list of schemes', () => {
    expect(optionOf('outline', '--width')?.parseArg?.('390,1440', undefined)).toEqual([390, 1440]);
    expect(optionOf('shot', '--scheme')?.parseArg?.('light,dark', undefined)).toEqual(['light', 'dark']);
  });
});
