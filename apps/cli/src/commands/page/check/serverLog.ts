import fs from 'node:fs/promises';

import { isNotice } from '../../project/verify';

import type { CheckIssue } from './types';

/** A line a server logs that says something failed: a provider that did not resolve, an error, an exception. */
const FAILING = /\b(?:error|errors|failed|failure|exception|unhandled)\b/i;
/** How many of them a finding quotes: the rest are in the log it names. */
const QUOTED = 5;

/** How far a server's log is written now: what comes after it is what a command's pages made the server say. */
export const logMark = async (log: string | undefined): Promise<number | undefined> =>
  log === undefined ? undefined : ((await fs.stat(log).catch(() => undefined))?.size ?? 0);

/**
 * What the server logged as failed while a command's pages were opened, as a finding of the page: a provider that
 * failed on every render was a line in a log nobody read — a run's tester started a server of its own to read it,
 * and its line ("no '[RSC] element dmThread' line") had no command to hold it.
 */
export const serverLoggedIssues = async (
  log: string | undefined,
  from: number | undefined,
  width: number
): Promise<CheckIssue[]> => {
  if (log === undefined || from === undefined) {
    return [];
  }

  const written = await fs.readFile(log).catch(() => undefined);
  if (written === undefined || written.length <= from) {
    return [];
  }

  const failing = [
    ...new Set(
      written
        .subarray(from)
        .toString('utf-8')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line !== '' && !isNotice(line) && FAILING.test(line))
    )
  ];
  if (failing.length === 0) {
    return [];
  }

  return [
    {
      code: 'server-logged',
      message: `the server logged as these pages were opened: ${failing.slice(0, QUOTED).join(' · ')}${failing.length > QUOTED ? ` · ${String(failing.length - QUOTED)} more` : ''} — its log: ${log}`,
      width
    }
  ];
};
