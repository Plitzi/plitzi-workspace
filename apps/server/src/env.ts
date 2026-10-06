/**
 * The project's `.env` in `process.env`, when there is one, before any module of it is evaluated — preloaded by the
 * one script Node's own `--env-file-if-exists=.env` cannot be given to: `start:dev`, run as
 * `node --import @plitzi/sdk-server/env --watch-path=… src/main.ts`.
 *
 * Node's watcher, given `--watch-path`, watches the folder an env file is in — the project's root — for any change at
 * all, and on macOS everything under it: the server writing `tmp/dev-server.json` restarted it, which wrote it again,
 * and it never stopped. Preloaded, the file is read by the watched process alone, as Node reads it: a variable the
 * environment already sets is kept. The project's other scripts, which watch nothing, keep Node's flag.
 */
const ENV_FILE = '.env';

try {
  process.loadEnvFile(ENV_FILE);
} catch (error) {
  // None: the environment the process was started with is all there is, as with `--env-file-if-exists`.
  if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
    throw error;
  }
}
