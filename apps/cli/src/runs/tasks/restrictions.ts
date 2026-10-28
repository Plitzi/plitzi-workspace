import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { exists } from '../core/files';

/**
 * What the project's lint forbids in a task's files, with the words its config gives — read from the config ESLint
 * resolves for them (`--print-config`), so a task knows it before `task check` says it: a run's developer learnt at lint
 * that the project's specs take `test` from `./offline`, the message saying why, after its spec was written.
 */

/** The kinds of a task's files read at most: one file a folder and suffix stands for the rest. */
const KINDS = 4;

/** A file's kind: its folder and its suffix — `visual/*.spec.ts`. */
const kindOf = (file: string): string => {
  const base = path.posix.basename(file);
  const suffix = /(\.[a-z]+)?\.[cm]?[jt]sx?$/.exec(base)?.[0] ?? path.posix.extname(base);

  return `${path.posix.dirname(file)}/*${suffix}`;
};

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((each): each is string => typeof each === 'string') : [];

const said = (what: string, message: unknown): string =>
  typeof message === 'string' && message !== '' ? `${what} — ${message}` : what;

/** Each restriction a rule's options name, as a line says it. */
const ruleLines = (rule: string, options: readonly unknown[]): string[] =>
  options.flatMap(option => {
    if (rule === 'no-restricted-imports') {
      if (typeof option === 'string') {
        return [`no import from '${option}'`];
      }

      const paths = isRecord(option) ? (Array.isArray(option.paths) ? option.paths : []) : [option];
      const patterns = isRecord(option) && Array.isArray(option.patterns) ? option.patterns : [];

      return [
        ...paths.flatMap(each =>
          typeof each === 'string'
            ? [`no import from '${each}'`]
            : isRecord(each) && typeof each.name === 'string'
              ? [
                  said(
                    `no ${strings(each.importNames).length > 0 ? `{ ${strings(each.importNames).join(', ')} } ` : ''}import from '${each.name}'`,
                    each.message
                  )
                ]
              : []
        ),
        ...patterns.flatMap(each =>
          typeof each === 'string'
            ? [`no import from ${each}`]
            : isRecord(each)
              ? [said(`no import from ${[...strings(each.group), ...strings([each.regex])].join(', ')}`, each.message)]
              : []
        )
      ];
    }

    if (rule === 'no-restricted-syntax') {
      return typeof option === 'string'
        ? [`no ${option}`]
        : isRecord(option) && typeof option.selector === 'string'
          ? [said(`no ${option.selector}`, option.message)]
          : [];
    }

    if (rule === 'no-restricted-globals') {
      return typeof option === 'string'
        ? [`no global ${option}`]
        : isRecord(option) && typeof option.name === 'string'
          ? [said(`no global ${option.name}`, option.message)]
          : [];
    }

    return isRecord(option) && typeof option.object === 'string'
      ? [said(`no ${option.object}${typeof option.property === 'string' ? `.${option.property}` : ''}`, option.message)]
      : [];
  });

const RULES = ['no-restricted-imports', 'no-restricted-syntax', 'no-restricted-globals', 'no-restricted-properties'];

/** What a resolved config forbids, a line each — its rules switched off left out. */
export const restrictionsOf = (config: unknown): string[] => {
  const rules = isRecord(config) && isRecord(config.rules) ? config.rules : {};

  return RULES.flatMap(rule => {
    const setting: unknown = rules[rule];
    const list: unknown[] = Array.isArray(setting) ? setting : [setting];
    const [severity, ...options] = list;

    return severity === 0 || severity === 'off' || severity === undefined ? [] : ruleLines(rule, options);
  });
};

/**
 * What the project's lint forbids in `files`, each line with the kinds of file it holds for — none where the project has
 * no ESLint, or it cannot say (a config that does not load is `task check`'s to say).
 */
export const restrictionsOn = async (root: string, files: readonly string[]): Promise<string[]> => {
  const eslint = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'eslint.cmd' : 'eslint');
  if (files.length === 0 || !(await exists(eslint))) {
    return [];
  }

  const kinds = new Map<string, string>();
  for (const file of files) {
    if (kinds.size < KINDS && !kinds.has(kindOf(file))) {
      kinds.set(kindOf(file), file);
    }
  }

  const held = new Map<string, string[]>();
  for (const [kind, file] of kinds) {
    const printed = await promisify(execFile)(eslint, ['--print-config', file], {
      cwd: root,
      timeout: 15_000,
      shell: process.platform === 'win32'
    }).catch(() => undefined);
    let config: unknown;
    try {
      config = printed === undefined ? undefined : JSON.parse(printed.stdout);
    } catch {
      config = undefined;
    }

    for (const line of restrictionsOf(config)) {
      held.set(line, [...(held.get(line) ?? []), kind]);
    }
  }

  return [...held].map(([line, where]) => `${where.join(', ')}: ${line}`);
};
