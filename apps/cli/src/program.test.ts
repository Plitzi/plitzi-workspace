import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { buildProgram } from './program';

import type { Command } from 'commander';

/**
 * Every `plitzi …` the CLI tells someone to run — in its skills, in an agent's prompt, in a refusal's way out — is a
 * command this CLI has, with options it takes: encore's prompt said `task complete --follow --take`, and three agents
 * were refused four times before anyone read the notices (`run view`, `--token` in a lead's hand-off, the same story).
 */

const SRC = import.meta.dirname;
const SKILLS = [path.join(SRC, '../skills'), path.join(SRC, '../../../packages/sdk-authoring/skills')];

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
const COMMAND = /(?<![\w./@-])(?:plitzi|PLITZI) ([a-z][\w-]*(?: [a-z][\w-]*){0,2})([^`'"“”—;|),\n]*)/g;

/**
 * Written like a command and none: `decided.ts` keeps why there is no `plitzi link`, and the agent's prompt names its CLI
 * `PLITZI` ("PLITZI below") before it writes any command with it.
 */
const NOT_COMMANDS = new Set(['plitzi link', 'PLITZI below']);

const problemsIn = (texts: readonly string[], where: string): string[] =>
  texts.flatMap(text =>
    [...text.matchAll(COMMAND)]
      .filter(match => !NOT_COMMANDS.has(match[0].trim()))
      .flatMap(match =>
        problemsOf(match[1], match[2]).map(problem => `${where}: ${problem} — “${match[0].trim().slice(0, 100)}”`)
      )
  );

describe('the commands the CLI tells anyone to run', () => {
  it('are in its skills as it takes them', () => {
    const problems = SKILLS.flatMap(dir =>
      filesUnder(dir, /\.md$/).flatMap(file =>
        problemsIn(codeOfMarkdown(fs.readFileSync(file, 'utf-8')), path.relative(SRC, file))
      )
    );

    expect(problems).toEqual([]);
  });

  it('are in what it says — prompts, refusals, their ways out — as it takes them', () => {
    const problems = filesUnder(SRC, /\.ts$/).flatMap(file =>
      problemsIn(stringsOfSource(file), path.relative(SRC, file))
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
  });
});
