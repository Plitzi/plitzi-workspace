import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { sayer } from './types';
import { SERVER_OPTIONS_FILE } from '../scaffold/paths';

import type { Finding } from './types';
import type { TSpaceRuns } from '@plitzi/sdk-shared/network';

/**
 * What `src/config/serverOptions.ts` asks of the project's own server that the server hosting its space does not do:
 * there the host's own options apply, and a run is held to its plan (`TSpaceRuns`). A project that only passed on its
 * own server finds each of them in production, one per push — said here, with the value it gets there.
 */

const say = sayer('plan');

const numberAt = (value: unknown, ...keys: string[]): number | undefined => {
  let at: unknown = value;
  for (const key of keys) {
    at = isRecord(at) ? at[key] : undefined;
  }

  return typeof at === 'number' ? at : undefined;
};

/** What a server answered of a run's budget, checked: a field it has not got, or not a number, is a server that does not say. */
export const isSpaceRuns = (value: unknown): value is TSpaceRuns =>
  typeof numberAt(value, 'sectionMs') === 'number' &&
  ['timeoutMs', 'maxRequests'].every(key => typeof numberAt(value, 'action', key) === 'number') &&
  ['cpuMs', 'wallMs', 'memoryMb', 'outputBytes', 'calls'].every(
    key => typeof numberAt(value, 'functions', key) === 'number'
  );

/** The options the file exports, when it can be read; what it threw, when it cannot. */
const readOptions = async (root: string): Promise<{ options?: Record<string, unknown>; error?: string }> => {
  try {
    const module: unknown = await import(pathToFileURL(path.join(root, SERVER_OPTIONS_FILE)).href);
    const options = isRecord(module) ? module.serverOptions : undefined;

    return isRecord(options) ? { options } : {};
  } catch (error) {
    const code = isRecord(error) ? error.code : undefined;

    return code === 'ERR_MODULE_NOT_FOUND' ? {} : { error: error instanceof Error ? error.message : String(error) };
  }
};

type Budget = { option: string; asked: number | undefined; there: number; unit: string; without: string };

/** The options that only shape this project's own server, said apart: the host serves with its own. */
const HOST_OWN = ['images', 'devMode', 'livePages', 'onListening', 'compression', 'cacheTtlMs', 'streaming', 'workers'];

export const hostedOptionsFindings = async (root: string, spaceName: string, runs: TSpaceRuns): Promise<Finding[]> => {
  const { options, error } = await readOptions(root);
  if (error) {
    return [
      say.info(
        'server-options-not-read',
        `${SERVER_OPTIONS_FILE} could not be read (${error}): what of it the server hosting ${spaceName} does not do is not checked.`,
        { file: SERVER_OPTIONS_FILE }
      )
    ];
  }

  if (!options) {
    return [];
  }

  const budgets: Budget[] = [
    {
      option: 'rsc.elementTimeoutMs',
      asked: numberAt(options, 'rsc', 'elementTimeoutMs'),
      there: runs.sectionMs,
      unit: 'ms',
      without: 'a section whose provider takes longer arrives empty there — read it from what a schedule keeps (`kv`)'
    },
    {
      option: 'action.limits.timeoutMs',
      asked: numberAt(options, 'action', 'limits', 'timeoutMs'),
      there: runs.action.timeoutMs,
      unit: 'ms',
      without: 'a run that takes longer is stopped there'
    },
    {
      option: 'action.limits.maxRequests',
      asked: numberAt(options, 'action', 'limits', 'maxRequests'),
      there: runs.action.maxRequests,
      unit: 'requests',
      without: 'the request past it is refused there'
    },
    ...(['cpuMs', 'wallMs', 'memoryMb', 'outputBytes', 'calls'] as const).map(limit => ({
      option: `functions.limits.${limit}`,
      asked: numberAt(options, 'functions', 'limits', limit),
      there: runs.functions[limit],
      unit: limit === 'calls' ? 'calls' : limit === 'memoryMb' ? 'MB' : limit === 'outputBytes' ? 'bytes' : 'ms',
      without: 'an invocation that needs more is stopped there'
    }))
  ];
  const findings: Finding[] = budgets
    .filter(({ asked, there }) => asked !== undefined && asked > there)
    .map(({ option, asked, there, unit, without }) =>
      say.warning(
        'server-option-above-host',
        `${SERVER_OPTIONS_FILE} sets ${option} to ${String(asked)} ${unit}, and the server hosting ${spaceName} gives ${String(there)}: ${without}.`,
        { file: SERVER_OPTIONS_FILE }
      )
    );
  const ownOnly = HOST_OWN.filter(option => Object.hasOwn(options, option));
  if (ownOnly.length > 0) {
    findings.push(
      say.info(
        'server-options-own-only',
        `${SERVER_OPTIONS_FILE} sets ${ownOnly.map(option => `\`${option}\``).join(', ')}: this project's own server's, which the server hosting ${spaceName} does not take — it serves with its own.`,
        { file: SERVER_OPTIONS_FILE }
      )
    );
  }

  return findings;
};
