import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { SRC_ROOT } from './roots';

/** The CLI as a harness meets it: one process per command, from the source, its JSON and exit code read. */

const CLI = path.join(SRC_ROOT, 'index.ts');
const TSX = pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href;

export interface Answer {
  code: number;
  json: Record<string, unknown>;
  /** What it said apart from its answer: a refusal, a note. */
  stderr: string;
}

/** `plitzi <args>` in `cwd` — `--json` unless asked not to — with no caller of this process's environment handed down. */
export const plitzi = (
  cwd: string,
  args: string[],
  env: Record<string, string> = {},
  { input, json = true }: { input?: string; json?: boolean } = {}
): Promise<Answer> =>
  new Promise(resolve => {
    const child = execFile(
      process.execPath,
      ['--import', TSX, CLI, ...args, ...(json ? ['--json'] : [])],
      { cwd, env: { ...process.env, PLITZI_TOKEN: '', PLITZI_AGENT: '', PLITZI_JSON: '', ...env }, timeout: 60_000 },
      (error, stdout, stderr) => {
        const last = stdout.trim().split('\n').at(-1) ?? '{}';
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(last) as Record<string, unknown>;
        } catch {
          parsed = { stdout };
        }

        resolve({ code: error && typeof error.code === 'number' ? error.code : 0, json: parsed, stderr });
      }
    );
    child.stdin?.end(input ?? '');
  });
