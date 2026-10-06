import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';
import { AUTHOR_FILE, SOURCE_DIR } from '@plitzi/sdk-shared/project/paths';

import type { Schema, Style } from '@plitzi/sdk-shared';
import type { ChildProcess } from 'node:child_process';

/** The two documents a page server renders a space from, as the author script hands them over. */
export type AuthoredDocuments = { schema: Schema; style: Style };

/**
 * What the author script sent: its own `{ schema, style }`, which `authorSpace` built and checked — the message is
 * looked at only for its shape, so a stray one from a script that is not the CLI's is not served.
 */
const isAuthoredDocuments = (message: unknown): message is AuthoredDocuments =>
  isRecord(message) && isRecord(message.schema) && isRecord(message.style);

/**
 * What of `src/` is the space's: everything but the server's own code — its entry point, the server options,
 * actions, connectors, functions and runtime — which `start:dev` restarts the server on instead; and of a plugin, only
 * its declaration — its component is swapped in the open pages by the server itself.
 */
const authored = (file: string): boolean =>
  file !== 'main.ts' &&
  !/^(config|actions|connectors|functions|runtime)([\\/]|$)/.test(file) &&
  (!/^plugins([\\/]|$)/.test(file) || path.basename(file) === 'declaration.ts');

/**
 * A save to the space, while developing: re-authored by the project's `plitzi/author.ts` in a process of its own — the
 * only way to read every file of it again, which an import never does twice — and handed over IPC (`--ipc`), so
 * `onAuthored` swaps the documents the server serves. What it refuses is printed by the script, and the page keeps
 * the last space that authored. Saves in quick succession author once; one during a run, once more after it. Answers
 * what stops watching.
 */
export const watchSpace = (root: string, onAuthored: (documents: AuthoredDocuments) => void): (() => void) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: ChildProcess | undefined;
  let again = false;
  let stopped = false;
  const author = (): void => {
    if (stopped) {
      return;
    }

    if (running) {
      again = true;

      return;
    }

    let documents: AuthoredDocuments | undefined;
    const child = spawn(process.execPath, [path.join(root, AUTHOR_FILE), '--ipc'], {
      cwd: root,
      stdio: ['inherit', 'inherit', 'inherit', 'ipc']
    });
    running = child;
    child.on('message', message => {
      if (isAuthoredDocuments(message)) {
        documents = message;
      }
    });
    child.on('error', error => {
      console.error(`[author] ${AUTHOR_FILE} did not run: ${error.message}`);
    });
    child.on('close', code => {
      running = undefined;
      if (stopped) {
        return;
      }

      if (code === 0 && documents) {
        onAuthored(documents);
      } else if (code === 0) {
        console.error(
          `[author] ${AUTHOR_FILE} authored the space and handed nothing over: it is older than this server — npx plitzi upgrade files --write`
        );
      }

      if (again) {
        again = false;
        author();
      }
    });
  };

  const watcher = watch(path.join(root, SOURCE_DIR), { recursive: true }, (_event, file) => {
    if (!file || !authored(file)) {
      return;
    }

    clearTimeout(timer);
    timer = setTimeout(author, 100);
  });

  return () => {
    stopped = true;
    clearTimeout(timer);
    watcher.close();
    running?.kill();
  };
};
