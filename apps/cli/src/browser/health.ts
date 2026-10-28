import { isRecord } from '@plitzi/sdk-shared/helpers';
import { projectMark } from '@plitzi/sdk-shared/project';

/**
 * A project's server says what it serves at `/health` — the folder it serves by its mark (`Instance`, `projectMark`):
 * how a copy's server, a lingering one and `server stop` tell this folder's from another's. One reading of it, where six
 * read it each their own way.
 */

export const HEALTH_PATH = '/health';

/** What the server on `port` says at `/health`, read within `ms` — undefined when nothing answers with JSON. */
export const healthOn = (port: number, ms = 1_000): Promise<unknown> =>
  fetch(`http://127.0.0.1:${String(port)}${HEALTH_PATH}`, { signal: AbortSignal.timeout(ms) })
    .then(async (response): Promise<unknown> => response.json())
    .catch(() => undefined);

/** The folder mark a `/health` answer names — none for a server that names none. */
export const markOf = (health: unknown): string | undefined =>
  isRecord(health) && typeof health.Instance === 'string' ? health.Instance : undefined;

/** Whether a `/health` answer is of `folder`'s server: one that names no folder is taken as its own. */
export const servesFolder = (health: unknown, folder: string): boolean =>
  isRecord(health) && (markOf(health) === undefined || markOf(health) === projectMark(folder));

/** Waits, a few seconds at most, until nothing answers on `port`. */
export const stoppedAnswering = async (port: number): Promise<void> => {
  for (let tries = 0; tries < 20; tries += 1) {
    const answers = await fetch(`http://127.0.0.1:${String(port)}${HEALTH_PATH}`, { signal: AbortSignal.timeout(500) })
      .then(() => true)
      .catch(() => false);
    if (!answers) {
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 250));
  }
};
